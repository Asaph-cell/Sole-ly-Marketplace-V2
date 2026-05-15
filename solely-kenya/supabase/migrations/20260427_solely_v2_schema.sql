-- ============================================================
-- SOLELY V2 — Schema Migration
-- Date: 2026-04-27
-- Adds: Package PIN, 6-hour auto-release, multi-category
--       products, tiered KYC, dispute types, stolen item flag
-- ============================================================


-- ============================================================
-- 1. ORDER STATUS — Add 'dispatched' state
-- ============================================================
-- 'dispatched' replaces 'shipped' in the v2 flow:
-- accepted → dispatched (PIN generated) → delivered (buyer enters PIN) → completed

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'dispatched'
    AND enumtypid = 'public.order_status'::regtype
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'dispatched' AFTER 'accepted';
  END IF;
END $$;


-- ============================================================
-- 2. ORDERS TABLE — Package PIN & Escrow columns
-- ============================================================

-- 3-digit Package PIN generated when vendor accepts the order.
-- Vendor writes this on the box. Buyer enters it to confirm receipt.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS package_pin          CHAR(3),
  ADD COLUMN IF NOT EXISTS package_pin_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS package_pin_entered_at   TIMESTAMPTZ;

-- 6-hour auto-release: set to package_pin_entered_at + 6 hours (delivery only).
-- Pickup orders do NOT use auto_release_at.
-- Column already exists (auto_release_at) — no change needed to column,
-- but the edge function will now set it to +6h from PIN entry, not from vendor arrival.

-- Stolen item report: vendor flags buyer after 6-hour auto-release fires
-- so admin can review and potentially ban the buyer.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stolen_item_reported    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stolen_item_reported_at TIMESTAMPTZ;

-- Index for package PIN lookups
CREATE INDEX IF NOT EXISTS idx_orders_package_pin
  ON public.orders(package_pin)
  WHERE package_pin IS NOT NULL;

-- Index for auto-release cron queries
CREATE INDEX IF NOT EXISTS idx_orders_auto_release
  ON public.orders(auto_release_at)
  WHERE auto_release_at IS NOT NULL;


-- ============================================================
-- 3. PRODUCTS TABLE — Multi-category support
-- ============================================================

-- Top-level category: footwear | apparel | electronics
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'footwear'
    CHECK (category IN ('footwear', 'apparel', 'electronics')),
  ADD COLUMN IF NOT EXISTS subcategory  TEXT;

-- Electronics-specific specs stored as flexible JSON:
-- { storage, ram, battery_health, imei_visible, model, condition }
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS electronics_specs JSONB;

-- Apparel-specific specs stored as flexible JSON:
-- { material, gender, clothing_size, condition }
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS apparel_specs JSONB;

-- Index for category filtering on shop page
CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products(category);

CREATE INDEX IF NOT EXISTS idx_products_subcategory
  ON public.products(subcategory);

COMMENT ON COLUMN public.products.category IS 'Top-level vertical: footwear, apparel, electronics';
COMMENT ON COLUMN public.products.electronics_specs IS 'JSON: {storage, ram, battery_health, imei_visible, model, condition}';
COMMENT ON COLUMN public.products.apparel_specs IS 'JSON: {material, gender, clothing_size, condition}';


-- ============================================================
-- 4. PROFILES TABLE — Tiered KYC
-- ============================================================
-- standard  = footwear / apparel vendors (phone + name only)
-- enhanced  = electronics vendors (National ID or Business Reg required)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_tier         TEXT DEFAULT 'standard'
    CHECK (kyc_tier IN ('standard', 'enhanced')),
  ADD COLUMN IF NOT EXISTS kyc_status       TEXT DEFAULT 'not_required'
    CHECK (kyc_status IN ('not_required', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS kyc_documents    JSONB,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reject_reason TEXT;

COMMENT ON COLUMN public.profiles.kyc_tier IS 'standard: footwear/apparel. enhanced: electronics (requires ID verification)';
COMMENT ON COLUMN public.profiles.kyc_documents IS 'JSON: {national_id_url, business_reg_url, id_number}';


-- ============================================================
-- 5. DISPUTES TABLE — Typed disputes
-- ============================================================
-- Maps to buyer dispute options in the UI:
-- item_broken, not_as_advertised, wrong_item, item_not_received, other

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS dispute_type TEXT
    CHECK (dispute_type IN (
      'item_broken',
      'not_as_advertised',
      'wrong_item',
      'item_not_received',
      'other'
    ));

-- Admin resolution tracking
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS admin_resolution TEXT
    CHECK (admin_resolution IN ('refund_buyer', 'release_to_vendor')),
  ADD COLUMN IF NOT EXISTS admin_notes      TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.disputes.dispute_type IS 'Buyer-selected dispute reason from UI';
COMMENT ON COLUMN public.disputes.admin_resolution IS 'Admin decision: refund_buyer or release_to_vendor';


-- ============================================================
-- 6. STOLEN ITEM REPORTS — Separate tracking table
-- ============================================================
-- Vendor can report a stolen item after 6-hour auto-release fires.
-- Admin reviews and can ban the buyer.

CREATE TABLE IF NOT EXISTS public.stolen_item_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description     TEXT,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES auth.users(id),
  action_taken    TEXT CHECK (action_taken IN ('buyer_banned', 'buyer_warned', 'dismissed')),
  admin_notes     TEXT
);

ALTER TABLE public.stolen_item_reports ENABLE ROW LEVEL SECURITY;

-- Vendors can create reports for their own orders
CREATE POLICY "vendor_create_stolen_report"
  ON public.stolen_item_reports FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

-- Vendors can view their own reports
CREATE POLICY "vendor_view_own_stolen_report"
  ON public.stolen_item_reports FOR SELECT
  USING (auth.uid() = vendor_id OR has_role(auth.uid(), 'admin'::app_role));

-- Admin can update (review) reports
CREATE POLICY "admin_update_stolen_report"
  ON public.stolen_item_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_stolen_reports_vendor
  ON public.stolen_item_reports(vendor_id);

CREATE INDEX IF NOT EXISTS idx_stolen_reports_buyer
  ON public.stolen_item_reports(buyer_id);


-- ============================================================
-- 7. ACCOUNT BANS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_bans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by   UUID REFERENCES auth.users(id),
  reason      TEXT NOT NULL,
  ban_type    TEXT NOT NULL CHECK (ban_type IN ('shadowban', 'permanent')),
  banned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at   TIMESTAMPTZ,
  notes       TEXT,
  UNIQUE(user_id)
);

ALTER TABLE public.account_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_bans"
  ON public.account_bans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can check if they themselves are banned (for redirect on login)
CREATE POLICY "user_view_own_ban"
  ON public.account_bans FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.account_bans IS 'Tracks shadowbanned or permanently banned accounts. Admin-managed.';
