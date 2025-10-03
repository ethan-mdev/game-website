export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

// 🎮 GAME INTEGRATION REMOVED FOR DEMO
// In a real implementation, you would also:
// 1. Import gamePool from '../../../lib/db'
// 2. Deliver purchased items to the player's game account
// 3. Handle delivery failures with refund logic

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    // Parse request - always purchase single items
    const { itemId } = await request.json() as { itemId: number };
    const quantity = 1; // Always purchase 1 item
    
    console.log('[purchase] Received request:', { itemId, quantity });
    
    if (!itemId) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid item' }), { status: 400 });
    }

    const storeConn = await storePool;

    // Start transaction
    const transaction = new mssql.Transaction(storeConn);
    await transaction.begin();

    try {
      // Get item details and check if it's a crate
      const itemResult = await transaction.request()
        .input('itemId', mssql.Int, itemId)
        .query(`
          SELECT i.id, i.name, i.goods_no, i.price, i.is_active, i.item_type
          FROM store.items i
          WHERE i.id = @itemId AND i.is_active = 1
        `);

      if (!itemResult.recordset.length) {
        await transaction.rollback();
        return new Response(JSON.stringify({ ok: false, error: 'Item not found' }), { status: 404 });
      }

      const item = itemResult.recordset[0];
      const isCrate = item.item_type === 'crates';
      const totalPrice = item.price * quantity; // Simple integer multiplication

      // Check user balance
      const balanceResult = await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .query(`
          SELECT account_balance 
          FROM store.users 
          WHERE id = @userId
        `);

      const currentBalance = balanceResult.recordset[0]?.account_balance || 0;
      
      if (currentBalance < totalPrice) {
        await transaction.rollback();
        return new Response(JSON.stringify({ 
          ok: false, 
          error: 'Insufficient balance',
          required: totalPrice,
          current: currentBalance
        }), { status: 400 });
      }

      // Deduct balance and create purchase record
      await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('totalPrice', mssql.Int, totalPrice)
        .query(`
          UPDATE store.users 
          SET account_balance = account_balance - @totalPrice
          WHERE id = @userId
        `);

      // Create purchase record
      const purchaseResult = await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('itemId', mssql.Int, itemId)
        .input('quantity', mssql.Int, quantity)
        .input('unitPrice', mssql.Int, item.price)
        .input('totalPrice', mssql.Int, totalPrice)
        .input('gameUserNo', mssql.Int, user.game_user_no)
        .query(`
          INSERT INTO store.purchases (user_id, item_id, quantity, unit_price, total_price, game_user_no)
          OUTPUT INSERTED.id
          VALUES (@userId, @itemId, @quantity, @unitPrice, @totalPrice, @gameUserNo)
        `);

      const orderId = purchaseResult.recordset[0].id;

      // Commit store transaction
      await transaction.commit();

      // Handle delivery - crates are not delivered immediately, they need to be opened
      if (isCrate) {
        console.log('[purchase] Purchased crate, no immediate delivery needed');
        
        // For crates, we just mark as completed - they'll be opened via the crate API
        await storeConn.request()
          .input('orderId', mssql.BigInt, orderId)
          .query(`
            UPDATE store.purchases 
            SET order_status = 'completed', completed_at = GETUTCDATE()
            WHERE id = @orderId
          `);

        return new Response(JSON.stringify({ 
          ok: true, 
          message: `Successfully purchased ${item.name}! You can now open it to reveal your rewards.`,
          orderId: orderId,
          is_crate: true
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 🎮 GAME DELIVERY INTEGRATION POINT:
      // In a real implementation, you would deliver the purchased item to the game:
      // 1. Connect to game database using gamePool
      // 2. Call stored procedure to add item to player inventory
      // 3. Handle delivery return codes and update purchase status accordingly
      // 4. Implement refund logic if delivery fails
      
      console.log(`📦 Demo: Would deliver item ${item.goods_no} to game user ${user.game_user_no || 'N/A'}`);
      
      // Mark purchase as completed (demo behavior)
      await storeConn.request()
        .input('orderId', mssql.BigInt, orderId)
        .query(`
          UPDATE store.purchases 
          SET order_status = 'completed', completed_at = GETUTCDATE()
          WHERE id = @orderId
        `);

      return new Response(JSON.stringify({ 
        ok: true, 
        message: `Successfully purchased ${item.name}! (Demo mode - no actual game delivery)`,
        orderId: orderId
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (storeError) {
      await transaction.rollback();
      throw storeError;
    }

  } catch (error) {
    console.error('[purchase] error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'Purchase failed' 
    }), { status: 500 });
  }
};