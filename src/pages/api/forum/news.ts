// API endpoint to fetch recent announcement threads for News component
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { getConn } from "../../../lib/forum";

export const GET: APIRoute = async ({ url }) => {
  const limit = parseInt(url.searchParams.get("limit") || "10");
  
  try {
    const conn = await getConn();
    
    // Fetch recent announcement threads with their prefixes
    const result = await conn.request()
      .input("limit", mssql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          t.id,
          t.title,
          t.created_at,
          t.view_count,
          t.reply_count,
          u.username as author_name,
          (SELECT TOP 1 content FROM forum.posts WHERE thread_id = t.id AND is_op = 1) as excerpt,
          (SELECT STRING_AGG(p.name, '|') 
           FROM forum.thread_prefixes tp
           JOIN forum.prefixes p ON p.id = tp.prefix_id
           WHERE tp.thread_id = t.id) AS prefixes,
          (SELECT STRING_AGG(CONCAT(p.name, ':', p.color, ':', p.text_color), '|') 
           FROM forum.thread_prefixes tp
           JOIN forum.prefixes p ON p.id = tp.prefix_id
           WHERE tp.thread_id = t.id) AS prefix_details
        FROM forum.threads t
        JOIN store.users u ON u.id = t.author_id
        JOIN forum.categories c ON c.id = t.category_id
        WHERE c.is_announcement = 1 AND t.deleted = 0
        ORDER BY t.created_at DESC
      `);

    const threads = result.recordset.map(thread => {
      // Parse prefix details (name:color:text_color|name:color:text_color)
      const prefixTags: Array<{ name: string; color: string; textColor: string }> = [];
      if (thread.prefix_details) {
        const prefixes = thread.prefix_details.split('|');
        prefixes.forEach((p: string) => {
          const [name, color, textColor] = p.split(':');
          prefixTags.push({
            name,
            color: color || 'bg-gray-500/20',
            textColor: textColor || 'text-gray-400'
          });
        });
      }

      // Clean up excerpt - strip BBCode and limit length
      let cleanExcerpt = thread.excerpt || '';
      cleanExcerpt = cleanExcerpt
        .replace(/\[quote.*?\].*?\[\/quote\]/gis, '') // Remove quotes
        .replace(/\[.*?\]/g, '') // Remove all BBCode tags
        .trim();
      
      // Limit to ~300 characters
      if (cleanExcerpt.length > 300) {
        cleanExcerpt = cleanExcerpt.substring(0, 300) + '...';
      }

      return {
        id: `thread-${thread.id}`,
        threadId: thread.id,
        title: thread.title,
        date: thread.created_at,
        excerpt: cleanExcerpt,
        tags: prefixTags,
        author: thread.author_name,
        stats: {
          views: thread.view_count,
          replies: thread.reply_count
        }
      };
    });

    return new Response(JSON.stringify({
      ok: true,
      news: threads
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error fetching announcement threads:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: "Failed to fetch announcements"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
