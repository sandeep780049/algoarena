
-- GATE Questions table (separate from existing questions)
CREATE TABLE public.gate_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text,
  difficulty text NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  code_block text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer integer NOT NULL,
  explanation text,
  tags text[] DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GATE Practice Sessions (quiz-style sets)
CREATE TABLE public.gate_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GATE Practice Answers (individual answers in a session)
CREATE TABLE public.gate_practice_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gate_practice_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.gate_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  selected_answer integer NOT NULL,
  is_correct boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gate_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_practice_answers ENABLE ROW LEVEL SECURITY;

-- gate_questions: anyone can read, admins can manage
CREATE POLICY "Anyone can view gate questions" ON public.gate_questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage gate questions" ON public.gate_questions
  FOR ALL USING (public.is_admin());

-- gate_practice_sessions: users manage their own
CREATE POLICY "Users can view their own sessions" ON public.gate_practice_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.gate_practice_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.gate_practice_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.gate_practice_sessions
  FOR SELECT USING (public.is_admin());

-- gate_practice_answers: users manage their own
CREATE POLICY "Users can view their own answers" ON public.gate_practice_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers" ON public.gate_practice_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all answers" ON public.gate_practice_answers
  FOR SELECT USING (public.is_admin());

-- Index for fast subject-based queries
CREATE INDEX idx_gate_questions_subject ON public.gate_questions(subject);
CREATE INDEX idx_gate_questions_difficulty ON public.gate_questions(difficulty);
CREATE INDEX idx_gate_practice_sessions_user ON public.gate_practice_sessions(user_id);
CREATE INDEX idx_gate_practice_answers_session ON public.gate_practice_answers(session_id);
CREATE INDEX idx_gate_practice_answers_user_question ON public.gate_practice_answers(user_id, question_id);
