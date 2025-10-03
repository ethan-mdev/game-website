// src/pages/api/auth/login.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { verifyPassword } from '../../../lib/auth';
import { setSessionCookie } from '../../../lib/cookies';
import { addDays } from 'date-fns';

async function readJson<T>(req: Request): Promise<T> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('bad content-type');
  return (await req.json()) as T;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { username, password } = await readJson<{ username: string; password: string }>(request);
    const u = (username ?? '').trim();
    const p = (password ?? '');

    if (!u || !p) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });
    }

    const conn = await storePool;

    // Case-insensitive lookup via collation
    const rs = await conn.request()
      .input('u', mssql.NVarChar(50), u)
      .query(`
        SELECT TOP 1 id, password_hash
        FROM store.users
        WHERE username COLLATE SQL_Latin1_General_CP1_CI_AS = @u COLLATE SQL_Latin1_General_CP1_CI_AS
      `);

    if (!rs.recordset.length) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid credentials' }), { status: 401 });
    }

    const { id, password_hash } = rs.recordset[0];

    // FIX: Correct parameter order - hash first, then plain password
    const ok = await verifyPassword(password_hash, p);
    if (!ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid credentials' }), { status: 401 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || '127.0.0.1';

    const ses = await conn.request()
      .input('uid', mssql.UniqueIdentifier, id as string)
      .input('exp', mssql.DateTime2, addDays(new Date(), Number(process.env.SESSION_TTL_DAYS || '30')))
      .input('ua',  mssql.NVarChar(255), request.headers.get('user-agent') || null)
      .input('ip',  mssql.NVarChar(45),  ip)
      .query(`
        INSERT INTO store.sessions (user_id, expires_at, user_agent, ip)
        OUTPUT inserted.id
        VALUES (@uid, @exp, @ua, @ip)
      `);

    const sessionId = ses.recordset[0].id as string;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Set-Cookie': setSessionCookie(sessionId),
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.warn('[login] bad request', e);
    return new Response(JSON.stringify({ ok: false, error: 'Bad request' }), { status: 400 });
  }
};