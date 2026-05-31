const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ktoodrjfytteppnpyhvi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('order_shipping_details')
      .select('gps_latitude')
      .limit(1);

    console.log("Select Error:", error);
    console.log("Select Data:", data);
  } catch (err) {
    console.error("Catch error:", err);
  }
}

run();
