-- Fix integer overflow in shuffle calculations ("integer out of range")
-- by using bigint math in get_contest_questions.

CREATE OR REPLACE FUNCTION public.get_contest_questions(p_contest_id uuid)
RETURNS TABLE(
  id uuid,
  question_text text,
  code_block text,
  options jsonb,
  difficulty text,
  tags text[],
  option_mapping jsonb
)
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
      (
        v_seed::bigint +
        (('x' || substr(md5(bq.id::text), 1, 8))::bit(32)::bigint)
      ) as shuffle_key
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
          (
            (
              v_seed::bigint +
              idx::bigint +
              (('x' || substr(md5(s.id::text || idx::text), 1, 8))::bit(32)::bigint)
            ) % 100
          ) as idx_shuffle
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
          ROW_NUMBER() OVER (
            ORDER BY (
              (
                v_seed::bigint +
                idx::bigint +
                (('x' || substr(md5(s.id::text || idx::text), 1, 8))::bit(32)::bigint)
              ) % 100
            )
          ) as new_idx
        FROM jsonb_array_elements_text(s.options) WITH ORDINALITY AS t(opt, idx)
      ) mapping
    ) as option_mapping
  FROM shuffled s
  ORDER BY s.shuffle_key;
END;
$function$;
