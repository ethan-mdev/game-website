export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

const ALLOWED_IMAGES = [
  'avatar-1.png',
  'avatar-2.png', 
  'avatar-3.png',
];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    // Parse request
    const { profileImage } = await request.json() as { profileImage: string };
    
    if (!profileImage || !ALLOWED_IMAGES.includes(profileImage)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid profile image' }), { status: 400 });
    }

    const storeConn = await storePool;

    // Update user's profile image
    await storeConn.request()
      .input('userId', mssql.UniqueIdentifier, user.id)
      .input('profileImage', mssql.NVarChar(50), profileImage)
      .query(`
        UPDATE store.users 
        SET profile_image = @profileImage
        WHERE id = @userId
      `);

    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Profile image updated successfully' 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[update-profile-image] error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'Failed to update profile image' 
    }), { status: 500 });
  }
};