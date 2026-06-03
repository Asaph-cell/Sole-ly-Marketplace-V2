const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf8');
const url = dotenv.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = dotenv.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();

fetch(url + '/rest/v1/orders?select=id,status,total_ksh&order=created_at.desc&limit=1', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(r => r.json())
.then(async orders => {
  console.log("Latest Order:", orders);
  if (orders.length > 0) {
    const orderId = orders[0].id;
    
    // Simulate webhook
    const payload = {
      invoice_id: "TEST_INV_" + Math.random(),
      state: "COMPLETE",
      api_ref: orderId,
      value: orders[0].total_ksh,
      currency: "KES"
    };
    
    console.log("Sending mock webhook with payload:", payload);
    const res = await fetch(url + '/functions/v1/intasend-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    console.log("Webhook Response Status:", res.status);
    console.log("Webhook Response Body:", text);
  }
});
