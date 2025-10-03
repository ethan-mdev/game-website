// src/pages/api/forum/categories.ts
export const prerender = false;

import type { APIRoute } from "astro";
import { getConn } from "../../lib/forum";

export const GET: APIRoute = async () => {
  const conn = await getConn();
  const rs = await conn.request().query(`
    SELECT c.id, c.parent_id, c.slug, c.name, c.description, c.sort_order, c.is_locked, c.is_announcement, c.is_private,
           (SELECT COUNT(*) FROM forum.threads t WHERE t.category_id = c.id AND t.deleted = 0) AS thread_count
    FROM forum.categories c
    ORDER BY ISNULL(c.parent_id, 0), c.sort_order, c.id
  `);

  const byId: Record<number, any> = {};
  const roots: any[] = [];
  for (const r of rs.recordset) { r.children = []; byId[r.id] = r; }
  for (const r of rs.recordset) (r.parent_id && byId[r.parent_id]) ? byId[r.parent_id].children.push(r) : roots.push(r);

  // Fetch latest thread for announcement categories
  for (const cat of roots) {
    if (cat.is_announcement && !cat.parent_id) {
      const latestThread = await conn.request().query(`
        SELECT TOP 1 
          t.id, 
          t.title, 
          t.created_at,
          u.username as author_name
        FROM forum.threads t
        JOIN store.users u ON t.author_id = u.id
        WHERE t.category_id = ${cat.id} AND t.deleted = 0
        ORDER BY t.created_at DESC
      `);
      cat.latest_thread = latestThread.recordset.length > 0 ? latestThread.recordset[0] : null;
    }
  }

  return new Response(JSON.stringify({ ok: true, categories: roots }), { headers: { "Content-Type": "application/json" }});
};