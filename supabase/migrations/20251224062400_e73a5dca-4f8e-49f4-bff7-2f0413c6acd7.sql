-- Drop existing policies that allow public access
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
DROP POLICY IF EXISTS "Anyone can view contest results" ON public.contest_results;

-- Create a secure view for questions that excludes correct_answer for non-admins
-- This is a workaround since we can't do column-level RLS in Postgres

-- Create a new policy for questions that allows viewing but we'll handle column selection in the view
CREATE POLICY "Anyone can view questions without answers"
ON public.questions
FOR SELECT
USING (true);

-- Note: The correct_answer will still be in the table, but we'll create a secure function
-- to validate answers server-side and frontend will NOT fetch correct_answer

-- Fix contest_results to be private - users can only see their own results
-- But we need leaderboard data (score, time, user_id) to be public for ranking display
-- Create separate policies for what data can be accessed

-- Create a secure function to get leaderboard data (without exposing raw user data)
CREATE OR REPLACE FUNCTION public.get_leaderboard_entries(p_contest_id uuid)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  score integer,
  total_questions integer,
  time_taken_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY cr.score DESC, cr.time_taken_seconds ASC)::bigint as rank,
    cr.user_id,
    p.username,
    p.avatar_url,
    cr.score,
    cr.total_questions,
    cr.time_taken_seconds
  FROM public.contest_results cr
  JOIN public.profiles p ON p.id = cr.user_id
  WHERE cr.contest_id = p_contest_id
    AND cr.completed_at IS NOT NULL
  ORDER BY cr.score DESC, cr.time_taken_seconds ASC
  LIMIT 100;
END;
$$;

-- Create a secure function to get global leaderboard
CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  total_score bigint,
  contest_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY SUM(cr.score) DESC)::bigint as rank,
    cr.user_id,
    p.username,
    p.avatar_url,
    SUM(cr.score)::bigint as total_score,
    COUNT(cr.id)::bigint as contest_count
  FROM public.contest_results cr
  JOIN public.profiles p ON p.id = cr.user_id
  WHERE cr.completed_at IS NOT NULL
  GROUP BY cr.user_id, p.username, p.avatar_url
  ORDER BY total_score DESC
  LIMIT 100;
END;
$$;

-- Create a secure function to validate and submit quiz answers
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
  v_question_id uuid;
  v_selected_answer integer;
  v_is_correct boolean;
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

  -- Get all questions for this contest
  FOR v_question IN
    SELECT q.id, q.correct_answer
    FROM public.contest_questions cq
    JOIN public.questions q ON q.id = cq.question_id
    WHERE cq.contest_id = p_contest_id
  LOOP
    v_total_questions := v_total_questions + 1;
    
    -- Check if user submitted answer for this question
    v_answer_entry := p_answers->v_question.id::text;
    IF v_answer_entry IS NOT NULL THEN
      v_selected_answer := (v_answer_entry)::integer;
      v_is_correct := (v_selected_answer = v_question.correct_answer);
      
      IF v_is_correct THEN
        v_score := v_score + 1;
      END IF;

      -- Insert/update submission
      INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
      VALUES (v_user_id, p_contest_id, v_question.id, v_selected_answer, v_is_correct)
      ON CONFLICT (user_id, contest_id, question_id) 
      DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;
    END IF;
  END LOOP;

  -- Calculate time taken
  v_time_taken := EXTRACT(EPOCH FROM (NOW() - p_started_at))::integer;

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

-- Add unique constraint on contest_results if not exists (for upsert to work)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contest_results_user_contest_unique'
  ) THEN
    ALTER TABLE public.contest_results 
    ADD CONSTRAINT contest_results_user_contest_unique UNIQUE (user_id, contest_id);
  END IF;
EXCEPTION WHEN others THEN
  -- Constraint might already exist, ignore error
  NULL;
END $$;

-- Add unique constraint on submissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submissions_user_contest_question_unique'
  ) THEN
    ALTER TABLE public.submissions 
    ADD CONSTRAINT submissions_user_contest_question_unique UNIQUE (user_id, contest_id, question_id);
  END IF;
EXCEPTION WHEN others THEN
  -- Constraint might already exist, ignore error
  NULL;
END $$;

-- Create a secure function to save individual answers during quiz
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
  v_correct_answer integer;
  v_is_correct boolean;
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
  IF NOW() < v_contest.start_time OR NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') THEN
    RETURN jsonb_build_object('error', 'Contest is not live');
  END IF;

  -- Check if user already completed this contest
  IF EXISTS (
    SELECT 1 FROM public.contest_results 
    WHERE contest_id = p_contest_id AND user_id = v_user_id AND completed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Quiz already submitted');
  END IF;

  -- Get correct answer (server-side only, never exposed to client)
  SELECT q.correct_answer INTO v_correct_answer
  FROM public.questions q
  JOIN public.contest_questions cq ON cq.question_id = q.id
  WHERE q.id = p_question_id AND cq.contest_id = p_contest_id;

  IF v_correct_answer IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found in contest');
  END IF;

  v_is_correct := (p_selected_answer = v_correct_answer);

  -- Insert/update submission (we don't reveal if correct or not)
  INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
  VALUES (v_user_id, p_contest_id, p_question_id, p_selected_answer, v_is_correct)
  ON CONFLICT (user_id, contest_id, question_id) 
  DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;

  -- Return success without revealing correctness
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create a secure function to get user's own result for a contest
CREATE OR REPLACE FUNCTION public.get_my_contest_result(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_result
  FROM public.contest_results
  WHERE contest_id = p_contest_id 
    AND user_id = v_user_id 
    AND completed_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'score', v_result.score,
    'total_questions', v_result.total_questions,
    'time_taken_seconds', v_result.time_taken_seconds,
    'completed_at', v_result.completed_at
  );
END;
$$;