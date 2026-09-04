-- Create contest_registrations table
CREATE TABLE IF NOT EXISTS public.contest_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, contest_id)
);

-- Enable RLS
ALTER TABLE public.contest_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view registrations" ON public.contest_registrations
  FOR SELECT USING (true);

CREATE POLICY "Users can register themselves" ON public.contest_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own registration" ON public.contest_registrations
  FOR DELETE USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_contest_registrations_contest ON public.contest_registrations(contest_id);
CREATE INDEX idx_contest_registrations_user ON public.contest_registrations(user_id);