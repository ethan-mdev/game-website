export const prerender = false;

import type { APIRoute } from 'astro';
import { validateSession } from '../../../lib/session';
import { storePool } from '../../../lib/db';
import mssql from 'mssql';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Validate user session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get crate ID from query parameter
    const crateId = url.searchParams.get('id');
    if (!crateId) {
      return new Response(JSON.stringify({ ok: false, error: 'Crate ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the existing store pool
    const pool = await storePool;

    // First verify the crate exists and is actually a crate
    const crateCheck = await pool.request()
      .input('crateId', mssql.Int, parseInt(crateId))
      .query(`
        SELECT name, item_type 
        FROM store.items 
        WHERE id = @crateId AND item_type = 'crates'
      `);

    if (crateCheck.recordset.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Crate not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get crate contents with drop rates using your existing table structure
    const contentsResult = await pool.request()
      .input('crateId', mssql.Int, parseInt(crateId))
      .query(`
        SELECT 
          cc.item_name,
          cc.item_description,
          cc.rarity,
          cc.drop_weight
        FROM store.crate_contents cc
        WHERE cc.crate_item_id = @crateId AND cc.is_active = 1
        ORDER BY 
          CASE cc.rarity 
            WHEN 'legendary' THEN 1
            WHEN 'epic' THEN 2  
            WHEN 'rare' THEN 3
            WHEN 'common' THEN 4
            ELSE 5
          END,
          cc.item_name
      `);

    // Calculate total weight for percentage calculation
    const totalWeight = contentsResult.recordset.reduce((sum, item) => sum + item.drop_weight, 0);

    const contents = contentsResult.recordset.map(item => ({
      name: item.item_name,
      rarity: item.rarity,
      chance: `${((item.drop_weight / totalWeight) * 100).toFixed(1)}%`,
      description: item.item_description
    }));

    return new Response(JSON.stringify({ 
      ok: true, 
      crate: {
        name: crateCheck.recordset[0].name,
        contents: contents,
        totalItems: contents.length,
        totalWeight: totalWeight
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Crate contents API error:', error);
    return new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};