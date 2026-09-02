-- ============================================================
-- ADD MISSING DELETE POLICY ON company_feedback
-- ============================================================
-- create_company_feedback.sql only ever defined INSERT (anyone), SELECT
-- (admin) and UPDATE (admin) policies. With RLS enabled and no DELETE
-- policy, Postgres denies every delete by default - AdminComms.tsx's
-- "Delete" button on feedback items has never worked as a result.
-- ============================================================

CREATE POLICY "Admins can delete feedback" ON public.company_feedback
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
