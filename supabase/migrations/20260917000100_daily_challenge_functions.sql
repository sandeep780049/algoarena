-- Daily challenge RPCs.
-- The answer key is resolved server-side: get_daily_challenge only returns
-- correct_answer/explanation once the signed-in user has already completed that
-- day, and the client never receives the underlying question_id.

-- Creates the challenge for a date if it does not exist yet, preferring a
-- question that is not scheduled for any later day so the pool rotates.
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

  SELECT q.id INTO v_question_id
  FROM public.questions q
  WHERE q.question_type = 'multiple_choice'
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

  IF v_question_id IS NULL THEN
    SELECT q.id INTO v_question_id
    FROM public.questions q
    WHERE q.question_type = 'multiple_choice'
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

-- Today's question without the answer key, plus the caller's own attempt when
-- they have already played today.
CREATE OR REPLACE FUNCTION public.get_daily_challenge(p_date date DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  challenge_date date,
  question_text text,
  code_block text,
  options jsonb,
  difficulty text,
  tags text[],
  already_completed boolean,
  selected_answer integer,
  is_correct boolean,
  correct_answer integer,
  explanation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'utc')::date);
  v_challenge_id uuid;
  v_question_id uuid;
  v_question_text text;
  v_code_block text;
  v_options jsonb;
  v_difficulty text;
  v_tags text[];
  v_answer_key integer;
  v_explanation text;
  v_completed boolean := false;
  v_selected integer;
  v_correct boolean;
BEGIN
  v_challenge_id := public.ensure_daily_challenge(v_date);
  IF v_challenge_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    dc.question_id,
    q.question_text,
    q.code_block,
    q.options,
    q.difficulty,
    q.tags,
    q.correct_answer,
    q.explanation
  INTO
    v_question_id,
    v_question_text,
    v_code_block,
    v_options,
    v_difficulty,
    v_tags,
    v_answer_key,
    v_explanation
  FROM public.daily_challenges dc
  JOIN public.questions q ON q.id = dc.question_id
  WHERE dc.id = v_challenge_id;

  IF v_user_id IS NOT NULL THEN
    SELECT da.selected_answer, da.is_correct
    INTO v_selected, v_correct
    FROM public.daily_challenge_attempts da
    WHERE da.user_id = v_user_id
      AND da.challenge_date = v_date
    LIMIT 1;

    v_completed := FOUND;
  END IF;

  RETURN QUERY
  SELECT
    v_challenge_id,
    v_date,
    v_question_text,
    v_code_block,
    v_options,
    v_difficulty,
    v_tags,
    v_completed,
    v_selected,
    v_correct,
    CASE WHEN v_completed THEN v_answer_key END,
    CASE WHEN v_completed THEN v_explanation END;
END;
$$;

-- Grades today's answer and advances the user's streak. One attempt per day.
CREATE OR REPLACE FUNCTION public.submit_daily_challenge(
  p_challenge_id uuid,
  p_selected_answer integer,
  p_time_taken_seconds integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_challenge_date date;
  v_question_id uuid;
  v_answer_key integer;
  v_explanation text;
  v_option_count integer;
  v_is_correct boolean;
  v_current integer;
  v_longest integer;
  v_total integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT dc.challenge_date, dc.question_id
  INTO v_challenge_date, v_question_id
  FROM public.daily_challenges dc
  WHERE dc.id = p_challenge_id;

  IF v_challenge_date IS NULL THEN
    RETURN jsonb_build_object('error', 'Challenge not found');
  END IF;

  IF v_challenge_date <> v_today THEN
    RETURN jsonb_build_object('error', 'This challenge is no longer available');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.daily_challenge_attempts da
    WHERE da.user_id = v_user_id
      AND da.challenge_date = v_today
  ) THEN
    RETURN jsonb_build_object('error', 'You already completed today''s challenge', 'already_completed', true);
  END IF;

  SELECT q.correct_answer, q.explanation,
    jsonb_array_length(
      CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
    )
  INTO v_answer_key, v_explanation, v_option_count
  FROM public.questions q
  WHERE q.id = v_question_id;

  IF v_option_count IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  IF p_selected_answer IS NULL
    OR p_selected_answer < 0
    OR p_selected_answer >= v_option_count THEN
    RETURN jsonb_build_object('error', 'Invalid answer');
  END IF;

  v_is_correct := (p_selected_answer = v_answer_key);

  INSERT INTO public.daily_challenge_attempts (
    user_id,
    challenge_id,
    challenge_date,
    question_id,
    selected_answer,
    is_correct,
    time_taken_seconds
  )
  VALUES (
    v_user_id,
    p_challenge_id,
    v_today,
    v_question_id,
    p_selected_answer,
    v_is_correct,
    GREATEST(COALESCE(p_time_taken_seconds, 0), 0)
  )
  ON CONFLICT (user_id, challenge_date) DO NOTHING;

  -- A streak continues on consecutive days and restarts after a missed day.
  INSERT INTO public.user_streaks (
    user_id,
    current_streak,
    longest_streak,
    total_completed,
    last_completed_date
  )
  VALUES (v_user_id, 1, 1, 1, v_today)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN user_streaks.last_completed_date = v_today - 1 THEN user_streaks.current_streak + 1
      WHEN user_streaks.last_completed_date = v_today THEN user_streaks.current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      user_streaks.longest_streak,
      CASE
        WHEN user_streaks.last_completed_date = v_today - 1 THEN user_streaks.current_streak + 1
        WHEN user_streaks.last_completed_date = v_today THEN user_streaks.current_streak
        ELSE 1
      END
    ),
    total_completed = user_streaks.total_completed
      + CASE WHEN user_streaks.last_completed_date = v_today THEN 0 ELSE 1 END,
    last_completed_date = v_today,
    updated_at = now()
  RETURNING current_streak, longest_streak, total_completed
  INTO v_current, v_longest, v_total;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_answer', v_answer_key,
    'explanation', v_explanation,
    'current_streak', v_current,
    'longest_streak', v_longest,
    'total_completed', v_total
  );
END;
$$;

-- Streak summary and the last year of completions for the heatmap.
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

CREATE OR REPLACE FUNCTION public.get_streak_leaderboard(p_limit integer DEFAULT 25)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  current_streak integer,
  longest_streak integer,
  total_completed integer,
  last_completed_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY us.current_streak DESC, us.longest_streak DESC, us.total_completed DESC, p.username ASC
    )::bigint,
    us.user_id,
    p.username,
    p.avatar_url,
    us.current_streak,
    us.longest_streak,
    us.total_completed,
    us.last_completed_date
  FROM public.user_streaks us
  JOIN public.profiles p ON p.id = us.user_id
  WHERE us.total_completed > 0
  ORDER BY us.current_streak DESC, us.longest_streak DESC, us.total_completed DESC, p.username ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_challenge(date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge_streak(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_streak_leaderboard(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_daily_challenge(date) TO authenticated, anon;
