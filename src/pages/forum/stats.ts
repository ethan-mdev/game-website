// src/pages/forum/stats.ts
export const prerender = false;

import type { APIRoute } from "astro";
import { getConn } from "../../lib/forum";

export const GET: APIRoute = async () => {
  const conn = await getConn();
  const rs = await conn.request().query(`
    SELECT 
      (SELECT COUNT(*) FROM forum.threads WHERE deleted = 0) AS total_threads,
      (SELECT COUNT(*) FROM forum.posts WHERE deleted = 0) AS total_posts
  `);

  const stats = rs.recordset[0];
  
  return new Response(JSON.stringify({ 
    ok: true, 
    total_threads: stats.total_threads,
    total_posts: stats.total_posts
  }), { headers: { "Content-Type": "application/json" }});
};
