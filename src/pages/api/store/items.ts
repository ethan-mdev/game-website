export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const storeConn = await storePool;
    
    const result = await storeConn.request()
      .query(`
        SELECT id, name, description, goods_no, price, item_type
        FROM store.items 
        WHERE is_active = 1
        ORDER BY item_type, price ASC
      `);

    return new Response(JSON.stringify({ 
      ok: true, 
      items: result.recordset 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[store/items] error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'Failed to fetch items' 
    }), { status: 500 });
  }
};