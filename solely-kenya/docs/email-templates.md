# Email Notification Templates for Solely Marketplace

## Overview
Email templates for vendor and buyer notifications. These can be implemented using Supabase Edge Functions or integrated email service (SendGrid, Postmark, etc.).

---

## 1. Payout Confirmation Email (to Vendor)

**Subject:** 💰 Payout Processed - KES {amount} sent to your M-Pesa

**Body:**
```
Hello {vendor_name},

Great news! Your payout has been processed successfully.

Order Details:
- Order ID: #{order_id}
- Product: {product_name}
- Sale Amount: KES {total_amount}
- Commission (6%): KES {commission_amount}
- Your Payout: KES {payout_amount}

MPESA Payment:
- M-Pesa Number: {mpesa_number}
- Amount Sent: KES {payout_amount}
- Transaction ID: {mpesa_receipt}
- Status: Completed

The funds should appear in your M-Pesa account within a few minutes. If you don't receive the payment within 1 hour, please contact us.

Need help? Reply to this email or contact support@solelymarketplace.com

Happy selling!
Solely Team
```

---

## 2. New Order Notification (to Vendor)

**Subject:** 🛍️ New Order #{order_id} - Action Required!

**Body:**
```
Hello {vendor_name},

You have a new order! Please review and confirm within 24 hours.

Order Details:
- Order ID: #{order_id}
- Product: {product_name}
- Quantity: {quantity}
- Total: KES {total_amount}
- Delivery Type: {delivery_type}

Customer Delivery Address:
{delivery_address}
{city}, {county}
Phone: {customer_phone}

Next Steps:
1. Review the order details
2. Confirm you have the item in stock
3. Accept the order in your dashboard
4. Ship within 3 days after acceptance

Important:
- Delivery fee (KES {delivery_fee}) included in total - use this to arrange delivery
- If you don't confirm within 24 hours, the order will be auto-cancelled

[View Order in Dashboard]

Solely Team
```

---

## 3. Delivery Confirmation Request (to Buyer)

**Subject:** 📦 Your order #{order_id} has been shipped!

**Body:**
```
Hello {buyer_name},

Good news! Your order has been shipped by {vendor_name}.

Order Details:
- Order ID: #{order_id}
- Product: {product_name}
- Tracking Info: {tracking_info}
- Expected Delivery: Within 3 days

Vendor Contact:
- WhatsApp: {vendor_whatsapp}
- You can contact them for delivery updates

Important - Escrow Protection:
Your payment (KES {amount}) is held securely in escrow. Follow these steps when your order arrives:

1. Inspect the item carefully
2. Confirm delivery in your dashboard if satisfied
3. OR file a dispute if there's an issue (within 72 hours)

⚠️ Auto-Release: If you don't confirm or dispute within 72 hours, funds will be automatically released to the vendor.

[Confirm Delivery] [View Order] [File Dispute]

Need help? Reply to this email or contact support@solelymarketplace.com

Solely Team
```

---

## 4. Payment Failed Notification (to Buyer)

**Subject:** ⚠️ Payment Issue - Order #{order_id}

**Body:**
```
Hello {buyer_name},

We encountered an issue processing your payment for order #{order_id}.

Order Details:
- Product: {product_name}
- Amount: KES {amount}
- Payment Method: {payment_method}

Your order is still pending payment. Please retry payment within 24 hours or the order will be cancelled.

[Retry Payment Now]

If you continue experiencing issues, please try a different payment method or contact support.

Solely Team
```

---

## Implementation Notes

### Using Supabase Edge Functions:
1. Create function in `supabase/functions/send-email/`
2. Use Resend, SendGrid, or Postmark API
3. Trigger from database webhooks or directly from application

### Environment Variables Needed:
```
EMAIL_SERVICE_API_KEY=your_api_key
FROM_EMAIL=noreply@solelymarketplace.com
SUPPORT_EMAIL=support@solelymarketplace.com
```

### Recommended Service:
- **Resend** (easiest Supabase integration, modern)
- **SendGrid** (reliable, good free tier)
- **Postmark** (excellent deliverability)

### Triggers:
- **Payout Email**: After payout status = 'paid' in payouts table
- **New Order**: After order status = 'pending' created
- **Shipped**: After order status = 'shipped'  
- **Payment Failed**: After payment status = 'failed'
