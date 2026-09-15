-- Post-contest review: lets a user see their own answers, the correct answer,
-- and the explanation for every question once they have completed the contest.
-- Answers are served in the original (unshuffled) option order, which matches
-- the indices already stored in submissions.selected_answer.
CREATE OR REPLACE FUNCTION public.get_contest_review(p_contest_id uuid)
RETURNS TABLE(
  id uuid,
  question_text text,
  code_block text,
  options jsonb,
  correct_answer integer,
  user_answer integer,
  is_correct boolean,
  explanation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_completed boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Only expose the answer key to users who have actually completed the contest.
  SELECT EXISTS (
    SELECT 1
    FROM public.contest_results
    WHERE contest_id = p_contest_id
      AND user_id = v_user_id
      AND completed_at IS NOT NULL
  ) INTO v_completed;

  IF NOT v_completed THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.code_block,
    q.options,
    q.correct_answer,
    COALESCE(s.selected_answer, -1)::integer AS user_answer,
    COALESCE(s.is_correct, false) AS is_correct,
    q.explanation
  FROM public.contest_questions cq
  JOIN public.questions q ON q.id = cq.question_id
  LEFT JOIN public.submissions s
    ON s.question_id = q.id
    AND s.contest_id = p_contest_id
    AND s.user_id = v_user_id
  ORDER BY cq.order_index;
END;
$$;