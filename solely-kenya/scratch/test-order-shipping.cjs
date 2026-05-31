const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('orders').select('*, vendor:vendor_id(store_name, full_name, whatsapp_number), order_shipping_details(*)').limit(1).single();
  console.log('Error:', error);
  console.log('Order shipping details isArray:', Array.isArray(data?.order_shipping_details));
}
test();
