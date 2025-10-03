// src/pages/forum/threads/[id]/index.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { getConn, pageParams, hasRole } from "../../../../lib/forum";
import { validateSession } from "../../../../lib/session";

export const GET: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) return new Response(JSON.stringify({ ok:false, error:"invalid id" }), { status: 400 });

  const { page, pageSize } = pageParams(new URL(request.url), { page: 1, pageSize: 10 });

  const conn = await getConn();
  
  const rs = await conn.request()
    .input("id", mssql.BigInt, id)
    .query(`
      SELECT TOP 1 t.id, t.category_id, t.author_id, t.title, t.pinned, t.locked, t.deleted, t.view_count, t.reply_count,
             t.created_at, t.updated_at, t.last_post_at, t.last_post_user_id,
             au.username AS author_name,
             c.is_private, c.is_announcement,
             (SELECT STRING_AGG(p.name, '|') 
              FROM forum.thread_prefixes tp
              JOIN forum.prefixes p ON p.id = tp.prefix_id
              WHERE tp.thread_id = t.id) AS prefixes
      FROM forum.threads t
      JOIN store.users au ON au.id = t.author_id
      JOIN forum.categories c ON c.id = t.category_id
      WHERE t.id=@id AND t.deleted=0;
    `);

  const thread = rs.recordset[0];
  if (!thread) return new Response(JSON.stringify({ ok:false, error:"not found" }), { status: 404 });

  // Check privacy permissions
  if (thread.is_private) {
    const user = await validateSession(request);
    const isAdmin = user ? hasRole(user, "ADMIN") : false;
    const isAuthor = user ? thread.author_id === user.id : false;
    
    if (!isAdmin && !isAuthor) {
      return new Response(JSON.stringify({ ok:false, error:"Access denied. This thread is private." }), { status: 403 });
    }
  }
  
  // Increment view count only if user has access
  await conn.request()
    .input("id", mssql.BigInt, id)
    .query(`UPDATE forum.threads SET view_count = view_count + 1 WHERE id = @id`);

  return new Response(JSON.stringify({
    ok: true,
    thread,
    // client will call /posts for the page itself
    page, pageSize
  }), { headers: { "Content-Type": "application/json" }});
};
