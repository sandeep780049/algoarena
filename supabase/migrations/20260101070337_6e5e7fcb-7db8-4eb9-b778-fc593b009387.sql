-- Fix: Restrict questions table to prevent answer leakage
-- Drop the permissive policy that allows anyone to view questions (including correct_answer)
DROP POLICY IF EXISTS "Anyone can view questions without answers" ON public.questions;

-- Create a secure RPC function to get questions for a contest WITHOUT correct_answer
CREATE OR REPLACE FUNCTION public.get_contest_questions(p_contest_id uuid)
RETURNS TABLE(
  id uuid,
  question_text text,
  code_block text,
  options jsonb,
  difficulty text,
  tags text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest record;
BEGIN
  -- Verify contest exists and is live or ended
  SELECT * INTO v_contest FROM public.contests WHERE contests.id = p_contest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found';
  END IF;

  -- Only allow access if contest has started
  IF NOW() < v_contest.start_time THEN
    RAISE EXCEPTION 'Contest has not started yet';
  END IF;

  -- Return questions WITHOUT correct_answer
  RETURN QUERY
  SELECT 
    q.id,
    q.question_text,
    q.code_block,
    q.options,
    q.difficulty,
    q.tags
  FROM public.questions q
  JOIN public.contest_questions cq ON cq.question_id = q.id
  WHERE cq.contest_id = p_contest_id
  ORDER BY cq.order_index;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_contest_questions(uuid) TO authenticated;