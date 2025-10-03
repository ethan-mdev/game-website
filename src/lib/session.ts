// src/lib/session.ts
import mssql from 'mssql';
import { storePool } from './db';
import { getSessionId } from './cookies';

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  game_user_no: number;
  profile_image?: string;
  account_balance?: number;
  characters?: GameCharacter[];
  roles?: string[]; // e.g. ['admin', 'moderator']
}

export interface GameCharacter {
  charNo: number;
  name: string;
  level: number;
  class: string;
  classId: number;
}

export async function validateSession(request: Request): Promise<SessionUser | null> {
  try {
    const sessionId = getSessionId(request);
    if (!sessionId) return null;

    const storeConn = await storePool;

    // Get user
    const userRs = await storeConn.request()
      .input('sessionId', mssql.UniqueIdentifier, sessionId)
      .query(`
        SELECT u.id, u.username, u.email, u.game_user_no, u.profile_image, u.account_balance
        FROM store.sessions s
        JOIN store.users u ON s.user_id = u.id
        WHERE s.id = @sessionId
          AND s.expires_at > SYSUTCDATETIME()
      `);

    if (!userRs.recordset.length) return null;
    const user = userRs.recordset[0] as SessionUser;

    // Roles
    const roleRs = await storeConn.request()
      .input('userId', mssql.UniqueIdentifier, user.id)
      .query(`
        SELECT r.name
        FROM store.user_roles ur
        JOIN store.roles r ON r.id = ur.role_id
        WHERE ur.user_id = @userId
        ORDER BY r.name
      `);

    user.roles = roleRs.recordset.map(r => r.name as string);

    // 🎮 GAME INTEGRATION POINT:
    // In a real implementation, you would load player characters here:
    // 1. Connect to world database using worldPool
    // 2. Query Character table for user's characters
    // 3. Map character data (name, level, class, etc.)
    
    user.characters = []; // Demo: no character loading

    return user;
  } catch (err) {
    console.error('Session validation failed:', err);
    return null;
  }
}


// Character class mapping removed for demo
// In a real implementation, you would map game class IDs to names