// src/pages/api/forum/threads/[id]/mod.ts
export const prerender = false;

import type { APIRoute } from "astro";
import mssql from "mssql";
import { validateSession } from "../../../../lib/session";
import { getConn, hasRole } from "../../../../lib/forum";

export const POST: APIRoute = async ({ params, request }) => {
  const user = await validateSession(request);
  if (!user) return new Response(JSON.stringify({ ok:false, error:"Not authenticated" }), { status: 401 });
  if (!hasRole(user, "MOD", "ADMIN")) return new Response(JSON.stringify({ ok:false, error:"Forbidden" }), { status: 403 });

  const id = Number(params.id);
  const { action, target_user_id, reason, duration_hours } = await request.json().catch(() => ({}));
  if (!id || !action) return new Response(JSON.stringify({ ok:false, error:"Bad request" }), { status: 400 });

  const conn = await getConn();
  
  // Check if thread was created by an admin (mods can't modify admin threads)
  const isMod = hasRole(user, "MOD") && !hasRole(user, "ADMIN");
  if (isMod) {
    const threadCheck = await conn.request()
      .input("id", mssql.BigInt, id)
      .query(`
        SELECT t.author_id, 
               (SELECT COUNT(*) FROM store.user_roles ur 
                JOIN store.roles r ON r.id = ur.role_id 
                WHERE ur.user_id = t.author_id AND r.name = 'admin') as is_admin_author
        FROM forum.threads t
        WHERE t.id = @id
      `);
    
    if (threadCheck.recordset.length && threadCheck.recordset[0].is_admin_author > 0) {
      return new Response(JSON.stringify({ ok:false, error:"Moderators cannot modify threads created by administrators" }), { status: 403 });
    }
  }
  
  let sql = "";
  
  switch (action) {
    case "pin":    sql = "UPDATE forum.threads SET pinned=1,  updated_at=SYSUTCDATETIME() WHERE id=@id"; break;
    case "unpin":  sql = "UPDATE forum.threads SET pinned=0,  updated_at=SYSUTCDATETIME() WHERE id=@id"; break;
    case "lock":   sql = "UPDATE forum.threads SET locked=1,  updated_at=SYSUTCDATETIME() WHERE id=@id"; break;
    case "unlock": sql = "UPDATE forum.threads SET locked=0,  updated_at=SYSUTCDATETIME() WHERE id=@id"; break;
    case "delete": sql = "UPDATE forum.threads SET deleted=1, updated_at=SYSUTCDATETIME() WHERE id=@id"; break;
    
    case "timeout":
    case "ban":
      if (!target_user_id || !reason) {
        return new Response(JSON.stringify({ ok:false, error:"Missing target_user_id or reason" }), { status: 400 });
      }
      
      const sanctionType = action === "timeout" ? "timeout" : "ban";
      const expiresAt = action === "timeout" && duration_hours 
        ? new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString()
        : null;
      
      await conn.request()
        .input("user_id", mssql.UniqueIdentifier, target_user_id)
        .input("type", mssql.NVarChar(20), sanctionType)
        .input("reason", mssql.NVarChar(500), reason)
        .input("issued_by", mssql.UniqueIdentifier, user.id)
        .input("expires_at", mssql.DateTime2, expiresAt)
        .query(`
          INSERT INTO forum.user_sanctions (user_id, type, reason, issued_by, expires_at, created_at)
          VALUES (@user_id, @type, @reason, @issued_by, @expires_at, SYSUTCDATETIME())
        `);
      
      return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type":"application/json" }});
    
    default:
      return new Response(JSON.stringify({ ok:false, error:"Unknown action" }), { status: 400 });
  }

  await conn.request().input("id", mssql.BigInt, id).query(sql);
  return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type":"application/json" }});
};
