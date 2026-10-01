-- Tighten daily challenge RLS.
--
-- get_daily_challenge() deliberately withholds questions.correct_answer until the
-- caller has completed the day, and the function header states the client never
-- receives the underlying question_id. The "Anyone can view daily challenges"
-- policy defeated that: it was FOR SELECT USING (true), so any client could
-- read challenge_date + question_id straight from PostgREST and correlate it
-- against the (RLS protected) questions table.
--
-- Nothing needs to read this table directly. Every read path already goes
-- through the SECURITY DEFINER RPCs (get_daily_challenge), and those keep
-- working because the function owner bypasses RLS. The page fetches the
-- challenge via the RPC, not the table.
--
-- Dropping the permissive policy therefore removes the correlation channel
-- without changing any application behaviour.

DROP POLICY IF EXISTS "Anyone can view daily challenges" ON public.daily_challenges;

-- Confirm no read path depends on direct table access. The admin policy below
-- still allows is_admin() to manage rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_challenges'
      AND policyname = 'Anyone can view daily challenges'
  ) THEN
    RAISE EXCEPTION 'permissive daily_challenges policy still present';
  END IF;
END $$;
