export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { getSessionId, clearSessionCookie } from '../../../lib/cookies';

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionId = getSessionId(request);
    
    if (sessionId) {
      const conn = await storePool;
      await conn.request()
        .input('sessionId', mssql.UniqueIdentifier, sessionId)
        .query('DELETE FROM store.sessions WHERE id = @sessionId');
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Set-Cookie': clearSessionCookie(),
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.error('[logout] error:', e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
};