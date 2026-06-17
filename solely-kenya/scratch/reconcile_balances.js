import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const intaSendKey = process.env.INTASEND_SECRET_KEY || 'ISSecretKey_live_cd28a688-4000-46d9-869a-b4a69649c5e7';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function reconcileBalances() {
  console.log("Starting reconciliation...");

  const { data: balances, error } = await supabase
    .from('vendor_balances')
    .select('vendor_id, pending_balance, intasend_wallet_id');

  if (error || !balances) {
    console.error("Failed to fetch balances:", error);
    return;
  }

  console.log(`Found ${balances.length} vendors.`);

  for (const record of balances) {
    if (!record.intasend_wallet_id) {
      console.log(`Vendor ${record.vendor_id} has no wallet. Skipping.`);
      continue;
    }

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
        const { error: updateError } = await supabase
          .from('vendor_balances')
          .update({ pending_balance: actualWalletBalance })
          .eq('vendor_id', record.vendor_id);
          
        if (updateError) {
          console.error(`-> Update failed:`, updateError);
        } else {
          console.log(`-> Fixed successfully!`);
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
