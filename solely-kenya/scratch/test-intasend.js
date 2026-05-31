const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ktoodrjfytteppnpyhvi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch an active payment link
    const { data: links, error: fetchError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (fetchError || !links || links.length === 0) {
      console.error("Error fetching payment links:", fetchError);
      return;
    }

    const link = links[0];
    console.log("Found payment link ID:", link.id);

    // 2. Invoke the edge function with checkout payload
    const { data, error } = await supabase.functions.invoke('intasend-initiate-payment', {
      body: {
        checkoutPayload: {
          paymentLinkId: link.id,
          buyerName: "Test Buyer",
          buyerPhone: "0712345678",
          buyerEmail: "test@example.com",
          address: "Nairobi Central, Nairobi",
          city: "Nairobi",
          county: "Nairobi County",
          gpsLat: -1.2921,
          gpsLng: 36.8219,
          googleMapsLink: "https://maps.google.com/?q=-1.2921,36.8219",
          notes: "Please leave at reception",
          customerId: null
        },
        successUrl: "http://localhost:5173/track/__ORDER_ID__?payment_success=true",
        cancelUrl: `http://localhost:5173/pay/${link.id}?cancelled=true`
      }
    });

    console.log("Edge Function Response Data:", data);
    console.log("Edge Function Response Error:", error);
  } catch (err) {
    console.error("Catch error:", err);
  }
}

run();
