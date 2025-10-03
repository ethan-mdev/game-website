// src/pages/api/auth/register.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';
import { setSessionCookie } from '../../../lib/cookies';
import { addDays } from 'date-fns';

// 🎮 GAME INTEGRATION REMOVED FOR DEMO
// In a real implementation, you would also:
// 1. Import gamePool from '../../../lib/db'
// 2. Import md5ForGame from '../../../lib/auth'
// 3. Create accounts in both store and game databases

async function readJson<T>(req: Request): Promise<T> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('bad content-type');
  return (await req.json()) as T;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, username, password } = await readJson<{ email: string; username: string; password: string }>(request);
    const e = (email ?? '').trim();
    const u = (username ?? '').trim();
    const p = (password ?? '');

    if (!e || !u || !p) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });
    }

    const storeConn = await storePool;
    
    // Start store transaction
    const storeTx = new mssql.Transaction(storeConn);
    
    await storeTx.begin();

    try {
      // 1) CI checks in Store (email + username)
      const dupe = await new mssql.Request(storeTx)
        .input('e', mssql.NVarChar(255), e)
        .input('u', mssql.NVarChar(50), u)
        .query(`
          SELECT 1
          FROM store.users
          WHERE email = @e
             OR username COLLATE SQL_Latin1_General_CP1_CI_AS = @u COLLATE SQL_Latin1_General_CP1_CI_AS
        `);
      if (dupe.recordset.length) {
        await storeTx.rollback();
        return new Response(JSON.stringify({ ok: false, error: 'Email or username already in use' }), { status: 409 });
      }

      // 🎮 GAME INTEGRATION POINT:
      // In a real implementation, you would:
      // 1. Get user's IP address
      // 2. Create MD5 hash of password for game compatibility
      // 3. Insert user into game database (tUser table)
      // 4. Get the game user ID from the insertion
      // This demo skips game account creation

      // Get IP for session tracking
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') || '127.0.0.1';

      // Create store user account
      const pwHash = await hashPassword(p);
      const sIns = await new mssql.Request(storeTx)
        .input('email', mssql.NVarChar(255), e)
        .input('un',    mssql.NVarChar(50),  u)
        .input('ph',    mssql.NVarChar(mssql.MAX), pwHash)
        .query(`
          INSERT INTO store.users (email, username, password_hash)
          OUTPUT inserted.id
          VALUES (@email, @un, @ph)
        `);
      const storeUserId = sIns.recordset[0].id as string;

      // 5) Create session
      const ses = await new mssql.Request(storeTx)
        .input('uid', mssql.UniqueIdentifier, storeUserId)
        .input('exp', mssql.DateTime2, addDays(new Date(), Number(process.env.SESSION_TTL_DAYS || '30')))
        .input('ua',  mssql.NVarChar(255), request.headers.get('user-agent') || null)
        .input('ip',  mssql.NVarChar(45),  ip)
        .query(`
          INSERT INTO store.sessions (user_id, expires_at, user_agent, ip)
          OUTPUT inserted.id
          VALUES (@uid, @exp, @ua, @ip)
        `);

      const sessionId = ses.recordset[0].id as string;
      
      await storeTx.commit();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Set-Cookie': setSessionCookie(sessionId),
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      await storeTx.rollback();
      console.error('[register] tx failed', err);
      return new Response(JSON.stringify({ ok: false, error: 'Registration failed' }), { status: 500 });
    }
  } catch (e) {
    console.warn('[register] bad request', e);
    return new Response(JSON.stringify({ ok: false, error: 'Bad request' }), { status: 400 });
  }
};