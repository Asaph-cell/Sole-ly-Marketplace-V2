const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ktoodrjfytteppnpyhvi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, customer_id, status, total_ksh, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log("Error:", fetchError);
    console.log("Last 5 orders in database:", JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error("Catch error:", err);
  }
}

run();
