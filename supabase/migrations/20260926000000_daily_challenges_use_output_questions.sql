-- Fix: the daily challenge pool matched on question_type = 'multiple_choice',
-- but every question in this project is question_type = 'output' (output
-- prediction with a code_block and four options). The pool was therefore empty,
-- ensure_daily_challenge() returned NULL and /daily showed "not available".
--
-- The daily challenge serves options in their stored order and grades with
-- questions.correct_answer, which is the 0-based index into that stored array.
-- contests.option_mapping is a per-user shuffle artefact and is deliberately
-- NOT applied here: without a shuffle, the displayed index already equals the
-- original index, so grading stays correct.
--
-- Eligibility is therefore "any question with exactly four options". The
-- question_type filter is kept but widened to both known values so future
-- multiple_choice questions are picked up too.

CREATE OR REPLACE FUNCTION public.ensure_daily_challenge(p_date date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'utc')::date);
  v_challenge_id uuid;
  v_question_id uuid;
BEGIN
  SELECT id INTO v_challenge_id
  FROM public.daily_challenges
  WHERE challenge_date = v_date;

  IF v_challenge_id IS NOT NULL THEN
    RETURN v_challenge_id;
  END IF;

  -- Prefer a question that is not already scheduled on a later day so the
  -- pool rotates instead of repeating.
  SELECT q.id INTO v_question_id
  FROM public.questions q
  WHERE q.question_type IN ('multiple_choice', 'output')
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
    ) = 4
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_challenges dc
      WHERE dc.question_id = q.id
        AND dc.challenge_date > v_date
    )
  ORDER BY md5(q.id::text || v_date::text)
  LIMIT 1;

  -- Fall back to any eligible question once the whole pool has been used.
  IF v_question_id IS NULL THEN
    SELECT q.id INTO v_question_id
    FROM public.questions q
    WHERE q.question_type IN ('multiple_choice', 'output')
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
      ) = 4
    ORDER BY md5(q.id::text || v_date::text)
    LIMIT 1;
  END IF;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.daily_challenges (challenge_date, question_id)
  VALUES (v_date, v_question_id)
  ON CONFLICT (challenge_date) DO UPDATE SET question_id = EXCLUDED.question_id
  RETURNING id INTO v_challenge_id;

  RETURN v_challenge_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(date) TO anon, authenticated;

-- Backfill the rolling 30 day window now that the pool resolves. Existing rows
-- are left alone so no user ever sees a challenge change mid-day.
INSERT INTO public.daily_challenges (challenge_date, question_id)
SELECT
  d.challenge_date,
  q.id AS question_id
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY md5(id::text || 'daily-challenge')) AS rn
  FROM public.questions
  WHERE question_type IN ('multiple_choice', 'output')
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof(options) = 'array' THEN options ELSE '[]'::jsonb END
    ) = 4
) q
CROSS JOIN LATERAL (
  SELECT (CURRENT_DATE + (rn - 1)::integer)::date AS challenge_date
) d
WHERE d.challenge_date >= CURRENT_DATE
  AND d.challenge_date < CURRENT_DATE + 30
ON CONFLICT (challenge_date) DO NOTHING;
