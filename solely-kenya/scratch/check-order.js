import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('*, payments(*), escrow_transactions(*)')
    .order('created_at', { ascending: false })
    .limit(3);

  if (orderError) {
    console.error("Order Error:", orderError);
    return;
  }
  
  console.log("Latest Orders:", JSON.stringify(orders, null, 2));
}

check();
