// src/lib/forum.ts
import mssql from "mssql";
import { storePool } from "./db";

export type Role = "ADMIN" | "MOD" | "MEMBER";

export function hasRole(user: { roles?: string[] }, ...anyOf: Role[]) {
  const set = new Set((user.roles ?? []).map(r => r.toUpperCase()));
  return anyOf.some(r => set.has(r));
}

export async function getConn() {
  return storePool; // already a connected pool in your project
}

/** returns true if user currently has an active timeout/ban */
export async function isUserSanctioned(userId: string) {
  const conn = await getConn();
  const rs = await conn.request()
    .input("user_id", mssql.UniqueIdentifier, userId)
    .query(`
      SELECT TOP 1 1
      FROM forum.user_sanctions
      WHERE user_id=@user_id
        AND revoked_at IS NULL
        AND (
             (type='ban'  AND (expires_at IS NULL OR expires_at > SYSUTCDATETIME()))
          OR (type='timeout' AND (expires_at IS NOT NULL AND expires_at > SYSUTCDATETIME()))
        )
    `);
  return !!rs.recordset.length;
}

export function pageParams(url: URL, defaults = { page: 1, pageSize: 20 }) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || String(defaults.page), 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || String(defaults.pageSize), 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
