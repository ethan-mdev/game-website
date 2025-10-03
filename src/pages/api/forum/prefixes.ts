// src/pages/api/forum/prefixes.ts
export const prerender = false;

import type { APIRoute } from "astro";
import { getConn } from "../../../lib/forum";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type"); // 'announcement' or 'community'

  const conn = await getConn();
  
  let query = "SELECT id, name, type, color, text_color FROM forum.prefixes";
  if (type) {
    query += ` WHERE type = '${type}'`;
  }
  query += " ORDER BY name";

  const rs = await conn.request().query(query);

  return new Response(JSON.stringify({ 
    ok: true, 
    prefixes: rs.recordset 
  }), { 
    headers: { "Content-Type": "application/json" }
  });
};
