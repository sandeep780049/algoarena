-- Add CHECK constraints for server-side input validation on questions table
ALTER TABLE public.questions 
ADD CONSTRAINT question_text_length CHECK (length(question_text) <= 2000);

ALTER TABLE public.questions 
ADD CONSTRAINT explanation_length CHECK (explanation IS NULL OR length(explanation) <= 2000);

ALTER TABLE public.questions 
ADD CONSTRAINT code_block_length CHECK (code_block IS NULL OR length(code_block) <= 5000);

ALTER TABLE public.questions 
ADD CONSTRAINT correct_answer_range CHECK (correct_answer >= 0 AND correct_answer <= 9);

-- Add CHECK constraints for server-side input validation on contests table
ALTER TABLE public.contests 
ADD CONSTRAINT contest_name_length CHECK (length(name) <= 200);

ALTER TABLE public.contests 
ADD CONSTRAINT contest_description_length CHECK (description IS NULL OR length(description) <= 1000);

ALTER TABLE public.contests 
ADD CONSTRAINT contest_code_length CHECK (length(contest_code) <= 50);

ALTER TABLE public.contests 
ADD CONSTRAINT duration_minutes_range CHECK (duration_minutes >= 1 AND duration_minutes <= 480);

-- Add CHECK constraints for profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT username_length CHECK (length(username) >= 1 AND length(username) <= 50);