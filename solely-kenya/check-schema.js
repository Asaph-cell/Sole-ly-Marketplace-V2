import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://x.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'x';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error('Error fetching orders:', error);
  } else if (data && data.length > 0) {
    console.log('Orders columns:', Object.keys(data[0]));
  } else {
    console.log('No orders found, cannot infer schema this way. Error:', error);
  }
}

checkSchema();
