
const webhookUrl = "https://ktoodrjfytteppnpyhvi.supabase.co/functions/v1/intasend-webhook";

const payload = {
    invoice_id: "test_invoice",
    state: "COMPLETE",
    api_ref: "00000000-0000-0000-0000-000000000000",
    value: 100,
    account: "254700000000",
    name: "Test User",
    retail_price: 100,
    net_amount: 95,
    currency: "KES",
    failed_reason: null,
    created_at: "2026-01-11T18:00:00Z",
    updated_at: "2026-01-11T18:05:00Z"
};

console.log("Sending webhook test to:", webhookUrl);

try {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    console.log("Response Status:", response.status);
    const text = await response.text();
    console.log("Response Body:", text);
} catch (error) {
    console.error("Fetch error:", error);
}
