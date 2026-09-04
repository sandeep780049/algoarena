-- Fix 1: Restrict contest_questions visibility to only after contest start
DROP POLICY IF EXISTS "Anyone can view contest questions" ON public.contest_questions;

CREATE POLICY "Anyone can view contest questions after start"
ON public.contest_questions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id = contest_questions.contest_id
    AND (c.start_time <= NOW() OR is_admin())
  )
);

-- Fix 2: Remove overly permissive policies on email_verification_otps
-- OTP operations should only happen through edge functions with service role
DROP POLICY IF EXISTS "Anyone can delete OTP records" ON public.email_verification_otps;
DROP POLICY IF EXISTS "Anyone can insert OTP records" ON public.email_verification_otps;
DROP POLICY IF EXISTS "Anyone can read OTP records" ON public.email_verification_otps;
DROP POLICY IF EXISTS "Anyone can update OTP records" ON public.email_verification_otps;

-- Only admins can directly access OTP records (edge functions use service role which bypasses RLS)
CREATE POLICY "Only admins can access OTP records"
ON public.email_verification_otps
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());