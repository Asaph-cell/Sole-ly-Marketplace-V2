-- Create blog_suggestions table
CREATE TABLE IF NOT EXISTS public.blog_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    topic TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending'::text CHECK (status IN ('pending', 'planned', 'dismissed')),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.blog_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert suggestions (publicly accessible)
CREATE POLICY "Anyone can suggest a topic" ON public.blog_suggestions
    FOR INSERT WITH CHECK (true);

-- Only admins can see and manage suggestions
CREATE POLICY "Admins can view suggestions" ON public.blog_suggestions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update suggestions" ON public.blog_suggestions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
