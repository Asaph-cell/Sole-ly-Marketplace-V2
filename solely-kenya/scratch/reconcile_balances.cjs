const { execSync } = require('child_process');
const fs = require('fs');

const intaSendKey = process.env.INTASEND_SECRET_KEY || 'ISSecretKey_live_cd28a688-4000-46d9-869a-b4a69649c5e7';

async function reconcileBalances() {
  console.log("Starting reconciliation...");

  // 1. Fetch from supabase db query
  console.log("Fetching DB balances...");
  let dbOutput;
  try {
    dbOutput = execSync(`npx supabase db query --linked "SELECT json_agg(t) FROM (SELECT vendor_id, pending_balance, intasend_wallet_id FROM vendor_balances WHERE intasend_wallet_id IS NOT NULL) t;"`).toString();
  } catch (err) {
    console.error("Supabase query failed");
    process.exit(1);
  }

  // extract JSON
  const match = dbOutput.match(/\[.*\]/s);
  if (!match) {
    console.error("Could not parse json from supabase output");
    return;
  }
  
  const balances = JSON.parse(match[0]);
  console.log(`Found ${balances.length} vendors with wallets.`);

  for (const record of balances) {
    try {
      const response = await fetch(`https://api.intasend.com/api/v1/wallets/${record.intasend_wallet_id}/`, {
        headers: {
          'Authorization': `Bearer ${intaSendKey}`,
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch wallet ${record.intasend_wallet_id}. Status: ${response.status}`);
        continue;
      }

      const walletData = await response.json();
      const actualWalletBalance = walletData.current_balance;

      const dbBalance = Number(record.pending_balance);

      if (Math.abs(dbBalance - actualWalletBalance) > 1) {
        console.log(`\n[MISMATCH] Vendor: ${record.vendor_id}`);
        console.log(`DB Balance: KES ${dbBalance}`);
        console.log(`Wallet Balance: KES ${actualWalletBalance}`);
        
        console.log(`-> Fixing DB balance to match wallet...`);
        try {
          execSync(`npx supabase db query --linked "UPDATE vendor_balances SET pending_balance = ${actualWalletBalance} WHERE vendor_id = '${record.vendor_id}';"`);
          console.log(`-> Fixed successfully!`);
        } catch (err) {
          console.error(`-> Update failed`);
        }
      } else {
        console.log(`[OK] Vendor ${record.vendor_id.slice(0, 8)}... matched (KES ${dbBalance})`);
      }
    } catch (err) {
      console.error(`Error processing vendor ${record.vendor_id}:`, err);
    }
  }

  console.log("\nReconciliation complete.");
}

reconcileBalances();
