// src/pages/api/forum/roles.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { getConn } from "../../../lib/forum";

export const GET: APIRoute = async () => {
  try {
    const conn = await getConn();
    
    const rs = await conn.request().query(`
      SELECT id, name, color
      FROM store.roles
      ORDER BY id ASC;
    `);

    return new Response(JSON.stringify({
      ok: true,
      roles: rs.recordset
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error('Error fetching roles:', err);
    return new Response(JSON.stringify({
      ok: false,
      error: 'Failed to fetch roles'
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
