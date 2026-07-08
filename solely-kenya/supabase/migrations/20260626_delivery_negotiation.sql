-- =====================================================
-- DELIVERY NEGOTIATION SYSTEM — Full Migration
-- =====================================================
-- 1. Recreate messages table (was dropped in commission_escrow migration)
-- 2. Create delivery_agreements table
-- 3. Extend conversations table with product + agreement links
-- 4. Add update policy on conversations
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. RECREATE messages TABLE
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  is_read boolean DEFAULT false,
  -- NEW: structured message types for delivery negotiation
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'delivery_proposal', 'delivery_accepted', 'delivery_rejected', 'system')),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS: conversation participants can view messages
CREATE POLICY "Conversation participants can view messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      conversations.buyer_id = auth.uid() OR
      conversations.vendor_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- RLS: conversation participants can send messages
CREATE POLICY "Conversation participants can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      conversations.buyer_id = auth.uid() OR
      conversations.vendor_id = auth.uid()
    )
  ) AND auth.uid() = sender_id
);

-- RLS: participants can update messages (mark as read)
CREATE POLICY "Participants can update messages"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (
      conversations.buyer_id = auth.uid() OR
      conversations.vendor_id = auth.uid()
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Notification trigger for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
BEGIN
  SELECT CASE
    WHEN NEW.sender_id = c.vendor_id THEN c.buyer_id
    ELSE c.vendor_id
  END INTO recipient_id
  FROM conversations c WHERE c.id = NEW.conversation_id;

  SELECT COALESCE(full_name, 'Someone') INTO sender_name
  FROM profiles WHERE id = NEW.sender_id;

  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (recipient_id, 'New Message', sender_name || ' sent you a message', 'message', NEW.conversation_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message ON messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();


-- ─────────────────────────────────────────────────────
-- 2. CREATE delivery_agreements TABLE
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_ids uuid[] NOT NULL,           -- array of product IDs being purchased
  buyer_id uuid NOT NULL,
  vendor_id uuid NOT NULL REFERENCES profiles(id),
  
  -- Delivery details (entered by buyer before chat)
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  buyer_address text,
  buyer_city text,
  buyer_county text,
  buyer_gps_lat numeric,
  buyer_gps_lng numeric,
  buyer_delivery_notes text,
  
  -- Negotiated delivery fee
  delivery_fee_ksh numeric NOT NULL DEFAULT 0,
  delivery_method text,                   -- "Boda boda", "G4S", "Personal delivery", etc.
  
  -- Negotiation state
  status text NOT NULL DEFAULT 'negotiating' 
    CHECK (status IN ('negotiating', 'agreed', 'expired', 'used')),
  proposed_by uuid,                       -- who last proposed the fee
  agreed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  
  -- Link to conversation
  conversation_id uuid REFERENCES conversations(id),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their own agreements"
  ON delivery_agreements FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "Vendors can view their own agreements"
  ON delivery_agreements FOR SELECT
  USING (vendor_id = auth.uid());

CREATE POLICY "Buyers can create agreements"
  ON delivery_agreements FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Participants can update agreements"
  ON delivery_agreements FOR UPDATE
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid());

CREATE INDEX idx_delivery_agreements_buyer ON delivery_agreements(buyer_id);
CREATE INDEX idx_delivery_agreements_vendor ON delivery_agreements(vendor_id);
CREATE INDEX idx_delivery_agreements_status ON delivery_agreements(status);

-- Enable realtime on delivery_agreements for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_agreements;
ALTER TABLE delivery_agreements REPLICA IDENTITY FULL;


-- ─────────────────────────────────────────────────────
-- 3. EXTEND conversations TABLE
-- ─────────────────────────────────────────────────────
-- Add product and delivery agreement context columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS product_ids uuid[];
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS delivery_agreement_id uuid REFERENCES delivery_agreements(id);

-- Add update policy (needed for updating updated_at on new messages)
-- Use DO block to avoid error if policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'conversations' 
    AND policyname = 'Participants can update conversations'
  ) THEN
    EXECUTE 'CREATE POLICY "Participants can update conversations"
      ON public.conversations FOR UPDATE
      USING (auth.uid() = buyer_id OR auth.uid() = vendor_id)';
  END IF;
END
$$;
