-- Daily challenge: one seeded question per day, plus per-user streak tracking.
-- A challenge row owns the question of the day; attempts and streaks are
-- per-user and cascade away with the auth user.

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_challenges_question_id_idx
  ON public.daily_challenges(question_id);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view daily challenges" ON public.daily_challenges;
CREATE POLICY "Anyone can view daily challenges"
ON public.daily_challenges FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage daily challenges" ON public.daily_challenges;
CREATE POLICY "Admins can manage daily challenges"
ON public.daily_challenges FOR ALL
USING (is_admin());

CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS daily_challenge_attempts_challenge_id_idx
  ON public.daily_challenge_attempts(challenge_id);

ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily attempts" ON public.daily_challenge_attempts;
CREATE POLICY "Users can view their own daily attempts"
ON public.daily_challenge_attempts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage daily attempts" ON public.daily_challenge_attempts;
CREATE POLICY "Admins can manage daily attempts"
ON public.daily_challenge_attempts FOR ALL
USING (is_admin());

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_streaks_ranking_idx
  ON public.user_streaks(current_streak DESC, longest_streak DESC, total_completed DESC);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view streaks" ON public.user_streaks;
CREATE POLICY "Anyone can view streaks"
ON public.user_streaks FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage streaks" ON public.user_streaks;
CREATE POLICY "Admins can manage streaks"
ON public.user_streaks FOR ALL
USING (is_admin());

-- Pre-generate the next 30 days so the challenge is ready before anyone opens
-- the page. ensure_daily_challenge() fills in anything missing afterwards.
INSERT INTO public.daily_challenges (challenge_date, question_id)
SELECT
  (CURRENT_DATE + (rn - 1)::integer) AS challenge_date,
  q.id AS question_id
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY md5(id::text || 'daily-challenge')) AS rn
  FROM public.questions
  WHERE question_type = 'multiple_choice'
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof(options) = 'array' THEN options ELSE '[]'::jsonb END
    ) = 4
) q
WHERE q.rn <= 30
ON CONFLICT (challenge_date) DO NOTHING;
