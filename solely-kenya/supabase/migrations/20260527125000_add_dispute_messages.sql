-- Create dispute_messages table for in-platform chat
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'vendor', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Admins can see all messages
CREATE POLICY "Admins can view all dispute messages" 
ON public.dispute_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can insert messages" 
ON public.dispute_messages FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 2. Buyers can view messages for their own disputes
CREATE POLICY "Buyers can view their dispute messages" 
ON public.dispute_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.disputes 
        WHERE id = dispute_id AND customer_id = auth.uid()
    )
);

CREATE POLICY "Buyers can insert messages to their disputes" 
ON public.dispute_messages FOR INSERT 
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.disputes 
        WHERE id = dispute_id AND customer_id = auth.uid()
    )
);

-- 3. Vendors can view messages for their own disputes
CREATE POLICY "Vendors can view their dispute messages" 
ON public.dispute_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.disputes 
        WHERE id = dispute_id AND vendor_id = auth.uid()
    )
);

CREATE POLICY "Vendors can insert messages to their disputes" 
ON public.dispute_messages FOR INSERT 
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.disputes 
        WHERE id = dispute_id AND vendor_id = auth.uid()
    )
);
