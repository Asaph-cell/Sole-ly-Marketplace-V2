-- Make order_id nullable in payouts table
-- Withdrawals are not tied to a single order, so order_id should be optional.
-- This fixes the vendor-withdraw function which inserts payouts without an order_id.
ALTER TABLE payouts ALTER COLUMN order_id DROP NOT NULL;
