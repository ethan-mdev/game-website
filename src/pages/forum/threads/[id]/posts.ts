// src/pages/api/forum/threads/[id]/posts.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { validateSession } from "../../../../lib/session";
import { getConn, pageParams, isUserSanctioned } from "../../../../lib/forum";

// GET: list posts (paged)
export const GET: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) return new Response(JSON.stringify({ ok:false, error:"invalid id" }), { status: 400 });

  const { page, pageSize, offset } = pageParams(new URL(request.url), { page: 1, pageSize: 10 });
  const conn = await getConn();

  const rs = await conn.request()
    .input("id", mssql.BigInt, id)
    .input("offset", mssql.Int, offset)
    .input("limit", mssql.Int, pageSize)
    .query(`
      SELECT p.id, p.author_id, u.username AS author_name, u.profile_image, u.created_at AS user_joined_at,
             p.content, p.is_op, p.created_at, p.edited_at,
             (SELECT COUNT(*) FROM forum.posts WHERE author_id = p.author_id AND deleted = 0) AS author_post_count,
             (SELECT STRING_AGG(r.name, ',') 
              FROM store.user_roles ur 
              JOIN store.roles r ON r.id = ur.role_id 
              WHERE ur.user_id = p.author_id) AS author_roles
      FROM forum.posts p
      JOIN store.users u ON u.id = p.author_id
      WHERE p.thread_id=@id AND p.deleted=0
      ORDER BY p.created_at ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(1) AS total FROM forum.posts WHERE thread_id=@id AND deleted=0;
    `) as mssql.IResult<any>;

  return new Response(JSON.stringify({
    ok: true,
    posts: (rs.recordsets as any)[0],
    page, pageSize,
    total: (rs.recordsets as any)[1][0]?.total ?? 0
  }), { headers: { "Content-Type":"application/json" }});
};

// POST: create a reply in thread
export const POST: APIRoute = async ({ params, request }) => {
  const user = await validateSession(request);
  if (!user) return new Response(JSON.stringify({ ok:false, error:"Not authenticated" }), { status: 401 });

  const id = Number(params.id);
  const { content } = await request.json().catch(() => ({}));
  if (!id || !content) return new Response(JSON.stringify({ ok:false, error:"Missing fields" }), { status: 400 });

  if (await isUserSanctioned(user.id))
    return new Response(JSON.stringify({ ok:false, error:"You are restricted from posting" }), { status: 403 });

  const conn = await getConn();

  const t = await conn.request()
    .input("id", mssql.BigInt, id)
    .query(`
      SELECT TOP 1 t.locked, t.deleted, c.is_announcement
      FROM forum.threads t
      JOIN forum.categories c ON c.id = t.category_id
      WHERE t.id=@id
    `);
  if (!t.recordset.length) return new Response(JSON.stringify({ ok:false, error:"Thread not found" }), { status: 404 });
  if (t.recordset[0].deleted) return new Response(JSON.stringify({ ok:false, error:"Thread deleted" }), { status: 410 });
  if (t.recordset[0].locked) return new Response(JSON.stringify({ ok:false, error:"Thread locked" }), { status: 403 });
  
  // Check if thread is in announcement category - only admins can reply
  if (t.recordset[0].is_announcement) {
    const isAdmin = user.roles?.some((r: string) => r.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok:false, error:"Only administrators can reply to announcements" }), { status: 403 });
    }
  }

  const tx = new mssql.Transaction(conn);
  await tx.begin();
  try {
    await new mssql.Request(tx)
      .input("thread_id", mssql.BigInt, id)
      .input("author_id", mssql.UniqueIdentifier, user.id)
      .input("content", mssql.NVarChar(mssql.MAX), content)
      .query(`
        INSERT INTO forum.posts (thread_id, author_id, content, is_op)
        VALUES (@thread_id, @author_id, @content, 0);

        UPDATE forum.threads
          SET reply_count = reply_count + 1,
              last_post_at = SYSUTCDATETIME(),
              last_post_user_id = @author_id
        WHERE id=@thread_id;
      `);

    await tx.commit();
    return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type":"application/json" }});
  } catch (e) {
    await tx.rollback();
    console.error("[forum] reply failed:", e);
    return new Response(JSON.stringify({ ok:false, error:"Reply failed" }), { status: 500 });
  }
};
