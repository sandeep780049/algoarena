CREATE OR REPLACE FUNCTION public.save_quiz_answer(
  p_contest_id uuid,
  p_question_id uuid,
  p_selected_answer integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_contest record;
  v_existing_result record;
  v_seed integer;
  v_option_count integer;
  v_original_answer integer;
  v_is_correct boolean;
  v_correct_answer integer;
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

  -- Verify contest is live (with 1-minute grace period)
  IF NOW() < v_contest.start_time THEN
    RETURN jsonb_build_object('error', 'Contest has not started yet');
  END IF;

  IF NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('error', 'Contest has ended');
  END IF;

  -- Check if user already completed this contest
  SELECT * INTO v_existing_result
  FROM public.contest_results
  WHERE contest_id = p_contest_id
    AND user_id = v_user_id
    AND completed_at IS NOT NULL;

  IF FOUND THEN
    RETURN jsonb_build_object('error', 'Quiz already submitted');
  END IF;

  -- Handle deselection (p_selected_answer = -1)
  IF p_selected_answer = -1 THEN
    DELETE FROM public.submissions
    WHERE user_id = v_user_id
      AND contest_id = p_contest_id
      AND question_id = p_question_id;
    
    RETURN jsonb_build_object('success', true, 'deleted', true);
  END IF;

  -- Get question info
  SELECT q.correct_answer, jsonb_array_length(q.options)
  INTO v_correct_answer, v_option_count
  FROM public.questions q
  WHERE q.id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  -- Validate answer index
  IF p_selected_answer < 0 OR p_selected_answer >= v_option_count THEN
    RETURN jsonb_build_object('error', 'Invalid answer index');
  END IF;

  -- Get user's shuffle seed
  SELECT seed INTO v_seed FROM public.user_shuffle_seeds 
  WHERE user_id = v_user_id AND contest_id = p_contest_id;

  -- Map shuffled answer back to original index
  IF v_seed IS NOT NULL AND v_option_count > 0 THEN
    SELECT orig_idx INTO v_original_answer
    FROM (
      SELECT 
        idx as orig_idx,
        ROW_NUMBER() OVER (
          ORDER BY (
            v_seed::bigint + idx::bigint + 
            (('x' || substr(md5(p_question_id::text || idx::text), 1, 8))::bit(32)::bigint)
          ) % 100
        ) - 1 as shuffled_idx
      FROM generate_series(0, v_option_count - 1) as idx
    ) mapping
    WHERE shuffled_idx = p_selected_answer;
    
    IF v_original_answer IS NULL THEN
      v_original_answer := p_selected_answer;
    END IF;
  ELSE
    v_original_answer := p_selected_answer;
  END IF;

  -- Determine correctness
  v_is_correct := (v_original_answer = v_correct_answer);

  -- Upsert submission with ORIGINAL answer
  INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
  VALUES (v_user_id, p_contest_id, p_question_id, v_original_answer, v_is_correct)
  ON CONFLICT (user_id, contest_id, question_id)
  DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;

  RETURN jsonb_build_object('success', true);
END;
$$;