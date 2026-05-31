# Deploy Edge Functions - Quick Guide

## The Error: "Failed to send a request to the Edge Function"

This error means the Edge Function is **not deployed** to Supabase. The function code exists locally but needs to be deployed to your Supabase project.

## Solution: Deploy the Function

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. Click **Create a new function**
5. Name it: `mpesa-order-payment`
6. Copy and paste the code from `supabase/functions/mpesa-order-payment/index.ts`
7. Click **Deploy**

### Option 2: Using Supabase CLI (Recommended)

#### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

#### Step 2: Login to Supabase

```bash
supabase login
```

#### Step 3: Link Your Project

```bash
# Get your project reference ID from Supabase Dashboard > Settings > General
supabase link --project-ref ktoodrjfytteppnpyhvi
```

#### Step 4: Deploy the Function

```bash
# Navigate to your project directory
cd "c:\Users\Asaph Isweka\Downloads\Final solely app\solely-kenya"

# Deploy the M-Pesa order payment function
supabase functions deploy mpesa-order-payment

# Also deploy other required functions
supabase functions deploy mpesa-callback
supabase functions deploy process-delivery-fee-payment
supabase functions deploy auto-release-escrow
supabase functions deploy process-payouts
```

### Option 3: Manual Upload via Dashboard

1. Go to Supabase Dashboard > Edge Functions
2. Click **Create a new function**
3. Name: `mpesa-order-payment`
4. Copy the entire contents of `supabase/functions/mpesa-order-payment/index.ts`
5. Paste into the editor
6. Click **Deploy**

## Verify Deployment

After deploying:

1. Go to Supabase Dashboard > Edge Functions
2. You should see `mpesa-order-payment` in the list
3. Click on it to see details and logs

## Set Environment Variables (Secrets)

**IMPORTANT**: After deploying, set these secrets:

1. Go to **Project Settings** > **Edge Functions** > **Secrets**
2. Add these secrets:

```
MPESA_CONSUMER_KEY=VUOZt9q1JBoNlAxHULNGSdQaLUj9AyM8M5sgXU9X9noKnYdp
MPESA_CONSUMER_SECRET=YLj1KVJ2bM2zfyOnVoKRAeU5HAtsGiBRUGtpFQ1qkUb8dxjqJH73cLs1Hgl9P6Xl
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CALLBACK_URL=https://ktoodrjfytteppnpyhvi.supabase.co/functions/v1/mpesa-callback
```

## Test the Function

After deployment, test it:

1. Try making a test order in your app
2. Check the Edge Function logs in Supabase Dashboard
3. Look for any error messages

## Troubleshooting

### "Function not found"
→ The function isn't deployed. Deploy it using one of the methods above.

### "Unauthorized" or "401"
→ Make sure you're logged in when calling the function from the frontend.

### "Missing M-Pesa configuration"
→ Set all the required secrets in Supabase Dashboard.

### Function deployed but still not working
→ Check the function logs in Supabase Dashboard for detailed error messages.

## Required Functions to Deploy

Deploy these functions for full payment functionality:

1. ✅ `mpesa-order-payment` - Customer payments
2. ✅ `mpesa-callback` - Payment callbacks
3. ✅ `process-delivery-fee-payment` - Additional delivery fee payments
4. ✅ `auto-release-escrow` - Automatic escrow release
5. ✅ `process-payouts` - Vendor payouts
6. ✅ `stripe-create-payment-intent` - Card payments (if using Stripe)
7. ✅ `stripe-webhook` - Stripe payment callbacks (if using Stripe)

## Quick Deploy All Functions (CLI)

If you have Supabase CLI installed:

```bash
cd "c:\Users\Asaph Isweka\Downloads\Final solely app\solely-kenya"
supabase functions deploy mpesa-order-payment
supabase functions deploy mpesa-callback
supabase functions deploy process-delivery-fee-payment
supabase functions deploy auto-release-escrow
supabase functions deploy process-payouts
```

