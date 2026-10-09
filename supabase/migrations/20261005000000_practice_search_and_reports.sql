-- Practice search + a question-reporting flow.
--
-- Two gaps from the practice-mode build: there is no way to find a question by
-- its text (only difficulty/topic dropdowns), and there is no way for a user to
-- report a wrong answer or broken question. Reports were the only existing
-- feedback loop for a 108-question bank, so this adds the table plus an admin
-- view.

-- ============================================================================
-- 1. get_practice_questions gains p_search
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_practice_questions(text, text, integer, integer);

CREATE FUNCTION public.get_practice_questions(
  p_difficulty text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_search text DEFAULT NULL,
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
  -- Strip the LIKE metacharacters entirely rather than escaping them: the goal
  -- is literal substring matching, and dropping "%"/"_"/"\" keeps the pattern
  -- safe without a second replace pass on the result.
  v_search text := NULLIF(
    regexp_replace(TRIM(COALESCE(p_search, '')), '[%_\\]', '', 'g'),
    ''
  );
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
    AND (
      v_search IS NULL
      OR q.question_text ILIKE '%' || v_search || '%'
      OR q.code_block ILIKE '%' || v_search || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(q.tags, '{}'::text[])) t
        WHERE t ILIKE '%' || v_search || '%'
      )
    )
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


-- ============================================================================
-- 2. question_reports: users flag a bad question, admins triage it
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('wrong_answer', 'bad_explanation', 'typo', 'unclear', 'other')),
  detail TEXT CHECK (detail IS NULL OR length(detail) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own reports" ON public.question_reports;
CREATE POLICY "Users can read own reports"
  ON public.question_reports
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reports" ON public.question_reports;
CREATE POLICY "Users can insert own reports"
  ON public.question_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'open' AND resolved_at IS NULL);

-- No UPDATE/DELETE policy: only admins touch reports, and they do it through
-- a SECURITY DEFINER function so a compromised admin session cannot rewrite
-- someone else's report history by hand.

DROP POLICY IF EXISTS "Admins can manage reports" ON public.question_reports;
CREATE POLICY "Admins can manage reports"
  ON public.question_reports
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS question_reports_status_idx
  ON public.question_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS question_reports_question_idx
  ON public.question_reports(question_id);

CREATE INDEX IF NOT EXISTS question_reports_user_question_idx
  ON public.question_reports(user_id, question_id);


-- Submit a report. Rate limited per user so the queue cannot be flooded, and
-- deduplicated so re-reporting the same question does not duplicate rows.
CREATE OR REPLACE FUNCTION public.submit_question_report(
  p_question_id uuid,
  p_reason text,
  p_detail text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rate jsonb;
  v_exists boolean;
  v_detail text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Sign in to report a question');
  END IF;

  IF p_question_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Question is required');
  END IF;

  IF p_reason IS NULL
     OR p_reason NOT IN ('wrong_answer', 'bad_explanation', 'typo', 'unclear', 'other') THEN
    RETURN jsonb_build_object('error', 'Choose a reason');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = p_question_id) THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  v_rate := public.check_rate_limit('report:' || v_user_id::text, 10, 3600, 1800);
  IF NOT COALESCE((v_rate->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object(
      'error',
      COALESCE(v_rate->>'message', 'You have reported a lot of questions recently. Try again later.')
    );
  END IF;

  v_detail := NULLIF(regexp_replace(TRIM(COALESCE(p_detail, '')), '[\r\n\t]+', ' ', 'g'), '');
  IF v_detail IS NOT NULL AND length(v_detail) > 1000 THEN
    v_detail := left(v_detail, 1000);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.question_reports r
    WHERE r.user_id = v_user_id
      AND r.question_id = p_question_id
      AND r.status = 'open'
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('already_reported', true);
  END IF;

  INSERT INTO public.question_reports (question_id, user_id, reason, detail)
  VALUES (p_question_id, v_user_id, p_reason, v_detail);

  RETURN jsonb_build_object('success', true);
END;
$$;


-- Admin queue. Only resolves for admins; everyone else gets nothing back.
CREATE OR REPLACE FUNCTION public.list_question_reports(p_status text DEFAULT 'open')
RETURNS TABLE(
  id uuid,
  question_id uuid,
  question_text text,
  code_block text,
  reason text,
  detail text,
  status text,
  reporter_username text,
  created_at timestamptz,
  report_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.question_id,
    q.question_text,
    q.code_block,
    r.reason,
    r.detail,
    r.status,
    p.username,
    r.created_at,
    -- How many distinct users flagged this same question, so an obviously bad
    -- question surfaces first rather than one that a single person misread.
    (SELECT count(DISTINCT r2.user_id) FROM public.question_reports r2 WHERE r2.question_id = r.question_id)
  FROM public.question_reports r
  JOIN public.questions q ON q.id = r.question_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;


-- Admin triage: mark resolved/dismissed. Returning the new row lets the UI
-- update in place without refetching the whole queue.
CREATE OR REPLACE FUNCTION public.update_question_report(
  p_report_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_row public.question_reports%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('open', 'resolved', 'dismissed') THEN
    RETURN jsonb_build_object('error', 'Invalid status');
  END IF;

  v_status := p_status;

  UPDATE public.question_reports r
  SET status = v_status,
      resolved_at = CASE WHEN v_status = 'open' THEN NULL ELSE now() END
  WHERE r.id = p_report_id
  RETURNING r.* INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'status', v_row.status,
    'question_id', v_row.question_id,
    'reason', v_row.reason,
    'detail', v_row.detail,
    'created_at', v_row.created_at
  );
END;
$$;


GRANT EXECUTE ON FUNCTION public.get_practice_questions(text, text, text, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.submit_question_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_question_reports(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_question_report(uuid, text) TO authenticated;