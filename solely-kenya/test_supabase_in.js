import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://xyz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.xyz');

async function test() {
  try {
    const res = await supabase.from('products').select('*').not('id', 'in', '()');
    console.log("Success:", res);
  } catch (e) {
    console.log("Error:", e.message);
  }
}

test();
