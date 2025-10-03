export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

// 🎮 GAME INTEGRATION REMOVED FOR DEMO
// In a real implementation, you would also:
// 1. Import gamePool from '../../../lib/db'
// 2. Deliver crate contents to the player's game account
// 3. Handle complex pity systems and delivery failures

interface CrateContent {
  item_goods_no: number;
  item_name: string;
  item_description: string;
  rarity: string;
  drop_weight: number;
}

export const POST: APIRoute = async ({ request }) => {
  let user;
  let purchaseId;
  
  try {
    // Validate session
    user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    // Parse request
    const requestData = await request.json() as { purchaseId: number };
    purchaseId = requestData.purchaseId;
    
    if (!purchaseId) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid purchase ID' }), { status: 400 });
    }

    const storeConn = await storePool;

    // Start transaction
    const transaction = new mssql.Transaction(storeConn);
    await transaction.begin();

    try {
      // Verify the purchase exists and is for a crate item
      const purchaseResult = await transaction.request()
        .input('purchaseId', mssql.BigInt, purchaseId)
        .input('userId', mssql.UniqueIdentifier, user.id)
        .query(`
          SELECT p.id, p.item_id, p.quantity, p.order_status, i.name as crate_name
          FROM store.purchases p
          INNER JOIN store.items i ON p.item_id = i.id
          WHERE p.id = @purchaseId AND p.user_id = @userId AND p.order_status = 'completed'
            AND i.item_type = 'crates'
        `);

      if (!purchaseResult.recordset.length) {
        await transaction.rollback();
        return new Response(JSON.stringify({ ok: false, error: 'Invalid crate purchase' }), { status: 404 });
      }

      const purchase = purchaseResult.recordset[0];

      // Get user's pity information for this crate type
      const pityResult = await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('crateItemId', mssql.Int, purchase.item_id)
        .query(`
          SELECT opens_since_rare, opens_since_legendary
          FROM store.user_crate_history
          WHERE user_id = @userId AND crate_item_id = @crateItemId
        `);

      const pityInfo = {
        opens_since_rare: pityResult.recordset[0]?.opens_since_rare || 0,
        opens_since_legendary: pityResult.recordset[0]?.opens_since_legendary || 0,
        rare_pity_threshold: 10, // Simple fixed thresholds
        legendary_pity_threshold: 50
      };

      // Get available items for this crate
      const itemsResult = await transaction.request()
        .input('crateItemId', mssql.Int, purchase.item_id)
        .query(`
          SELECT item_goods_no, item_name, item_description, rarity, drop_weight
          FROM store.crate_contents
          WHERE crate_item_id = @crateItemId AND is_active = 1
        `);

      const crateContents: CrateContent[] = itemsResult.recordset;

      if (!crateContents.length) {
        await transaction.rollback();
        return new Response(JSON.stringify({ ok: false, error: 'No items configured for this crate' }), { status: 500 });
      }

      // Determine if pity should trigger
      const shouldTriggerLegendaryPity = pityInfo.opens_since_legendary >= pityInfo.legendary_pity_threshold;
      const shouldTriggerRarePity = pityInfo.opens_since_rare >= pityInfo.rare_pity_threshold;

      // Roll for item
      const rolledItem = rollForItem(crateContents, shouldTriggerLegendaryPity, shouldTriggerRarePity);
      const quantity = 1; // Always exactly 1 item

      // Update pity counters
      let newOpensSinceRare = pityInfo.opens_since_rare + 1;
      let newOpensSinceLegendary = pityInfo.opens_since_legendary + 1;

      if (rolledItem.rarity === 'legendary') {
        newOpensSinceLegendary = 0;
        newOpensSinceRare = 0;
      } else if (rolledItem.rarity === 'epic' || rolledItem.rarity === 'rare') {
        newOpensSinceRare = 0;
      }

      // 🎮 GAME DELIVERY INTEGRATION POINT:
      // In a real implementation, you would deliver the crate contents to the game:
      // 1. Connect to game database using gamePool
      // 2. Call stored procedure to add item to player inventory
      // 3. Handle delivery failures appropriately
      // 4. Consider whether to refund crate on delivery failure
      
      console.log(`🎁 Demo: Crate opened! Would deliver ${rolledItem.item_name} (${rolledItem.item_goods_no}) to game user ${user.game_user_no || 'N/A'}`);
      let deliverySuccess = true; // Demo: always successful

      // Log the opening
      await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('crateItemId', mssql.Int, purchase.item_id)
        .input('purchaseId', mssql.BigInt, purchaseId)
        .input('itemGoodsNo', mssql.Int, rolledItem.item_goods_no)
        .input('itemName', mssql.NVarChar(100), rolledItem.item_name)
        .input('itemRarity', mssql.NVarChar(20), rolledItem.rarity)
        .input('quantity', mssql.Int, quantity)
        .input('wasPityDrop', mssql.Bit, shouldTriggerLegendaryPity || shouldTriggerRarePity)
        .query(`
          INSERT INTO store.crate_openings 
          (user_id, crate_item_id, purchase_id, item_goods_no, item_name, item_rarity, quantity_received, was_pity_drop)
          VALUES (@userId, @crateItemId, @purchaseId, @itemGoodsNo, @itemName, @itemRarity, @quantity, @wasPityDrop)
        `);

      // Update or insert user pity history
      await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('crateItemId', mssql.Int, purchase.item_id)
        .input('opensSinceRare', mssql.Int, newOpensSinceRare)
        .input('opensSinceLegendary', mssql.Int, newOpensSinceLegendary)
        .query(`
          MERGE store.user_crate_history AS target
          USING (SELECT @userId as user_id, @crateItemId as crate_item_id) AS source
          ON target.user_id = source.user_id AND target.crate_item_id = source.crate_item_id
          WHEN MATCHED THEN
            UPDATE SET 
              total_opens = total_opens + 1,
              opens_since_rare = @opensSinceRare,
              opens_since_legendary = @opensSinceLegendary,
              updated_at = GETUTCDATE()
          WHEN NOT MATCHED THEN
            INSERT (user_id, crate_item_id, total_opens, opens_since_rare, opens_since_legendary)
            VALUES (@userId, @crateItemId, 1, @opensSinceRare, @opensSinceLegendary);
        `);

      await transaction.commit();

      return new Response(JSON.stringify({
        ok: true,
        crate_name: purchase.crate_name,
        results: [{
          item_name: rolledItem.item_name,
          item_description: rolledItem.item_description,
          rarity: rolledItem.rarity,
          quantity: quantity,
          delivered: deliverySuccess,
          was_pity: shouldTriggerLegendaryPity || shouldTriggerRarePity
        }],
        pity_info: {
          opens_since_rare: newOpensSinceRare,
          opens_since_legendary: newOpensSinceLegendary,
          rare_pity_in: Math.max(0, pityInfo.rare_pity_threshold - newOpensSinceRare),
          legendary_pity_in: Math.max(0, pityInfo.legendary_pity_threshold - newOpensSinceLegendary)
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('[crate-open] error:', error);
    
    // Only attempt refund if we have valid user and purchaseId
    if (!user?.id || !purchaseId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Failed to open crate'
      }), { status: 500 });
    }
    
    // Attempt to refund the user if crate opening completely failed
    try {
      const storeConn = await storePool;
      
      // Get the purchase details to determine refund amount
      const purchaseResult = await storeConn.request()
        .input('purchaseId', mssql.BigInt, purchaseId)
        .input('userId', mssql.UniqueIdentifier, user!.id)
        .query(`
          SELECT p.total_price, i.name as item_name
          FROM store.purchases p
          INNER JOIN store.items i ON p.item_id = i.id
          WHERE p.id = @purchaseId AND p.user_id = @userId
        `);

      if (purchaseResult.recordset.length > 0) {
        const purchase = purchaseResult.recordset[0];
        
        // Refund the user
        await storeConn.request()
          .input('userId', mssql.UniqueIdentifier, user!.id)
          .input('refundAmount', mssql.Int, purchase.total_price)
          .query(`
            UPDATE store.users 
            SET account_balance = account_balance + @refundAmount
            WHERE id = @userId
          `);

        console.log(`[crate-open] Refunded ${purchase.total_price} credits to user ${user!.id} for failed crate opening`);
        
        return new Response(JSON.stringify({
          ok: false,
          error: `Failed to open ${purchase.item_name}. Your ${purchase.total_price.toLocaleString()} credits have been refunded.`,
          refunded: purchase.total_price
        }), { status: 500 });
      }
    } catch (refundError) {
      console.error('[crate-open] Failed to process refund:', refundError);
    }
    
    return new Response(JSON.stringify({
      ok: false,
      error: 'Failed to open crate. Please contact support if you were charged.'
    }), { status: 500 });
  }
};

function rollForItem(contents: CrateContent[], forceLegendary: boolean, forceRare: boolean): CrateContent {
  // If pity triggers, filter items by required rarity
  let availableItems = contents;
  
  if (forceLegendary) {
    availableItems = contents.filter(item => item.rarity === 'legendary');
  } else if (forceRare) {
    availableItems = contents.filter(item => ['rare', 'epic', 'legendary'].includes(item.rarity));
  }

  // Calculate total weight
  const totalWeight = availableItems.reduce((sum, item) => sum + item.drop_weight, 0);
  
  // Roll random number
  const roll = Math.random() * totalWeight;
  
  // Find the item
  let currentWeight = 0;
  for (const item of availableItems) {
    currentWeight += item.drop_weight;
    if (roll <= currentWeight) {
      return item;
    }
  }
  
  // Fallback (shouldn't happen)
  return availableItems[availableItems.length - 1];
}