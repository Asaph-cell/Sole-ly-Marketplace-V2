import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      store_name,
      products (
        id,
        status
      )
    `)
    .not("store_name", "is", null)
    .limit(10);
    
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data?.length) {
    console.log("First store:", JSON.stringify(data[0], null, 2));
  }
}

test();
