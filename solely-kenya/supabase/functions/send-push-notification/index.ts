/**
 * Send Push Notification
 * 
 * This Edge Function sends Web Push notifications to users.
 * Uses the web-push protocol with VAPID authentication.
 * 
 * Environment Variables Required:
 * - VAPID_PUBLIC_KEY: Public VAPID key for Web Push
 * - VAPID_PRIVATE_KEY: Private VAPID key for Web Push
 * - VAPID_SUBJECT: Contact email (mailto:email@example.com)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
    userId: string;
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    orderId?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
        const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:notifications@solelymarketplace.com";

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.error("VAPID keys not configured");
            return new Response(
                JSON.stringify({ error: "Push notifications not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Configure web-push with VAPID keys
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const payload: PushPayload = await req.json();

        if (!payload.userId || !payload.title) {
            return new Response(
                JSON.stringify({ error: "userId and title are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch all subscriptions for this user
        const { data: subscriptions, error: fetchError } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", payload.userId);

        if (fetchError) {
            console.error("Error fetching subscriptions:", fetchError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch subscriptions" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log("No push subscriptions found for user:", payload.userId);
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Prepare notification payload
        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/pwa-192x192.png",
            badge: payload.badge || "/pwa-192x192.png",
            url: payload.url || "/vendor/orders",
            tag: payload.tag || `order-${payload.orderId || Date.now()}`,
            orderId: payload.orderId,
        });

        // Send to all subscriptions
        const results = await Promise.all(
            subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                try {
                    await webpush.sendNotification(pushSubscription, notificationPayload, {
                        TTL: 86400, // 24 hours
                        urgency: "high",
                    });
                    console.log("Push sent successfully to:", sub.endpoint.slice(0, 50));
                    return { success: true, id: sub.id };
                } catch (error: any) {
                    console.error("Push failed for subscription:", sub.id, error.message);

                    // If subscription expired or invalid, remove it
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                        console.log("Removed expired subscription:", sub.id);
                    }

                    return { success: false, id: sub.id, error: error.message };
                }
            })
        );

        const successCount = results.filter(r => r.success).length;
        console.log(`Push notifications sent: ${successCount}/${subscriptions.length}`);

        return new Response(
            JSON.stringify({
                success: true,
                sent: successCount,
                total: subscriptions.length,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
