export const prerender = false;

import type { APIRoute } from 'astro';
import mssql from 'mssql';
import { storePool } from '../../../lib/db';
import { validateSession } from '../../../lib/session';

// Define credit packages (should match frontend)
const creditPackages = [
  { id: 1, name: "Starter Pack", credits: 1000, bonus: 0, price: 4.99 },
  { id: 2, name: "Adventure Pack", credits: 2500, bonus: 250, price: 9.99 },
  { id: 3, name: "Hero Pack", credits: 5000, bonus: 750, price: 19.99 },
  { id: 4, name: "Legend Pack", credits: 10000, bonus: 2000, price: 34.99 },
  { id: 5, name: "Ultimate Pack", credits: 25000, bonus: 6250, price: 79.99 },
  { id: 6, name: "Mega Pack", credits: 50000, bonus: 15000, price: 149.99 }
];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validate session
    const user = await validateSession(request);
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), { status: 401 });
    }

    // Parse request
    const { packageId } = await request.json() as { packageId: number };
    
    console.log('[credit-purchase] Received request:', { packageId, userId: user.id });
    
    if (!packageId) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid package' }), { status: 400 });
    }

    // Find the package
    const selectedPackage = creditPackages.find(pkg => pkg.id === packageId);
    if (!selectedPackage) {
      return new Response(JSON.stringify({ ok: false, error: 'Package not found' }), { status: 404 });
    }

    const storeConn = await storePool;

    // Start transaction
    const transaction = new mssql.Transaction(storeConn);
    await transaction.begin();

    try {
      const totalCredits = selectedPackage.credits + selectedPackage.bonus;
      
      // Generate a simple transaction ID for demo purposes
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Insert purchase history record
      await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('packageName', mssql.NVarChar(100), selectedPackage.name)
        .input('creditsPurchased', mssql.Int, selectedPackage.credits)
        .input('bonusCredits', mssql.Int, selectedPackage.bonus)
        .input('totalCredits', mssql.Int, totalCredits)
        .input('amountPaid', mssql.Decimal(10, 2), selectedPackage.price)
        .input('transactionId', mssql.NVarChar(100), transactionId)
        .query(`
          INSERT INTO store.user_credit_history 
          (user_id, package_name, credits_purchased, bonus_credits, total_credits, amount_paid, transaction_id)
          VALUES (@userId, @packageName, @creditsPurchased, @bonusCredits, @totalCredits, @amountPaid, @transactionId)
        `);

      // Update user's credit balance
      await transaction.request()
        .input('userId', mssql.UniqueIdentifier, user.id)
        .input('creditsToAdd', mssql.Int, totalCredits)
        .query(`
          UPDATE store.users 
          SET account_balance = account_balance + @creditsToAdd
          WHERE id = @userId
        `);

      // Commit transaction
      await transaction.commit();

      console.log(`[credit-purchase] Successfully processed purchase: ${selectedPackage.name} for user ${user.id}`);

      return new Response(JSON.stringify({ 
        ok: true, 
        message: `Successfully purchased ${selectedPackage.name}!`,
        package: selectedPackage.name,
        creditsAdded: totalCredits,
        transactionId: transactionId
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      await transaction.rollback();
      throw dbError;
    }

  } catch (error) {
    console.error('[credit-purchase] error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: 'Purchase failed' 
    }), { status: 500 });
  }
};