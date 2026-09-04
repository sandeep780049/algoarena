
-- Add 'gate' to contest_type enum
ALTER TYPE contest_type ADD VALUE IF NOT EXISTS 'gate';

-- Create gate_contest_questions linking table
CREATE TABLE public.gate_contest_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.gate_questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contest_id, question_id)
);

ALTER TABLE public.gate_contest_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage gate contest questions" ON public.gate_contest_questions FOR ALL USING (is_admin());
CREATE POLICY "Anyone can view gate contest questions after start" ON public.gate_contest_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM contests c WHERE c.id = gate_contest_questions.contest_id AND (c.start_time <= now() OR is_admin()))
);
CREATE INDEX idx_gate_contest_questions_contest ON public.gate_contest_questions(contest_id);

-- Create gate_contest_submissions table
CREATE TABLE public.gate_contest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.gate_questions(id) ON DELETE CASCADE,
  selected_answer integer NOT NULL,
  is_correct boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, contest_id, question_id)
);

ALTER TABLE public.gate_contest_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own gate submissions" ON public.gate_contest_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gate submissions" ON public.gate_contest_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all gate submissions" ON public.gate_contest_submissions FOR SELECT USING (is_admin());
CREATE INDEX idx_gate_contest_submissions_contest ON public.gate_contest_submissions(contest_id, user_id);

-- RPC: get_gate_contest_questions
CREATE OR REPLACE FUNCTION public.get_gate_contest_questions(p_contest_id uuid)
RETURNS TABLE(id uuid, question_text text, code_block text, options jsonb, difficulty text, tags text[], subject text, topic text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_contest record;
BEGIN
  SELECT * INTO v_contest FROM public.contests WHERE contests.id = p_contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOW() < v_contest.start_time THEN RAISE EXCEPTION 'Contest has not started yet'; END IF;

  RETURN QUERY
  SELECT gq.id, gq.question_text, gq.code_block, gq.options, gq.difficulty, gq.tags, gq.subject, gq.topic
  FROM public.gate_questions gq
  JOIN public.gate_contest_questions gcq ON gcq.question_id = gq.id
  WHERE gcq.contest_id = p_contest_id
  ORDER BY gcq.order_index;
END;
$$;

-- RPC: submit_gate_quiz_answers
CREATE OR REPLACE FUNCTION public.submit_gate_quiz_answers(p_contest_id uuid, p_answers jsonb, p_started_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_contest record;
  v_question record;
  v_score integer := 0;
  v_total integer := 0;
  v_time_taken integer;
  v_existing record;
  v_selected integer;
  v_is_correct boolean;
  v_epoch numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Contest not found'); END IF;
  IF v_contest.contest_type != 'gate' THEN RETURN jsonb_build_object('error', 'Not a GATE contest'); END IF;
  IF NOW() < v_contest.start_time THEN RETURN jsonb_build_object('error', 'Contest has not started yet'); END IF;
  IF NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('error', 'Contest has ended');
  END IF;

  SELECT * INTO v_existing FROM public.contest_results WHERE contest_id = p_contest_id AND user_id = v_user_id AND completed_at IS NOT NULL;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already_submitted', true, 'score', v_existing.score, 'total_questions', v_existing.total_questions, 'time_taken_seconds', v_existing.time_taken_seconds);
  END IF;

  FOR v_question IN
    SELECT gq.id, gq.correct_answer, jsonb_array_length(gq.options) as option_count
    FROM public.gate_contest_questions gcq
    JOIN public.gate_questions gq ON gq.id = gcq.question_id
    WHERE gcq.contest_id = p_contest_id
  LOOP
    v_total := v_total + 1;
    IF p_answers->v_question.id::text IS NULL THEN CONTINUE; END IF;
    BEGIN
      v_selected := (p_answers->v_question.id::text)::integer;
    EXCEPTION WHEN OTHERS THEN CONTINUE;
    END;
    IF v_selected < 0 OR v_selected >= v_question.option_count THEN CONTINUE; END IF;
    v_is_correct := (v_selected = v_question.correct_answer);
    IF v_is_correct THEN v_score := v_score + 1; END IF;
    INSERT INTO public.gate_contest_submissions (user_id, contest_id, question_id, selected_answer, is_correct)
    VALUES (v_user_id, p_contest_id, v_question.id, v_selected, v_is_correct)
    ON CONFLICT (user_id, contest_id, question_id)
    DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;
  END LOOP;

  v_epoch := EXTRACT(EPOCH FROM (NOW() - p_started_at));
  IF v_epoch IS NULL OR v_epoch < 0 THEN v_epoch := 0; END IF;
  v_epoch := LEAST(v_epoch, 2147483647);
  v_time_taken := v_epoch::integer;

  INSERT INTO public.contest_results (user_id, contest_id, score, total_questions, time_taken_seconds, started_at, completed_at)
  VALUES (v_user_id, p_contest_id, v_score, v_total, v_time_taken, p_started_at, NOW())
  ON CONFLICT (user_id, contest_id)
  DO UPDATE SET score = EXCLUDED.score, total_questions = EXCLUDED.total_questions, time_taken_seconds = EXCLUDED.time_taken_seconds, completed_at = EXCLUDED.completed_at;

  RETURN jsonb_build_object('success', true, 'score', v_score, 'total_questions', v_total, 'time_taken_seconds', v_time_taken, 'percentage', CASE WHEN v_total > 0 THEN ROUND((v_score::numeric / v_total::numeric) * 100) ELSE 0 END);
END;
$$;

-- RPC: save_gate_quiz_answer
CREATE OR REPLACE FUNCTION public.save_gate_quiz_answer(p_contest_id uuid, p_question_id uuid, p_selected_answer integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_contest record;
  v_correct integer;
  v_option_count integer;
  v_is_correct boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Contest not found'); END IF;
  IF v_contest.contest_type != 'gate' THEN RETURN jsonb_build_object('error', 'Not a GATE contest'); END IF;
  IF NOW() < v_contest.start_time THEN RETURN jsonb_build_object('error', 'Contest has not started'); END IF;
  IF NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('error', 'Contest has ended');
  END IF;

  IF EXISTS (SELECT 1 FROM public.contest_results WHERE contest_id = p_contest_id AND user_id = v_user_id AND completed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('error', 'Quiz already submitted');
  END IF;

  IF p_selected_answer = -1 THEN
    DELETE FROM public.gate_contest_submissions WHERE user_id = v_user_id AND contest_id = p_contest_id AND question_id = p_question_id;
    RETURN jsonb_build_object('success', true, 'deleted', true);
  END IF;

  SELECT gq.correct_answer, jsonb_array_length(gq.options) INTO v_correct, v_option_count FROM public.gate_questions gq WHERE gq.id = p_question_id;
  IF v_correct IS NULL THEN RETURN jsonb_build_object('error', 'Question not found'); END IF;
  IF p_selected_answer < 0 OR p_selected_answer >= v_option_count THEN RETURN jsonb_build_object('error', 'Invalid answer'); END IF;

  v_is_correct := (p_selected_answer = v_correct);
  INSERT INTO public.gate_contest_submissions (user_id, contest_id, question_id, selected_answer, is_correct)
  VALUES (v_user_id, p_contest_id, p_question_id, p_selected_answer, v_is_correct)
  ON CONFLICT (user_id, contest_id, question_id)
  DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;

  RETURN jsonb_build_object('success', true);
END;
$$;
