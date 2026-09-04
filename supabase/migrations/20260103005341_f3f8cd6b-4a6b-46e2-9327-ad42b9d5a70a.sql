-- Drop existing functions that need signature changes
DROP FUNCTION IF EXISTS public.get_contest_questions(uuid);

-- Create certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank >= 1 AND rank <= 10),
  certificate_code text NOT NULL UNIQUE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  username text NOT NULL,
  contest_name text NOT NULL,
  contest_date timestamp with time zone NOT NULL,
  UNIQUE(user_id, contest_id)
);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view certificates"
ON public.certificates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage certificates"
ON public.certificates FOR ALL
USING (is_admin());

-- Create shuffle seed table to store per-user shuffle seeds
CREATE TABLE IF NOT EXISTS public.user_shuffle_seeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, contest_id)
);

-- Enable RLS
ALTER TABLE public.user_shuffle_seeds ENABLE ROW LEVEL SECURITY;

-- Users can only view their own seeds
CREATE POLICY "Users can view their own seeds"
ON public.user_shuffle_seeds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert seeds"
ON public.user_shuffle_seeds FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create new get_contest_questions function with shuffling
CREATE OR REPLACE FUNCTION public.get_contest_questions(p_contest_id uuid)
RETURNS TABLE(id uuid, question_text text, code_block text, options jsonb, difficulty text, tags text[], option_mapping jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contest record;
  v_user_id uuid;
  v_seed integer;
BEGIN
  v_user_id := auth.uid();
  
  SELECT * INTO v_contest FROM public.contests WHERE contests.id = p_contest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found';
  END IF;

  IF NOW() < v_contest.start_time THEN
    RAISE EXCEPTION 'Contest has not started yet';
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT seed INTO v_seed FROM public.user_shuffle_seeds 
    WHERE user_id = v_user_id AND contest_id = p_contest_id;
    
    IF v_seed IS NULL THEN
      v_seed := floor(random() * 2147483647)::integer;
      INSERT INTO public.user_shuffle_seeds (user_id, contest_id, seed)
      VALUES (v_user_id, p_contest_id, v_seed)
      ON CONFLICT (user_id, contest_id) DO NOTHING;
      
      SELECT seed INTO v_seed FROM public.user_shuffle_seeds 
      WHERE user_id = v_user_id AND contest_id = p_contest_id;
    END IF;
  ELSE
    v_seed := 0;
  END IF;

  RETURN QUERY
  WITH base_questions AS (
    SELECT 
      q.id,
      q.question_text,
      q.code_block,
      q.options,
      q.difficulty,
      q.tags,
      cq.order_index
    FROM public.questions q
    JOIN public.contest_questions cq ON cq.question_id = q.id
    WHERE cq.contest_id = p_contest_id
  ),
  shuffled AS (
    SELECT 
      bq.*,
      (v_seed + ('x' || substr(md5(bq.id::text), 1, 8))::bit(32)::int) as shuffle_key
    FROM base_questions bq
  )
  SELECT 
    s.id,
    s.question_text,
    s.code_block,
    (
      SELECT jsonb_agg(opt ORDER BY idx_shuffle)
      FROM (
        SELECT 
          opt,
          idx,
          (v_seed + idx + ('x' || substr(md5(s.id::text || idx::text), 1, 8))::bit(32)::int) % 100 as idx_shuffle
        FROM jsonb_array_elements_text(s.options) WITH ORDINALITY AS t(opt, idx)
      ) shuffled_opts
    ) as options,
    s.difficulty,
    s.tags,
    (
      SELECT jsonb_object_agg(new_idx::text, (orig_idx - 1)::text)
      FROM (
        SELECT 
          idx as orig_idx,
          ROW_NUMBER() OVER (ORDER BY (v_seed + idx + ('x' || substr(md5(s.id::text || idx::text), 1, 8))::bit(32)::int) % 100) as new_idx
        FROM jsonb_array_elements_text(s.options) WITH ORDINALITY AS t(opt, idx)
      ) mapping
    ) as option_mapping
  FROM shuffled s
  ORDER BY s.shuffle_key;
END;
$function$;

-- Update save_quiz_answer to handle shuffled options
CREATE OR REPLACE FUNCTION public.save_quiz_answer(p_contest_id uuid, p_question_id uuid, p_selected_answer integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_contest record;
  v_correct_answer integer;
  v_is_correct boolean;
  v_seed integer;
  v_original_answer integer;
  v_option_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contest not found');
  END IF;

  IF NOW() < v_contest.start_time OR NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') THEN
    RETURN jsonb_build_object('error', 'Contest is not live');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contest_results 
    WHERE contest_id = p_contest_id AND user_id = v_user_id AND completed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Quiz already submitted');
  END IF;

  SELECT seed INTO v_seed FROM public.user_shuffle_seeds 
  WHERE user_id = v_user_id AND contest_id = p_contest_id;

  SELECT q.correct_answer, jsonb_array_length(q.options) INTO v_correct_answer, v_option_count
  FROM public.questions q
  JOIN public.contest_questions cq ON cq.question_id = q.id
  WHERE q.id = p_question_id AND cq.contest_id = p_contest_id;

  IF v_correct_answer IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found in contest');
  END IF;

  IF v_seed IS NOT NULL AND v_option_count > 0 THEN
    WITH shuffle_mapping AS (
      SELECT 
        idx as orig_idx,
        ROW_NUMBER() OVER (ORDER BY (v_seed + idx + ('x' || substr(md5(p_question_id::text || idx::text), 1, 8))::bit(32)::int) % 100) - 1 as shuffled_idx
      FROM generate_series(1, v_option_count) as idx
    )
    SELECT orig_idx - 1 INTO v_original_answer
    FROM shuffle_mapping
    WHERE shuffled_idx = p_selected_answer;
  ELSE
    v_original_answer := p_selected_answer;
  END IF;

  v_is_correct := (v_original_answer = v_correct_answer);

  INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
  VALUES (v_user_id, p_contest_id, p_question_id, v_original_answer, v_is_correct)
  ON CONFLICT (user_id, contest_id, question_id) 
  DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update submit_quiz_answers to handle shuffled options
CREATE OR REPLACE FUNCTION public.submit_quiz_answers(p_contest_id uuid, p_answers jsonb, p_started_at timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_original_answer integer;
  v_is_correct boolean;
  v_seed integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contest not found');
  END IF;

  IF NOW() < v_contest.start_time THEN
    RETURN jsonb_build_object('error', 'Contest has not started yet');
  END IF;
  
  IF NOW() >= v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') THEN
    RETURN jsonb_build_object('error', 'Contest has ended');
  END IF;

  SELECT * INTO v_existing_result 
  FROM public.contest_results 
  WHERE contest_id = p_contest_id AND user_id = v_user_id AND completed_at IS NOT NULL;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'score', v_existing_result.score,
      'total_questions', v_existing_result.total_questions,
      'time_taken_seconds', v_existing_result.time_taken_seconds
    );
  END IF;

  SELECT seed INTO v_seed FROM public.user_shuffle_seeds 
  WHERE user_id = v_user_id AND contest_id = p_contest_id;

  FOR v_question IN
    SELECT q.id, q.correct_answer, jsonb_array_length(q.options) as option_count
    FROM public.contest_questions cq
    JOIN public.questions q ON q.id = cq.question_id
    WHERE cq.contest_id = p_contest_id
  LOOP
    v_total_questions := v_total_questions + 1;
    
    v_answer_entry := p_answers->v_question.id::text;
    IF v_answer_entry IS NOT NULL THEN
      v_selected_answer := (v_answer_entry)::integer;
      
      IF v_seed IS NOT NULL AND v_question.option_count > 0 THEN
        WITH shuffle_mapping AS (
          SELECT 
            idx as orig_idx,
            ROW_NUMBER() OVER (ORDER BY (v_seed + idx + ('x' || substr(md5(v_question.id::text || idx::text), 1, 8))::bit(32)::int) % 100) - 1 as shuffled_idx
          FROM generate_series(1, v_question.option_count) as idx
        )
        SELECT orig_idx - 1 INTO v_original_answer
        FROM shuffle_mapping
        WHERE shuffled_idx = v_selected_answer;
      ELSE
        v_original_answer := v_selected_answer;
      END IF;
      
      v_is_correct := (v_original_answer = v_question.correct_answer);
      
      IF v_is_correct THEN
        v_score := v_score + 1;
      END IF;

      INSERT INTO public.submissions (user_id, contest_id, question_id, selected_answer, is_correct)
      VALUES (v_user_id, p_contest_id, v_question.id, v_original_answer, v_is_correct)
      ON CONFLICT (user_id, contest_id, question_id) 
      DO UPDATE SET selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct;
    END IF;
  END LOOP;

  v_time_taken := EXTRACT(EPOCH FROM (NOW() - p_started_at))::integer;

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
$function$;

-- Function to generate certificate for top 10
CREATE OR REPLACE FUNCTION public.generate_certificate(p_contest_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contest record;
  v_result record;
  v_profile record;
  v_rank integer;
  v_cert_code text;
  v_existing_cert record;
BEGIN
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contest not found');
  END IF;

  IF NOW() < v_contest.start_time + (v_contest.duration_minutes * INTERVAL '1 minute') THEN
    RETURN jsonb_build_object('error', 'Contest has not ended yet');
  END IF;

  WITH ranked_results AS (
    SELECT 
      user_id,
      score,
      time_taken_seconds,
      ROW_NUMBER() OVER (ORDER BY score DESC, time_taken_seconds ASC) as rank
    FROM public.contest_results
    WHERE contest_id = p_contest_id AND completed_at IS NOT NULL
  )
  SELECT * INTO v_result FROM ranked_results WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User did not participate in this contest');
  END IF;

  v_rank := v_result.rank;

  IF v_rank > 10 THEN
    RETURN jsonb_build_object('error', 'Only top 10 can receive certificates');
  END IF;

  SELECT * INTO v_existing_cert FROM public.certificates
  WHERE user_id = p_user_id AND contest_id = p_contest_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'certificate_id', v_existing_cert.id,
      'certificate_code', v_existing_cert.certificate_code
    );
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  v_cert_code := 'JCA-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.certificates (user_id, contest_id, rank, certificate_code, username, contest_name, contest_date)
  VALUES (p_user_id, p_contest_id, v_rank, v_cert_code, v_profile.username, v_contest.name, v_contest.start_time);

  RETURN jsonb_build_object(
    'success', true,
    'certificate_code', v_cert_code,
    'rank', v_rank
  );
END;
$function$;

-- Function to get certificate by code (for public sharing)
CREATE OR REPLACE FUNCTION public.get_certificate_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cert record;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE certificate_code = p_code;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_cert.id,
    'username', v_cert.username,
    'contest_name', v_cert.contest_name,
    'contest_date', v_cert.contest_date,
    'rank', v_cert.rank,
    'certificate_code', v_cert.certificate_code,
    'issued_at', v_cert.issued_at
  );
END;
$function$;