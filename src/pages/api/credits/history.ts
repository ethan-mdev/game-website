export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Validate session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    const storeConn = await storePool;

    // Get user's credit purchase history
    const historyResult = await storeConn.request()
      .input('userId', mssql.UniqueIdentifier, user.id)
      .query(`
        SELECT 
          id,
          package_name,
          credits_purchased,
          bonus_credits,
          total_credits,
          amount_paid,
          payment_method,
          transaction_id,
          status,
          purchased_at
        FROM store.user_credit_history 
        WHERE user_id = @userId 
        ORDER BY purchased_at DESC
      `);

    const history = historyResult.recordset.map(record => ({
      id: record.id,
      packageName: record.package_name,
      creditsPurchased: record.credits_purchased,
      bonusCredits: record.bonus_credits,
      totalCredits: record.total_credits,
      amountPaid: record.amount_paid,
      paymentMethod: record.payment_method,
      transactionId: record.transaction_id,
      status: record.status,
      purchasedAt: record.purchased_at
    }));

    return new Response(JSON.stringify({ 
      ok: true, 
      history: history 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[credit-history] error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'Failed to load purchase history' 
    }), { status: 500 });
  }
};