-- Remove all GATE-related backend artifacts.
DELETE FROM public.contests WHERE contest_type::text = 'gate';

DROP FUNCTION IF EXISTS public.get_gate_contest_questions(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.submit_gate_quiz_answers(uuid, jsonb, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.save_gate_quiz_answer(uuid, uuid, integer) CASCADE;

DROP TABLE IF EXISTS public.gate_contest_submissions CASCADE;
DROP TABLE IF EXISTS public.gate_contest_questions CASCADE;
DROP TABLE IF EXISTS public.gate_practice_answers CASCADE;
DROP TABLE IF EXISTS public.gate_practice_sessions CASCADE;
DROP TABLE IF EXISTS public.gate_questions CASCADE;