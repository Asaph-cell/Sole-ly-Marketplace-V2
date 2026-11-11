# Solely Dispute & Delivery Resolution System: Spec

Status: **built** (2026-10-07), not yet deployed. See section 11 for what was built and the deploy order.

---

## 1. Principles

1. **The system decides when the data is clear.** Timers, missed deadlines and silence get resolved automatically. Subjective quality complaints go to buyer–vendor chat first, and admin only steps in when chat gets stuck.
2. **Fault decides who pays.**
   - Vendor's fault: the vendor covers all shipping, including return collection.
   - Buyer's fault: the delivery fee is deducted and the buyer is refunded the product amount only.
3. **No change-of-mind returns.** Once shipped, goods cannot be returned unless they are damaged, not as described, or not what was ordered.
4. **Commission is charged on products only** and never on the delivery fee. A fully refunded order earns no commission. A partial refund earns commission only on the vendor's remaining share.
5. **Solely absorbs the refund transaction cost** whenever the buyer is owed their full amount.
6. **Every automatic decision can be appealed to admin** by either party within 48h.
7. **Every time window is admin-editable** in Admin > Settings > Time windows (`platform_settings`), using the same pattern as the existing settings.

---

## 2. Hours

| Clock | Rule |
|---|---|
| **Vendor shipping clock (A1)** | Paused from **6pm to 7am** every day. Vendors may accept orders at night, but the clock only counts daytime hours. |
| **Solely support hours** | **8am to 5pm**, every day. Admin calls (B3) and escalations are handled during these hours. |
| **Delivery windows (A4)** | Run 24/7. The windows are already long enough to span nights. |
| **6h payment-release window** | Also paused from **6pm to 7am**, so a buyer who is asleep can't miss both prompts and have the money release at 2am. The second prompt goes out 2 counted hours before release. |

---

## 3. New order flow (the Package PIN is removed)

```
paid → pending_vendor_confirmation → accepted → (packing checklist) → shipped → arrived → completed
                                         │                              │           │
                                       A1 clock                       A4 clock    6h release window
```

### 3.1 Packing checklist (prevents A5, A7 and A8)
Before **Mark as shipped** is enabled, the vendor must:
1. Confirm a checklist built automatically from the order's items. For each line they tick the product, size or variant, colour and quantity.
2. Add a short description of the goods, for example "Black Nike AF1, size 42, in a white box".
3. Optionally attach a photo of the packed goods.

The checklist is then:
- posted to the buyer in the order chat, and
- emailed to the buyer, which also covers guests and anyone who can't open the chat.

The message reads: *"This is what is being shipped: … If this is not what you ordered, tap 'This is wrong' or call the vendor now."*

- **Buyer taps "This is wrong":** shipping is **blocked**. The vendor sees the objection in chat. They either fix the checklist, or the buyer approves it.
- **Buyer doesn't respond within 2h:** the block lifts and shipping can go ahead. The buyer keeps all dispute rights.

The checklist is also the "packed" record that A7 (missing items) compares against.

### 3.2 Delivery confirmation (replaces the PIN)
1. Vendor marks the order **Arrived**, which starts the **6h release window**.
2. The buyer's OTP becomes visible from Arrived onwards, with the warning: *"Only share this after you have the item in hand and have checked it."*
3. The buyer is asked **"Did you receive your order?"** twice:
   - straight away at Arrived
   - again 2h before release, at the 4h mark

   Both prompts go out by push, email and SMS (SMS once the account exists).
4. The buyer can respond in one of three ways:
   - **"Yes, received":** payment releases to the vendor immediately.
   - **Gives the OTP to the vendor or courier:** the vendor enters it and payment releases immediately.
   - **"Not received / There's a problem":** the dispute page opens and the payout is **held** until it's resolved.
5. **No response by 6h:** payment auto-releases to the vendor.

Known risk, accepted on purpose: a vendor could falsely mark an order Arrived while the buyer misses every prompt. The safeguards are:
- three channels: push, email and SMS
- the buyer can still report afterwards, which leads to a strike, and held funds from the vendor's later orders can be withheld to refund the buyer, as the Terms already allow.

---

## 4. Rules by complaint

### A1: Vendor accepted but didn't ship
| When (counting daytime hours only) | What happens |
|---|---|
| 1h after acceptance | Email the vendor: "Ship this order. Shipping is expected within 3 hours." |
| 3h | Reminder: email + push + SMS. |
| **8h** | **Full refund to the buyer** (product + delivery fee), the order is cancelled, and the vendor gets a **strike**. Solely pays the refund cost. |

- **Vendor reply extends the deadline:** if the vendor replies with an update, for example "still packing, it's a big order", **3h is added** to the deadline. The reply is forwarded to the buyer in chat and by email. Packaging delays happen.
- Extensions are capped at **2**, so the latest possible deadline is 14 daytime hours. After that it goes to admin rather than an automatic refund, the same way A4 works.
- **Vendor doesn't reply:** no extension, and the refund and strike happen at the deadline.
- A11 (vendor cancels after payment): instant full refund, and **no strike**. A vendor who cancels has at least said why, unlike one who accepts and goes silent.

### A4: Shipped but not arrived (late)
Each delivery window starts when the order is marked **shipped**. Distance comes from the vendor's county and town versus the buyer's.

| Route | Window |
|---|---|
| Same town | 24h |
| Same county | 24h |
| Different county | 48h |
| Border or coast within Kenya, e.g. Nairobi to Mombasa | 72h |
| Outside Kenya, within East Africa | 10 days |

How the clock runs:
1. With **6h left**, the system asks the vendor in chat, email and push: "Where are the goods? Reply with an update or the buyer will be refunded."
2. **Vendor replies:** the reply is forwarded to the buyer and **24h is added** to the window.
3. With 6h left on the new deadline, the vendor is asked again, and the same thing happens.
4. **At most 3 extensions.** After that the order goes to **admin**, not to an automatic refund, because the goods may really still be coming.
5. **Vendor doesn't reply by the deadline:** full refund to the buyer and a **strike**.
6. **The delivery fee is not refunded** just for lateness while the goods are still coming, because accidents happen.

### A2: Doesn't match the description
- Buyer and vendor negotiate in chat using **structured offers**:
  - partial refund of KSh X
  - replacement
  - full refund with the item returned
- When the buyer accepts an offer, the money moves automatically.
- It is the vendor's fault, so the vendor pays all shipping.
- **Stuck** means there's no agreement within **48h**, or either party taps **"Ask Solely to decide"**. Either one sends the dispute to admin.

### A3: Damaged, broken or torn, and A10: defective on arrival
- Same chat and offers flow as A2. Usually the vendor replaces the item.
- The vendor collects the item at their own cost and can bring the correct one.
- **No offer from the vendor within 48h:** the buyer is refunded in full.
- The item must be returned unless the vendor waives the return.

### A5: Wrong product, and A8: wrong size, colour or variant
- The packing checklist (3.1) is meant to prevent these.
- If it happens anyway:
  1. The vendor admits it in chat.
  2. The vendor collects the item at their own cost.
  3. The vendor sends the correct item or refunds the buyer.
- Return handover is covered in section 5.

### A7: Items missing from the order
- The system compares the checklist against what was ordered.
- The buyer reports the missing items, which opens a dispute.
- The vendor has **36h** to send the missing items, at their own cost.
- **Not received in 36h:** the buyer chooses between a **refund of the missing items' price** and accepting the order as it is.

### A9: Received someone else's order
- The buyer reports it and the vendor has **24h** to swap the packages.
- **Not corrected in 24h:** the buyer is refunded and the vendor is notified. The buyer may also ask for the refund straight away, without waiting the 24h.
- The other buyer, whose order went to the wrong person, gets the same treatment on their own order.

### A12: Buyer far away or not responding
This is covered by the confirmation flow (3.2): the buyer is asked twice, then payment auto-releases.

### A6 / B1: Abusive buyers
- The system counts disputes the buyer **lost** in a rolling **90 days**. Disputes filed don't count.
- **3 lost:** flagged to admin.
- **5 lost:** automatically suspended. Admin can lift the suspension.

### B2: Return shipping costs
- Fault decides who pays. See the principles in section 1.
- No change-of-mind returns.

### B3: Buyer unreachable at delivery
1. The vendor taps **"Buyer unavailable"**. GPS proof is **not** required, because errand riders often don't have GPS.
2. Straight away:
   - the buyer gets push, email and SMS: "The vendor is at your location"
   - **admins get an email**
   - the vendor is shown: "Please keep waiting. Solely is contacting the buyer."
3. The Solely team calls the buyer within **10–15 min** (during support hours).
4. The buyer has a **12h grace period** to respond or explain.
   - **Buyer responds:** delivery is rescheduled once. A second failed attempt is treated as no response.
   - **No response:** the order is cancelled. The vendor keeps the **delivery fee only** and the buyer gets the product price back.
5. **The vendor lied** (the call shows the buyer was there): admin **cancels the claim** and the vendor gets a **strike**.
- If the button is pressed outside support hours, the vendor is shown: "Solely will call the buyer when support opens at 8am." The 12h grace period runs as normal.

### B4: Buyer tries to cancel after shipping
- The Cancel button is **blocked** once an order is shipped.
- **Buyer refuses delivery:** handled like B3. The vendor keeps the delivery fee and the buyer is refunded the product price.

---

## 5. Returns handover (A3, A5, A8, A10)
Most returns won't have a courier receipt, so the steps are:
1. The vendor arranges collection with their own rider, at their own cost.
2. The buyer taps **"Handed it back"** and can add a note or photo, such as the rider's name or the time.
3. The vendor has **48h** to confirm receipt or dispute it.
4. **Vendor stays silent for 48h:** the buyer is refunded automatically.

---

## 6. Vendor strikes & suspension
- **Strikes are given for:**
  - accepting an order and never delivering it (A1 deadline missed with no reply, A4 no reply)
  - a false "Buyer unavailable" claim
- **No strike** when a vendor cancels an order (A11).
- **Each strike** gets an in-app notice and an email. The 2nd strike email is a stronger, final warning.
- **3rd strike within a rolling 90 days:** the vendor is automatically **suspended**.
- Strikes expire 90 days after they were given.
- **What suspension does:**
  - all listings are hidden
  - the vendor can't add listings and can't sell
  - **existing orders continue**, so they finish those
  - it lasts until an admin restores the vendor
- Admin can view, add and void strikes, and every action is logged in `admin_activity_log`.

---

## 7. Chat and guests
- **One chat per order**, created at payment. It carries system messages (the checklist, A4 check-ins, offers), and any dispute happens inside the same thread.
- **Guest buyers** have no account. They get an **emailed link** to a page that works without logging in, where they can confirm receipt, report a problem, reply in chat and accept offers.
- Anything sent to the chat that matters is **also sent by email**, and by SMS for anything urgent.

---

## 8. Notifications
| Event | Buyer | Vendor | Admin |
|---|---|---|---|
| Packing checklist posted | chat + email | n/a | n/a |
| Buyer objects to checklist | n/a | chat + push + email | n/a |
| A1 reminders (1h, 3h) | n/a | email (+ push + SMS at 3h) | n/a |
| A1 or A4 refund | email + SMS | email + strike notice | n/a |
| A4 check-in / vendor reply | reply forwarded via chat + email | check-in via chat + email + push | n/a |
| A4 cap of 3 extensions reached | email | email | **email** |
| Arrived → "Did you receive?" ×2 | push + email + SMS | n/a | n/a |
| Buyer unavailable | push + email + SMS | "keep waiting" notice | **email (immediate)** |
| Dispute opened / offer / escalation | chat + email | chat + email | email on escalation |
| Strike / suspension | n/a | email + in-app | listed in admin dashboard |

SMS goes through **Africa's Talking** (provider still to be decided). The account will be created later, so until then all SMS calls fail quietly and email and push still go out.

---

## 9. New platform settings
`a1_first_reminder_hours`=1, `a1_expected_ship_hours`=3, `a1_refund_hours`=8, `a1_extension_hours`=3, `a1_max_extensions`=2, `clock_pause_start`="18:00", `clock_pause_end`="07:00", `support_hours`="08:00-17:00", `delivery_window_same_town_hours`=24, `delivery_window_same_county_hours`=24, `delivery_window_other_county_hours`=48, `delivery_window_far_hours`=72, `delivery_window_east_africa_hours`=240, `a4_checkin_before_hours`=6, `a4_extension_hours`=24, `a4_max_extensions`=3, `release_window_hours`=6 (replaces `pin_release_hours`), `release_second_prompt_before_hours`=2, `checklist_objection_block_hours`=2, `negotiation_stuck_hours`=48, `vendor_offer_deadline_hours`=48, `a7_fix_hours`=36, `a9_fix_hours`=24, `return_confirm_hours`=48, `buyer_unavailable_grace_hours`=12, `appeal_window_hours`=48, `strike_window_days`=90, `strikes_to_suspend`=3, `buyer_lost_disputes_flag`=3, `buyer_lost_disputes_suspend`=5.

---

## 10. Build order
1. **Fix the two open payout bugs** in `transfer-to-vendor-wallet`, since every dispute outcome moves money through it.
2. **Data model:**
   - order chat thread
   - `order_packing_checklists`
   - `vendor_strikes`
   - vendor suspension flag and RLS so suspended vendors' listings are hidden
   - `dispute_offers`
   - `order_deadlines` (one row per active timer, with extensions)
   - buyer lost-dispute counter
   - new settings
3. **Remove the Package PIN** and wire up the new confirmation flow: Arrived starts the 6h window, there are two prompts, the "Yes" tap releases payment, and the OTP is kept.
4. **Packing checklist** UI and the rule that blocks shipping until it's done.
5. **Timer engine:** one scheduled function that evaluates `order_deadlines` for A1, A4, the release window, A7, A9, returns and B3, with the night pause applied. It replaces `auto-refund-unshipped`, `auto-cancel-stale-orders` and `auto-release-escrow`.
6. **Strikes and suspension**, plus the admin tools for them.
7. **Chat offers and negotiation** for A2, A3, A5, A8 and A10, plus the escalation to admin.
8. **"Buyer unavailable"** flow and the admin action to cancel a false claim.
9. **Guest dispute pages**, reached by an emailed token link.
10. **Abusive-buyer tracking.**
11. **SMS** through Africa's Talking, once the account exists.
12. **Update the Terms, How It Works and email templates**, removing all mention of the PIN.

---

## 11. Implementation notes (built 2026-10-07)

**Where things live**
- Database: `supabase/migrations/20261007000100_dispute_system.sql`
- Every buyer and vendor button: `functions/order-action`
- Every clock: `functions/order-engine`, scheduled every 5 minutes (see `cron-jobs-setup.sql`)
- Money in and out: `functions/_shared/order-money.ts`
- Screens: `src/components/orders/*` and `src/components/disputes/DisputePanel.tsx`

**Simplifications compared with the spec**
- **No separate order chat.** Order updates are posted into the buyer–vendor chat that already exists (`messages`, type `order_update`) and emailed. Disputes keep their own chat, folded behind a "Messages" link.
- **No guest dispute pages.** Checkout already requires an account, so every order has a logged-in buyer.
- **Buyers don't make offers.** Vendors offer a fix; buyers accept, decline or "Ask Solely to decide". The backend allows buyer offers if wanted later.
- **East Africa window not detected automatically.** The 10-day setting exists, but shipping addresses have no country field yet.

**Existing bugs fixed along the way**
- Payments never auto-released: the release job only looked at the PIN-era `delivered` status.
- Auto-cancelled orders were never refunded, and the job failed on its first step anyway (it wrote to a column that doesn't exist).
- Vendor "decline" emailed "refund processed" but never refunded.
- An admin partial refund also paid the vendor their full original share.

**Deploy order** (all together, or the old screens will hit the new status lock):
1. Run the migration.
2. Deploy the edge functions: `order-action`, `order-engine`, `verify-delivery-otp`, `process-refund`, `resolve-dispute`, `auto-cancel-stale-orders`, `admin-action`, `transfer-to-vendor-wallet`.
3. Delete the retired functions: `auto-release-escrow`, `auto-refund-unshipped`, `verify-package-pin`, `generate-delivery-otp`.
4. Swap the cron jobs: unschedule `auto-release-escrow` and `auto-dispute-undelivered`, schedule `order-engine`.
5. Deploy the frontend.
6. Optional: set the `SITE_URL` secret. SMS stays off until `AFRICASTALKING_API_KEY` and `AFRICASTALKING_USERNAME` are set.

## 12. Decisions log (2026-10-07)
1. The vendor shipping clock pauses from 6pm to 7am.
2. The 6h payment-release window also pauses from 6pm to 7am.
3. A1: each vendor reply adds 3h, with at most 2 extensions, then the order goes to admin.
4. A11: a vendor cancelling an order is **not** a strike.
5. A9: the other affected buyer gets the same 24h fix-or-refund.
6. If "Buyer unavailable" is pressed outside support hours, the vendor sees "we'll call at 8am" and the 12h grace period runs as normal.
