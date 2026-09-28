# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-09-28

## Product Overview
**One-liner:** A protected M-Pesa checkout for Kenyans who buy and sell on social media: the buyer's money is held until the order arrives.
**What it does:** Sellers list an item and send a Solely payment link in WhatsApp, Instagram or TikTok DMs. The buyer pays via M-Pesa into a holding account. The seller dispatches, the buyer confirms receipt with a PIN, and a release code pays the seller instantly. If the order never comes, the buyer gets a full refund.
**Product category:** Escrow / buyer-protected checkout for social commerce ("safe way to pay online in Kenya"). Also a browsable marketplace of verified sellers.
**Product type:** Two-sided marketplace + payment-link tool.
**Business model:** Free to list, no monthly fees. 6% commission on the product subtotal only when a sale completes. The delivery fee is never commissioned; the vendor keeps it in full.

## Target Audience
**Target sellers:** Small Kenyan online businesses selling through Instagram, WhatsApp and TikTok: sneakers, thrift and fashion boutiques, electronics and phone accessories, beauty. Mostly Nairobi, solo or 2–5 person operations.
**Target buyers:** Kenyans who shop from social-media sellers but fear paying upfront to a stranger's Till number.
**Primary use case:** Closing a sale with a buyer who is ready to buy but won't send money first.
**Jobs to be done:**
- Seller: "Get strangers to pay me without me having to prove I'm legit."
- Buyer: "Buy from an Instagram shop without the risk of getting scammed."
- Both: "Settle a dispute fairly without a shouting match in the DMs."
**Use cases:**
- Payment link dropped in a DM for a single item
- Seller storefront page with reviews, shared as a link in bio
- Buyer browsing verified sellers on solelymarketplace.com
- In-person pickup (release code shown at collection)

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Social seller | Converting DM enquiries into paid orders | Buyers ghost at "send to Till" | Buyers pay because their money is protected; seller is paid the moment the buyer confirms |
| Cautious buyer | Not losing money | Has been scammed or knows someone who has | Money is held until the item is in hand; full refund if it doesn't arrive |

## Problems & Pain Points
**Core problem:** Social commerce in Kenya runs on trust between strangers, and "pay first, deliver later" is where scams happen.
**Why alternatives fall short:**
- Pay-to-Till upfront: all the risk sits with the buyer
- Pay on delivery: all the risk sits with the seller (fake orders, riders paid for nothing)
- Big marketplaces (Jumia, Kilimall): sellers lose their own audience, brand and DM relationship
**What it costs them:** Sellers lose ready buyers at the payment step; buyers skip good local shops or overpay at "safe" big retailers.
**Emotional tension:** Buyer fear of "pay and pray"; seller frustration at being treated like a scammer.

## Competitive Landscape
**Direct:** Other escrow/payment-link tools in Kenya — often generic, not built around the social DM flow or M-Pesa-first.
**Secondary:** Jumia / Kilimall and similar marketplaces — protected, but the seller gives up their audience and the social relationship.
**Indirect:** Pay on delivery; paying a Till upfront "and praying"; using a mutual friend as middleman.

## Differentiation
**Key differentiators:**
- Buyer's money is held, not sent to the seller, until delivery is confirmed
- Works inside the chats where the sale already happens (link in DMs, no app needed)
- M-Pesa native
- PIN + 6-digit release code mechanism; 6-hour auto-release protects sellers from buyers who go quiet
- Disputes reviewed by the Solely team within 24 hours
**How we do it differently:** Solely is the checkout layer for the seller's own channels, not a replacement shop.
**Why that's better:** Sellers keep their audience and brand; buyers get marketplace-grade protection from a small shop.
**Why customers choose us:** "My customers finally pay without asking for proof."

## Objections
| Objection | Response |
|-----------|----------|
| "Why should I trust Solely with my money?" | The money sits in a holding account and only moves when you confirm, or back to you if the order fails. |
| (Seller) "6% is a lot." | Nothing upfront, nothing monthly, commission only on completed sales and never on delivery. One saved sale per week covers it. |
| (Seller) "What if the buyer takes the item and never confirms?" | Funds auto-release to the seller 6 hours after the delivery PIN is entered. |
| "What if it's damaged or not as described?" | Open a dispute any time before release; reviewed within 24 hours. |

**Anti-persona:** Large retailers with their own payment infrastructure; sellers who want to hide from reviews or disputes.

## Switching Dynamics
**Push:** Lost sales at the payment step; scam stories; fake pay-on-delivery orders.
**Pull:** Protected payment link, instant payout on confirmation, store page with reviews.
**Habit:** "Send to Till" is familiar and free; sellers already have Instagram and WhatsApp flows.
**Anxiety:** Trusting a third party with money; fear of delayed payouts; learning a new flow.

## Customer Language
**How they describe the problem:**
- "Pay and pray" (used on the site)
- "Send to Till" (the default payment instruction)
- "Scammed", "ghosted", "fake seller"
**How they describe us:** No verbatim customer quotes captured yet (TODO: collect from vendor onboarding / WhatsApp).
**Words to use:** protected, held, released, M-Pesa, payment link, verified sellers, full refund, DMs, WhatsApp / Instagram / TikTok
**Words to avoid:** "100%" claims, "escrow" as a headline word (jargon for most buyers; fine in FAQ and SEO), "seamless", "elevate", "next-gen", emoji-heavy hype
**Glossary:**
| Term | Meaning |
|------|---------|
| Payment link | Checkout link a seller sends in DMs |
| Delivery PIN | 3-digit code the buyer enters to confirm receipt |
| Release code | 6-digit code shown to the seller to release funds |
| Auto-release | Funds go to seller 6 hours after PIN if buyer goes quiet |

## Brand Voice
**Tone:** Calm, direct, reassuring. Plain Kenyan English.
**Style:** Short sentences, concrete mechanics over claims ("held until you confirm" beats "100% safe").
**Personality:** Trustworthy, practical, local, quietly confident, on both sides' team.

## Proof Points
**Metrics:** TODO: completed orders, total KSh protected, dispute rate, registered sellers.
**Customers:** Registered vendors shown live on the homepage marquee (pulled from `public_vendor_profiles`).
**Testimonials:** TODO: none collected yet.
**Value themes:**
| Theme | Proof |
|-------|-------|
| Buyer safety | Funds held; full refund if not delivered; 24h dispute review |
| Seller fairness | 6h auto-release; payout on release code; delivery fee not commissioned |
| Low barrier | Free to list, no monthly fees, no app needed |

## Goals
**Business goal:** Grow active sellers using payment links, which brings their buyers onto Solely.
**Conversion action:** Primary: seller sign-up (/vendor). Secondary: buyer browsing and first protected purchase.
**Current metrics:** Unknown (TODO).

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-09-28) — Initial context, auto-drafted from the codebase (How It Works, Terms, FAQ, homepage).
