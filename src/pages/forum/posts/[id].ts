// API endpoint for users to edit/delete their own posts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { validateSession } from "../../../lib/session";
import { getConn, hasRole, isUserSanctioned } from "../../../lib/forum";

// PATCH: Edit own post
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await validateSession(request);
  if (!user) return new Response(JSON.stringify({ ok:false, error:"Not authenticated" }), { status: 401 });

  const postId = Number(params.id);
  const { content } = await request.json().catch(() => ({}));
  
  if (!postId || !content) {
    return new Response(JSON.stringify({ ok:false, error:"Missing fields" }), { status: 400 });
  }

  if (content.length > 10000) {
    return new Response(JSON.stringify({ ok:false, error:"Content too long" }), { status: 400 });
  }

  if (await isUserSanctioned(user.id)) {
    return new Response(JSON.stringify({ ok:false, error:"You are restricted from editing posts" }), { status: 403 });
  }

  const conn = await getConn();
  
  // Check if post exists and user is the author
  const postCheck = await conn.request()
    .input("id", mssql.BigInt, postId)
    .input("user_id", mssql.UniqueIdentifier, user.id)
    .query(`
      SELECT p.id, p.author_id, p.is_op, p.deleted, t.locked, t.deleted as thread_deleted
      FROM forum.posts p
      JOIN forum.threads t ON t.id = p.thread_id
      WHERE p.id = @id
    `);

  if (!postCheck.recordset.length) {
    return new Response(JSON.stringify({ ok:false, error:"Post not found" }), { status: 404 });
  }

  const post = postCheck.recordset[0];
  
  // Check if post is deleted
  if (post.deleted || post.thread_deleted) {
    return new Response(JSON.stringify({ ok:false, error:"Cannot edit deleted content" }), { status: 410 });
  }

  // Check if thread is locked (only mods can edit in locked threads)
  if (post.locked && !hasRole(user, "MOD", "ADMIN")) {
    return new Response(JSON.stringify({ ok:false, error:"Thread is locked" }), { status: 403 });
  }

  // Check permissions: Only author or admin can edit posts
  const isAdmin = hasRole(user, "ADMIN");
  const isAuthor = post.author_id === user.id;

  // Mods cannot edit other people's posts (even for moderation)
  if (!isAuthor && !isAdmin) {
    return new Response(JSON.stringify({ ok:false, error:"You can only edit your own posts" }), { status: 403 });
  }

  // Update the post
  await conn.request()
    .input("id", mssql.BigInt, postId)
    .input("content", mssql.NVarChar(mssql.MAX), content)
    .query(`
      UPDATE forum.posts 
      SET content = @content, edited_at = SYSUTCDATETIME(), edited = 1
      WHERE id = @id
    `);

  return new Response(JSON.stringify({ ok:true }), { 
    headers: { "Content-Type":"application/json" }
  });
};

// DELETE: Delete own post
export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await validateSession(request);
  if (!user) return new Response(JSON.stringify({ ok:false, error:"Not authenticated" }), { status: 401 });

  const postId = Number(params.id);
  if (!postId) {
    return new Response(JSON.stringify({ ok:false, error:"Invalid post ID" }), { status: 400 });
  }

  const conn = await getConn();
  
  // Check if post exists and user is the author
  const postCheck = await conn.request()
    .input("id", mssql.BigInt, postId)
    .query(`
      SELECT p.id, p.author_id, p.is_op, p.deleted, p.thread_id, t.locked, t.deleted as thread_deleted
      FROM forum.posts p
      JOIN forum.threads t ON t.id = p.thread_id
      WHERE p.id = @id
    `);

  if (!postCheck.recordset.length) {
    return new Response(JSON.stringify({ ok:false, error:"Post not found" }), { status: 404 });
  }

  const post = postCheck.recordset[0];

  // Cannot delete OP (original post) - must delete entire thread instead
  if (post.is_op) {
    return new Response(JSON.stringify({ ok:false, error:"Cannot delete opening post. Delete the thread instead." }), { status: 400 });
  }

  // Check if already deleted
  if (post.deleted) {
    return new Response(JSON.stringify({ ok:false, error:"Post already deleted" }), { status: 410 });
  }

  // Check if thread is locked (only mods can delete in locked threads)
  if (post.locked && !hasRole(user, "MOD", "ADMIN")) {
    return new Response(JSON.stringify({ ok:false, error:"Thread is locked" }), { status: 403 });
  }

  // Check if user is the author or a moderator
  const isAdmin = hasRole(user, "ADMIN");
  const isModerator = hasRole(user, "MOD");
  const isAuthor = post.author_id === user.id;

  if (!isAuthor && !isModerator && !isAdmin) {
    return new Response(JSON.stringify({ ok:false, error:"You can only delete your own posts" }), { status: 403 });
  }
  
  // Mods cannot delete admin posts
  if (isModerator && !isAdmin && !isAuthor) {
    const authorCheck = await conn.request()
      .input("author_id", mssql.UniqueIdentifier, post.author_id)
      .query(`
        SELECT COUNT(*) as is_admin
        FROM store.user_roles ur
        JOIN store.roles r ON r.id = ur.role_id
        WHERE ur.user_id = @author_id AND r.name = 'admin'
      `);
    
    if (authorCheck.recordset[0].is_admin > 0) {
      return new Response(JSON.stringify({ ok:false, error:"Moderators cannot delete posts created by administrators" }), { status: 403 });
    }
  }

  // Soft delete the post
  await conn.request()
    .input("id", mssql.BigInt, postId)
    .query(`
      UPDATE forum.posts 
      SET deleted = 1, edited_at = SYSUTCDATETIME()
      WHERE id = @id
    `);

  // Update thread reply count
  await conn.request()
    .input("thread_id", mssql.BigInt, post.thread_id)
    .query(`
      UPDATE forum.threads
      SET reply_count = (SELECT COUNT(*) - 1 FROM forum.posts WHERE thread_id = @thread_id AND deleted = 0)
      WHERE id = @thread_id
    `);

  return new Response(JSON.stringify({ ok:true }), { 
    headers: { "Content-Type":"application/json" }
  });
};
