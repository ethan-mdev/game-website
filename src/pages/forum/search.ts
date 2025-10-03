// src/pages/forum/search.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { getConn, pageParams } from "../../lib/forum";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  
  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ ok: false, error: "Search query must be at least 2 characters" }), { status: 400 });
  }

  const { page, pageSize, offset } = pageParams(url, { page: 1, pageSize: 20 });
  const conn = await getConn();

  // Search in thread titles and post content
  const rs = await conn.request()
    .input("query", mssql.NVarChar, `%${query}%`)
    .input("offset", mssql.Int, offset)
    .input("limit", mssql.Int, pageSize)
    .query(`
      -- Search in thread titles
      SELECT DISTINCT t.id, t.title, t.category_id, t.view_count, t.reply_count, t.created_at,
             u.username AS author_name,
             'thread' AS result_type,
             t.title AS match_text
      FROM forum.threads t
      JOIN store.users u ON u.id = t.author_id
      WHERE t.deleted = 0 AND t.title LIKE @query
      
      UNION
      
      -- Search in post content
      SELECT DISTINCT t.id, t.title, t.category_id, t.view_count, t.reply_count, p.created_at,
             u.username AS author_name,
             'post' AS result_type,
             SUBSTRING(p.content, 1, 200) AS match_text
      FROM forum.posts p
      JOIN forum.threads t ON t.id = p.thread_id
      JOIN store.users u ON u.id = p.author_id
      WHERE p.deleted = 0 AND t.deleted = 0 AND p.content LIKE @query
      
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      -- Get total count
      SELECT COUNT(DISTINCT t.id) AS total
      FROM forum.threads t
      LEFT JOIN forum.posts p ON p.thread_id = t.id AND p.deleted = 0
      WHERE t.deleted = 0 AND (t.title LIKE @query OR p.content LIKE @query);
    `) as mssql.IResult<any>;

  const results = (rs.recordsets as any)[0] || [];
  const total = (rs.recordsets as any)[1]?.[0]?.total ?? 0;

  return new Response(JSON.stringify({
    ok: true,
    results,
    query,
    page,
    pageSize,
    total
  }), { headers: { "Content-Type": "application/json" }});
};
