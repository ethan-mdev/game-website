import { serialize, parse } from 'cookie';

const NAME = process.env.SESSION_COOKIE_NAME || 'Game.sid';
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || '30');

export function setSessionCookie(sessionId: string) {
  return serialize(NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  return serialize(NAME, '', { path: '/', maxAge: 0 });
}

export function getSessionId(req: Request) {
  const jar = parse(req.headers.get('cookie') || '');
  return jar[NAME] || null;
}
