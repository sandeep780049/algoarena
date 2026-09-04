import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Types for database
export type AppRole = 'admin' | 'user';
export type ContestStatus = 'upcoming' | 'live' | 'ended';
export type ContestType = 'daily' | 'weekly' | 'special';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  code_block: string | null;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  difficulty: string;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contest {
  id: string;
  name: string;
  description: string | null;
  contest_type: ContestType;
  contest_code: string;
  start_time: string;
  duration_minutes: number;
  status: ContestStatus;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContestQuestion {
  id: string;
  contest_id: string;
  question_id: string;
  order_index: number;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string;
  contest_id: string;
  question_id: string;
  selected_answer: number;
  is_correct: boolean;
  submitted_at: string;
}

export interface ContestResult {
  id: string;
  user_id: string;
  contest_id: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
