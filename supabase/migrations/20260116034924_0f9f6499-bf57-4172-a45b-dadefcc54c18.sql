CREATE OR REPLACE FUNCTION public.submit_quiz_answers(
  p_contest_id uuid,
  p_answers jsonb,
  p_started_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_contest record;
  v_question record;
  v_answer_entry jsonb;
  v_score integer := 0;
  v_total_questions integer := 0;
  v_time_taken integer;
  v_existing_result record;
  v_selected_answer integer;
  v_is_correct boolean;
  v_epoch numeric;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Check if contest exists and is live
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contest not found');
  END IF;

  -- Verify contest is live
  IF NOW() < v_contest.start_time THEN
    RETURN jsonb_build_object('error', 'Contest has not started yet');
  END IF;

  IF NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') THEN
    RETURN jsonb_build_object('error', 'Contest has ended');
  END IF;

  -- Check if user already completed this contest
  SELECT * INTO v_existing_result
  FROM public.contest_results
  WHERE contest_id = p_contest_id
    AND user_id = v_user_id
    AND completed_at IS NOT NULL;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'score', v_existing_result.score,
      'total_questions', v_existing_result.total_questions,
      'time_taken_seconds', v_existing_result.time_taken_seconds
    );
  END IF;

  -- Score answers and upsert submissions (defensive parsing)
  FOR v_question IN
    SELECT q.id, q.correct_answer
    FROM public.contest_questions cq
    JOIN public.questions q ON q.id = cq.question_id
    WHERE cq.contest_id = p_contest_id
  LOOP
    v_total_questions := v_total_questions + 1;

    v_answer_entry := p_answers->v_question.id::text;
    IF v_answer_entry IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      v_selected_answer := (v_answer_entry)::integer;
    EXCEPTION
      WHEN numeric_value_out_of_range OR invalid_text_representation THEN
        -- Ignore malformed answers instead of failing the whole submission
        CONTINUE;
    END;

    -- Enforce 0-based option index bounds
    IF v_selected_answer < 0 OR v_selected_answer > 3 THEN
      CONTINUE;
    END IF;

    v_is_correct := (v_selected_answer = v_question.correct_answer);
    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
    VALUES (v_user_id, p_contest_id, v_question.id, v_selected_answer, v_is_correct)
    ON CONFLICT (user_id, contest_id, question_id)
    DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;
  END LOOP;

  -- Calculate time taken (clamp to int4 range to avoid "integer out of range")
  v_epoch := EXTRACT(EPOCH FROM (NOW() - p_started_at));
  IF v_epoch IS NULL OR v_epoch < 0 THEN
    v_epoch := 0;
  END IF;
  v_epoch := LEAST(v_epoch, 2147483647);
  v_time_taken := v_epoch::integer;

  -- Create or update contest result
  INSERT INTO public.contest_results (user_id, contest_id, score, total_questions, time_taken_seconds, started_at, completed_at)
  VALUES (v_user_id, p_contest_id, v_score, v_total_questions, v_time_taken, p_started_at, NOW())
  ON CONFLICT (user_id, contest_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    total_questions = EXCLUDED.total_questions,
    time_taken_seconds = EXCLUDED.time_taken_seconds,
    completed_at = EXCLUDED.completed_at;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_score,
    'total_questions', v_total_questions,
    'time_taken_seconds', v_time_taken,
    'percentage', CASE WHEN v_total_questions > 0 THEN ROUND((v_score::numeric / v_total_questions::numeric) * 100) ELSE 0 END
  );
END;
$$;