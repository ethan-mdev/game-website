export const prerender = false;

import type { APIRoute } from 'astro';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Validate session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    const storeConn = await storePool;

    // Get user's unopened crates
    const cratesResult = await storeConn.request()
      .input('userId', user.id)
      .query(`
        SELECT 
          p.id as purchase_id,
          p.quantity,
          p.created_at as purchased_at,
          i.name as crate_name,
          cd.id as crate_id,
          cd.description,
          cd.pity_threshold,
          cd.legendary_pity_threshold,
          -- Get user's current pity status
          ISNULL(uch.opens_since_rare, 0) as opens_since_rare,
          ISNULL(uch.opens_since_legendary, 0) as opens_since_legendary,
          ISNULL(uch.total_opens, 0) as total_opens
        FROM store.purchases p
        INNER JOIN store.items i ON p.item_id = i.id
        INNER JOIN store.crate_definitions cd ON i.id = cd.crate_item_id
        LEFT JOIN store.user_crate_history uch ON uch.user_id = p.user_id AND uch.crate_id = cd.id
        WHERE p.user_id = @userId 
          AND p.order_status = 'completed'
          AND NOT EXISTS (
            SELECT 1 FROM store.crate_openings co 
            WHERE co.purchase_id = p.id
          )
        ORDER BY p.created_at DESC
      `);

    const crates = cratesResult.recordset.map(crate => ({
      purchase_id: crate.purchase_id,
      crate_id: crate.crate_id,
      crate_name: crate.crate_name,
      description: crate.description,
      quantity: crate.quantity,
      purchased_at: crate.purchased_at,
      pity_info: {
        opens_since_rare: crate.opens_since_rare,
        opens_since_legendary: crate.opens_since_legendary,
        total_opens: crate.total_opens,
        rare_pity_in: Math.max(0, crate.pity_threshold - crate.opens_since_rare),
        legendary_pity_in: Math.max(0, crate.legendary_pity_threshold - crate.opens_since_legendary)
      }
    }));

    return new Response(JSON.stringify({
      ok: true,
      crates: crates
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[user-crates] error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: 'Failed to fetch crates'
    }), { status: 500 });
  }
};