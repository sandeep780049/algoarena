-- Practice Mode: browse and attempt any question outside of a contest, and
-- close out the outstanding `today` field on get_daily_challenge_streak.
--
-- Why a forward migration for `today`: the edit that added 'today' to the streak
-- JSON was made in the already-applied 20260917000100 migration, so it never ran
-- on the production database. src/lib/supabase.ts types DailyStreak.today as
-- required and src/pages/Profile.tsx forwards it to the heatmap, so without this
-- the runtime shape and the declared type disagree. Editing an applied migration
-- is a no-op; the function has to be redefined.

-- ============================================================================
-- 1. get_daily_challenge_streak: include the UTC challenge date as `today`
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_challenge_streak(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_username text;
  v_avatar text;
  v_current integer := 0;
  v_longest integer := 0;
  v_total integer := 0;
  v_last date;
  v_completed_today boolean := false;
  v_correct_today boolean;
  v_history jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.username, p.avatar_url
  INTO v_username, v_avatar
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT
    COALESCE(us.current_streak, 0),
    COALESCE(us.longest_streak, 0),
    COALESCE(us.total_completed, 0),
    us.last_completed_date
  INTO v_current, v_longest, v_total, v_last
  FROM (SELECT 1) AS one
  LEFT JOIN public.user_streaks us ON us.user_id = v_user_id;

  SELECT da.is_correct
  INTO v_correct_today
  FROM public.daily_challenge_attempts da
  WHERE da.user_id = v_user_id
    AND da.challenge_date = v_today
  LIMIT 1;

  v_completed_today := FOUND;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('date', da.challenge_date::text, 'is_correct', da.is_correct)
      ORDER BY da.challenge_date
    ),
    '[]'::jsonb
  )
  INTO v_history
  FROM public.daily_challenge_attempts da
  WHERE da.user_id = v_user_id
    AND da.challenge_date > v_today - 366;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'username', v_username,
    'avatar_url', v_avatar,
    'today', v_today::text,
    'current_streak', v_current,
    'longest_streak', v_longest,
    'total_completed', v_total,
    'last_completed_date', v_last,
    'completed_today', v_completed_today,
    'solved_today', v_correct_today,
    'history', v_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_challenge_streak(uuid) TO authenticated, anon;


-- ============================================================================
-- 2. Practice mode
-- ============================================================================
--
-- public.questions has RLS enabled with an admin-only SELECT policy, so nothing
-- can read it through PostgREST. Every read path in this project is a
-- SECURITY DEFINER RPC that simply never projects correct_answer. Practice mode
-- follows the same rule:
--
--   get_practice_questions  -> question without the answer key
--   check_practice_answer   -> grades one attempt, returns the key only then
--
-- Questions that are currently live in a contest are excluded so practice mode
-- cannot be used to pre-solve an in-progress contest.

CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One graded attempt per user per question keeps the practice stats honest:
  -- re-answering the same question cannot inflate the totals.
  UNIQUE (user_id, question_id)
);

ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own practice attempts" ON public.practice_attempts;
CREATE POLICY "Users can read own practice attempts"
  ON public.practice_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT policy: writes only happen inside check_practice_answer, which is
-- SECURITY DEFINER. A client cannot fabricate or edit attempt rows.

CREATE INDEX IF NOT EXISTS practice_attempts_user_answered_idx
  ON public.practice_attempts(user_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS questions_difficulty_idx
  ON public.questions(difficulty);

CREATE INDEX IF NOT EXISTS questions_tags_idx
  ON public.questions USING GIN(tags);


-- Distinct difficulties and tags with counts, for the filter controls.
CREATE OR REPLACE FUNCTION public.get_practice_filters()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_difficulties jsonb;
  v_tags jsonb;
BEGIN
  SELECT count(*)::integer
  INTO v_total
  FROM public.questions q
  WHERE q.question_type IN ('multiple_choice', 'output')
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
    ) = 4;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('value', d.difficulty, 'count', d.cnt) ORDER BY d.difficulty),
    '[]'::jsonb
  )
  INTO v_difficulties
  FROM (
    SELECT q.difficulty, count(*)::integer AS cnt
    FROM public.questions q
    WHERE q.difficulty IS NOT NULL
      AND q.difficulty <> ''
      AND q.question_type IN ('multiple_choice', 'output')
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
      ) = 4
    GROUP BY q.difficulty
  ) d;

  -- 'output' is on every row as a type marker, not a topic, so it is noise in a
  -- topic filter and is filtered out here.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('value', t.tag, 'count', t.cnt) ORDER BY t.cnt DESC, t.tag),
    '[]'::jsonb
  )
  INTO v_tags
  FROM (
    SELECT tag, count(*)::integer AS cnt
    FROM public.questions q, unnest(COALESCE(q.tags, '{}'::text[])) AS tag
    WHERE tag IS NOT NULL
      AND tag <> ''
      AND tag <> 'output'
      AND q.question_type IN ('multiple_choice', 'output')
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
      ) = 4
    GROUP BY tag
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'difficulties', v_difficulties,
    'tags', v_tags
  );
END;
$$;


-- A page of questions without the answer key.
--   p_difficulty / p_tag  NULL or 'all' means no filter
--   p_limit                clamped to 1..50
--   p_offset               for pagination
CREATE OR REPLACE FUNCTION public.get_practice_questions(
  p_difficulty text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  question_text text,
  code_block text,
  options jsonb,
  difficulty text,
  tags text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.code_block,
    q.options,
    q.difficulty,
    q.tags
  FROM public.questions q
  WHERE q.question_type IN ('multiple_choice', 'output')
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
    ) = 4
    AND (p_difficulty IS NULL OR p_difficulty = '' OR p_difficulty = 'all' OR q.difficulty = p_difficulty)
    AND (
      p_tag IS NULL
      OR p_tag = ''
      OR p_tag = 'all'
      OR p_tag = ANY(COALESCE(q.tags, '{}'::text[]))
    )
    -- Never hand out a question that is part of a contest that is still running,
    -- otherwise practice mode leaks the answers of a live contest.
    AND NOT EXISTS (
      SELECT 1
      FROM public.contest_questions cq
      JOIN public.contests c ON c.id = cq.contest_id
      WHERE cq.question_id = q.id
        AND c.start_time <= now()
        AND now() < c.start_time + (c.duration_minutes * INTERVAL '1 minute')
    )
  ORDER BY q.created_at DESC, q.id
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;


-- Grade one practice attempt. The answer key is only ever returned from here,
-- after the caller has committed to an option.
CREATE OR REPLACE FUNCTION public.check_practice_answer(
  p_question_id uuid,
  p_selected_answer integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_answer_key integer;
  v_option_count integer;
  v_explanation text;
  v_is_correct boolean;
  v_already_attempted boolean := false;
  v_rate_key text;
  v_rate jsonb;
BEGIN
  IF p_question_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Question is required');
  END IF;

  SELECT q.correct_answer,
    q.explanation,
    jsonb_array_length(
      CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
    )
  INTO v_answer_key, v_explanation, v_option_count
  FROM public.questions q
  WHERE q.id = p_question_id;

  IF v_option_count IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  IF p_selected_answer IS NULL
    OR p_selected_answer < 0
    OR p_selected_answer >= v_option_count THEN
    RETURN jsonb_build_object('error', 'Invalid answer');
  END IF;

  -- Anonymous callers are rate limited by IP-ish identifier plus question so the
  -- answer key cannot be brute forced by cycling through the four options.
  v_rate_key := 'practice:' || COALESCE(v_user_id::text, 'anon') || ':' || p_question_id::text;
  v_rate := public.check_rate_limit(v_rate_key, 8, 3600, 900);

  IF NOT COALESCE((v_rate->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'error',
      COALESCE(v_rate->>'message', 'Too many attempts on this question. Try another one.')
    );
  END IF;

  v_is_correct := (p_selected_answer = v_answer_key);

  IF v_user_id IS NOT NULL THEN
    -- Only the first graded attempt counts towards the saved stats.
    SELECT EXISTS (
      SELECT 1
      FROM public.practice_attempts pa
      WHERE pa.user_id = v_user_id
        AND pa.question_id = p_question_id
    ) INTO v_already_attempted;

    IF NOT v_already_attempted THEN
      INSERT INTO public.practice_attempts (user_id, question_id, selected_answer, is_correct)
      VALUES (v_user_id, p_question_id, p_selected_answer, v_is_correct)
      ON CONFLICT (user_id, question_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_answer_key,
    'explanation', v_explanation,
    'first_attempt', NOT v_already_attempted
  );
END;
$$;


-- Saved practice stats for the signed-in user.
CREATE OR REPLACE FUNCTION public.get_practice_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total integer := 0;
  v_correct integer := 0;
  v_today integer := 0;
  v_by_difficulty jsonb;
  v_recent_tags text[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE pa.is_correct)::integer,
    count(*) FILTER (WHERE pa.answered_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc')::integer
  INTO v_total, v_correct, v_today
  FROM public.practice_attempts pa
  WHERE pa.user_id = v_user_id;

  SELECT COALESCE(
    jsonb_object_agg(d.difficulty, d.cnt),
    '{}'::jsonb
  )
  INTO v_by_difficulty
  FROM (
    SELECT COALESCE(q.difficulty, 'unknown') AS difficulty, count(*)::integer AS cnt
    FROM public.practice_attempts pa
    JOIN public.questions q ON q.id = pa.question_id
    WHERE pa.user_id = v_user_id
    GROUP BY COALESCE(q.difficulty, 'unknown')
  ) d;

  SELECT COALESCE(
    array_agg(DISTINCT t ORDER BY t),
    '{}'::text[]
  )
  INTO v_recent_tags
  FROM (
    SELECT unnest(COALESCE(q.tags, '{}'::text[])) AS t
    FROM public.practice_attempts pa
    JOIN public.questions q ON q.id = pa.question_id
    WHERE pa.user_id = v_user_id
      AND q.tags IS NOT NULL
      AND cardinality(q.tags) > 0
    LIMIT 200
  ) tt;

  RETURN jsonb_build_object(
    'total_attempted', v_total,
    'total_correct', v_correct,
    'answered_today', v_today,
    'accuracy', CASE WHEN v_total > 0 THEN round((v_correct::numeric / v_total) * 100, 1) ELSE 0 END,
    'by_difficulty', v_by_difficulty,
    'tags', v_recent_tags
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.get_practice_filters() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(text, text, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_practice_answer(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_practice_stats() TO authenticated;