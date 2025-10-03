// src/pages/api/forum/threads/index.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { validateSession } from "../../../lib/session";
import { getConn, pageParams, isUserSanctioned, hasRole } from "../../../lib/forum";

// GET: list threads in a category
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const categoryId = parseInt(url.searchParams.get("category_id") || "0", 10);
  if (!categoryId) return new Response(JSON.stringify({ ok:false, error:"category_id required" }), { status: 400 });

  const sort = url.searchParams.get("sort") || "recent";
  const { page, pageSize, offset } = pageParams(url);
  const conn = await getConn();
  
  // Get current user for privacy filtering
  const user = await validateSession(request);
  const userId = user?.id || null;
  const isAdmin = user ? hasRole(user, "ADMIN") : false;

  // Check if category is private
  const catCheck = await conn.request()
    .input("category_id", mssql.Int, categoryId)
    .query(`SELECT is_private FROM forum.categories WHERE id = @category_id`);
  
  const isPrivateCategory = catCheck.recordset[0]?.is_private || false;

  // Determine ORDER BY clause based on sort parameter
  let orderBy = "t.pinned DESC, t.last_post_at DESC, t.id DESC"; // default: recent
  if (sort === "popular") {
    orderBy = "t.pinned DESC, t.view_count DESC, t.id DESC";
  } else if (sort === "replies") {
    orderBy = "t.pinned DESC, t.reply_count DESC, t.id DESC";
  }

  const rs = await conn.request()
    .input("category_id", mssql.Int, categoryId)
    .input("user_id", mssql.UniqueIdentifier, userId)
    .input("offset", mssql.Int, offset)
    .input("limit", mssql.Int, pageSize)
    .query(`
      SELECT t.id, 
             ${isPrivateCategory && !isAdmin ? 
               "CASE WHEN t.author_id = @user_id THEN t.title ELSE '🔒 Private Thread' END AS title" : 
               "t.title"},
             t.author_id, t.pinned, t.locked, t.deleted, t.view_count, t.reply_count,
             t.created_at, t.last_post_at,
             u.username AS author_name,
             (SELECT STRING_AGG(r.name, ',') 
              FROM store.user_roles ur 
              JOIN store.roles r ON r.id = ur.role_id 
              WHERE ur.user_id = t.author_id) AS author_roles,
             (SELECT STRING_AGG(p.name, '|') 
              FROM forum.thread_prefixes tp
              JOIN forum.prefixes p ON p.id = tp.prefix_id
              WHERE tp.thread_id = t.id) AS prefixes
      FROM forum.threads t
      JOIN store.users u ON u.id = t.author_id
      WHERE t.category_id = @category_id AND t.deleted = 0
        ${isPrivateCategory && !isAdmin ? "AND t.author_id = @user_id" : ""}
      ORDER BY ${orderBy}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(1) AS total
      FROM forum.threads
      WHERE category_id=@category_id AND deleted=0
        ${isPrivateCategory && !isAdmin ? "AND author_id = @user_id" : ""};
    `) as mssql.IResult<any>;

  const total = (rs.recordsets as any)[1][0]?.total ?? 0;
  
  // Add privacy flag to each thread for frontend use
  const threads = (rs.recordsets as any)[0].map((thread: any) => ({
    ...thread,
    is_private_category: isPrivateCategory,
    // Only restrict viewing for private categories
    can_view: !isPrivateCategory || isAdmin || thread.author_id === userId
  }));
  
  return new Response(JSON.stringify({ ok:true, page, pageSize, total, threads, is_private_category: isPrivateCategory }), { headers: { "Content-Type":"application/json" }});
};

// POST: create a thread (and OP post)
export const POST: APIRoute = async ({ request }) => {
  const user = await validateSession(request);
  if (!user) return new Response(JSON.stringify({ ok:false, error:"Not authenticated" }), { status: 401 });

  const { category_id, title, content, prefixes } = await request.json().catch(() => ({}));
  if (!category_id || !title || !content) return new Response(JSON.stringify({ ok:false, error:"Missing fields" }), { status: 400 });

  const conn = await getConn();

  // category rules
  const cat = await conn.request()
    .input("id", mssql.Int, category_id)
    .query(`SELECT TOP 1 is_announcement, is_locked FROM forum.categories WHERE id=@id`);
  if (!cat.recordset.length) return new Response(JSON.stringify({ ok:false, error:"Category not found" }), { status: 404 });

  const c = cat.recordset[0];
  if (c.is_announcement && !hasRole(user, "ADMIN")) return new Response(JSON.stringify({ ok:false, error:"Forbidden" }), { status: 403 });
  if (c.is_locked && !hasRole(user, "MOD", "ADMIN")) return new Response(JSON.stringify({ ok:false, error:"Category locked" }), { status: 403 });

  // Validate prefixes array - no limit for announcements, max 3 for community
  const prefixArray = Array.isArray(prefixes) ? prefixes : [];
  const maxPrefixes = c.is_announcement ? 999 : 3;
  if (prefixArray.length > maxPrefixes) {
    return new Response(JSON.stringify({ ok:false, error:`Maximum ${maxPrefixes} prefixes allowed` }), { status: 400 });
  }

  // Validate prefixes - check they exist and are appropriate for category type
  if (prefixArray.length > 0) {
    const req = conn.request();
    prefixArray.forEach((p, i) => req.input(`p${i}`, mssql.NVarChar(50), p));
    const validPrefixes = await req.query(`
      SELECT id, name, type FROM forum.prefixes WHERE name IN (${prefixArray.map((_, i) => `@p${i}`).join(',')})
    `);

    if (validPrefixes.recordset.length !== prefixArray.length) {
      return new Response(JSON.stringify({ ok:false, error:"Invalid prefix selected" }), { status: 400 });
    }

    // Check prefix types match category
    const expectedType = c.is_announcement ? 'announcement' : 'community';
    const wrongType = validPrefixes.recordset.find(p => p.type !== expectedType);
    if (wrongType) {
      return new Response(JSON.stringify({ ok:false, error:`Prefix "${wrongType.name}" is not allowed in this category` }), { status: 400 });
    }
  }

  if (await isUserSanctioned(user.id)) return new Response(JSON.stringify({ ok:false, error:"You are restricted from posting" }), { status: 403 });

  const tx = new mssql.Transaction(conn);
  await tx.begin();
  try {
    // Insert thread
    const tIns = await new mssql.Request(tx)
      .input("category_id", mssql.Int, category_id)
      .input("author_id", mssql.UniqueIdentifier, user.id)
      .input("title", mssql.NVarChar(200), title)
      .input("content", mssql.NVarChar(mssql.MAX), content)
      .query(`
        INSERT INTO forum.threads (category_id, author_id, title, content, reply_count, view_count, last_post_at, last_post_user_id)
        OUTPUT INSERTED.id
        VALUES (@category_id, @author_id, @title, @content, 0, 0, SYSUTCDATETIME(), @author_id);
      `);

    const threadId = tIns.recordset[0].id as number;

    // Insert thread prefixes if any selected
    if (prefixArray.length > 0) {
      const prefixIds = await new mssql.Request(tx).query(`
        SELECT id FROM forum.prefixes WHERE name IN (${prefixArray.map(p => `'${p.replace(/'/g, "''")}'`).join(',')})
      `);
      
      for (const prefix of prefixIds.recordset) {
        await new mssql.Request(tx)
          .input("thread_id", mssql.BigInt, threadId)
          .input("prefix_id", mssql.Int, prefix.id)
          .query(`INSERT INTO forum.thread_prefixes (thread_id, prefix_id) VALUES (@thread_id, @prefix_id)`);
      }
    }

    await new mssql.Request(tx)
      .input("thread_id", mssql.BigInt, threadId)
      .input("author_id", mssql.UniqueIdentifier, user.id)
      .input("content", mssql.NVarChar(mssql.MAX), content)
      .query(`
        INSERT INTO forum.posts (thread_id, author_id, content, is_op)
        VALUES (@thread_id, @author_id, @content, 1);
      `);

    await tx.commit();
    return new Response(JSON.stringify({ ok:true, thread_id: threadId }), { headers: { "Content-Type":"application/json" }});
  } catch (e) {
    await tx.rollback();
    console.error("[forum] create thread failed:", e);
    return new Response(JSON.stringify({ ok:false, error:"Create failed" }), { status: 500 });
  }
};



