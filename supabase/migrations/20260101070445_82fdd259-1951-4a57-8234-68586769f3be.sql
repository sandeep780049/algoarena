-- Fix: Restrict contest_registrations to prevent user tracking
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view registrations" ON public.contest_registrations;

-- Create a policy that only allows users to view their own registrations
CREATE POLICY "Users can view their own registrations"
  ON public.contest_registrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to view all registrations
CREATE POLICY "Admins can view all registrations"
  ON public.contest_registrations
  FOR SELECT
  USING (is_admin());

-- Create a secure function to get registration count for contests (public info)
CREATE OR REPLACE FUNCTION public.get_contest_registration_count(p_contest_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer 
  FROM public.contest_registrations 
  WHERE contest_id = p_contest_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_contest_registration_count(uuid) TO authenticated, anon;

-- Create a function to check if user is registered for a contest
CREATE OR REPLACE FUNCTION public.is_user_registered(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contest_registrations 
    WHERE contest_id = p_contest_id AND user_id = auth.uid()
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_user_registered(uuid) TO authenticated;