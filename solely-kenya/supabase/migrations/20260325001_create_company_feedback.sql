-- Create company_feedback table
CREATE TABLE IF NOT EXISTS public.company_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    message TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending'::text CHECK (status IN ('pending', 'reviewed', 'implemented', 'dismissed')),
    admin_notes TEXT
);

-- Enable RLS
ALTER TABLE public.company_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (publicly accessible)
CREATE POLICY "Anyone can submit feedback" ON public.company_feedback
    FOR INSERT WITH CHECK (true);

-- Only admins can see and manage feedback
CREATE POLICY "Admins can view feedback" ON public.company_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update feedback" ON public.company_feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
