import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAntiCheat } from '@/hooks/useAntiCheat';
import { EarlySubmitDialog } from '@/components/quiz/EarlySubmitDialog';
import type { Contest } from '@/lib/supabase';
import { 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Timer,
  Flag,
  Trophy,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { addMinutes, differenceInSeconds } from 'date-fns';

interface QuizQuestion {
  id: string;
  question_text: string;
  code_block: string | null;
  options: string[];
  option_mapping?: Record<string, string>;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number;
}

interface MyContestResultResponse {
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
}

interface SubmitQuizResponse {
  success?: boolean;
  error?: string;
  already_submitted?: boolean;
  score?: number;
  total_questions?: number;
  time_taken_seconds?: number;
  percentage?: number;
}

export default function Quiz() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showEarlySubmitDialog, setShowEarlySubmitDialog] = useState(false);
  
  
  // Prevent double submission
  const isSubmittingRef = useRef(false);

  // Enable anti-cheat protections when contest is active
  useAntiCheat(!hasCompleted && !quizResult && !loading && questions.length > 0);

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('redirectAfterAuth', `/quiz/${id}`);
      navigate('/auth');
      return;
    }
    if (id) {
      fetchQuizData();
    }
  }, [id, user]);

  useEffect(() => {
    if (!contest || !startedAt || hasCompleted || quizResult) return;
    
    const endTime = addMinutes(new Date(contest.start_time), contest.duration_minutes);
    
    const updateTimer = () => {
      const now = new Date();
      const diff = differenceInSeconds(endTime, now);
      
      if (diff <= 0) {
        handleSubmit();
        return;
      }
      
      setTimeRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [contest, startedAt, hasCompleted, quizResult]);

  const fetchQuizData = async () => {
    try {
      // FIRST: Check if user has already attempted this contest
      if (user) {
        const { data: existingResultData, error: resultError } = await supabase.rpc('get_my_contest_result', {
          p_contest_id: id
        });

        if (resultError) {
          console.error('Error checking existing result:', resultError);
        }

        const existingResult = existingResultData as unknown as MyContestResultResponse | null;

        if (existingResult && existingResult.completed_at) {
          setHasCompleted(true);
          setQuizResult({
            score: existingResult.score || 0,
            totalQuestions: existingResult.total_questions || 0,
            percentage: existingResult.total_questions 
              ? Math.round((existingResult.score || 0) / existingResult.total_questions * 100) 
              : 0,
            timeTaken: existingResult.time_taken_seconds || 0,
          });
          setContest({ id, name: 'Quiz', start_time: '', duration_minutes: 0, status: 'ended' } as Contest);
          setLoading(false);
          toast({
            title: 'Already Attempted',
            description: 'You have already completed this contest. Showing your result.',
          });
          return;
        }
      }

      const { data: contestData, error: contestError } = await supabase
        .from('contests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (contestError) throw contestError;
      if (!contestData) {
        toast({
          title: 'Contest not found',
          description: 'This contest does not exist.',
          variant: 'destructive',
        });
        navigate('/contests');
        return;
      }

      const contestTyped = contestData as Contest;
      setContest(contestTyped);
      // Calculate actual contest status based on time (don't rely on stored status)
      // Keep frontend aligned with backend rules (includes 1-minute grace period after end).
      const startTime = new Date(contestTyped.start_time);
      const endTime = addMinutes(startTime, contestTyped.duration_minutes);
      const endTimeWithGrace = addMinutes(endTime, 1);
      const now = new Date();

      if (now < startTime) {
        toast({
          title: 'Contest not started',
          description: 'This contest has not started yet. Please wait for the start time.',
          variant: 'destructive',
        });
        navigate(`/contest/${id}`);
        return;
      }

      // Allow users who are already in-progress to load/submit during the grace window.
      if (now >= endTimeWithGrace) {
        toast({
          title: 'Contest ended',
          description: 'This contest has ended. You cannot participate anymore.',
          variant: 'destructive',
        });
        navigate(`/contest/${id}`);
        return;
      }

      // SECURITY: Use secure RPC function with shuffled questions/options
      const { data: questionsData, error: questionsError } = await supabase
        .rpc('get_contest_questions', { p_contest_id: id });

      if (questionsError) throw new Error(questionsError.message);
      if (!questionsData || !Array.isArray(questionsData) || questionsData.length === 0) {
        toast({ title: 'No Questions', description: 'This contest has no questions available.', variant: 'destructive' });
        navigate(`/contest/${id}`);
        return;
      }

      const formattedQuestions: QuizQuestion[] = questionsData.map((q) => ({
        id: q.id as string,
        question_text: q.question_text as string,
        code_block: q.code_block as string | null,
        options: (Array.isArray(q.options) ? q.options : []) as string[],
        option_mapping: q.option_mapping as Record<string, string> | undefined,
      }));

      setQuestions(formattedQuestions);

      if (user) {
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('question_id, selected_answer')
          .eq('contest_id', id)
          .eq('user_id', user.id);
        if (submissionsData) {
          const savedAnswers: Record<string, number> = {};
          submissionsData.forEach(sub => { savedAnswers[sub.question_id] = sub.selected_answer; });
          setAnswers(savedAnswers);
        }
      }

      setStartedAt(new Date());
      
    } catch (error: unknown) {
      console.error('Error fetching quiz:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load quiz. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAnswer = async (questionId: string, answerIndex: number | null) => {
    if (!user || !contest) return;
    if (answerIndex !== null && (answerIndex < 0 || answerIndex > 3)) return;

    try {
      await supabase.rpc('save_quiz_answer', {
        p_contest_id: contest.id,
        p_question_id: questionId,
        p_selected_answer: answerIndex ?? -1
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const selectAnswer = (answerIndex: number) => {
    const question = questions[currentIndex];
    if (!question || hasCompleted || quizResult) return;

    const currentAnswer = answers[question.id];
    
    // Toggle: if same option clicked, deselect it
    if (currentAnswer === answerIndex) {
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[question.id];
        return newAnswers;
      });
      saveAnswer(question.id, null);
    } else {
      setAnswers(prev => ({
        ...prev,
        [question.id]: answerIndex,
      }));
      saveAnswer(question.id, answerIndex);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !contest || isSubmittingRef.current || quizResult || hasCompleted) return;
    
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      let responseData: unknown = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.rpc('submit_quiz_answers', {
          p_contest_id: contest.id,
          p_answers: answers,
          p_started_at: startedAt?.toISOString() || new Date().toISOString(),
        });

        if (!error) { responseData = data; lastError = null; break; }
        lastError = error;
        const msg = (error as { message?: string })?.message || '';
        const isTransient = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timeout') || msg.includes('502') || msg.includes('503') || msg.includes('504');
        if (!isTransient || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 600));
      }

      if (lastError) throw lastError;

      const data = responseData as SubmitQuizResponse | null;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.already_submitted) {
        setQuizResult({
          score: data.score || 0,
          totalQuestions: data.total_questions || 0,
          percentage: data.total_questions 
            ? Math.round((data.score || 0) / data.total_questions * 100) 
            : 0,
          timeTaken: data.time_taken_seconds || 0,
        });
        setHasCompleted(true);
        toast({
          title: 'Quiz already submitted',
          description: 'Showing your previous result.',
        });
        return;
      }

      const percentage = (data?.total_questions || 0) > 0 
        ? Math.round(((data?.score || 0) / (data?.total_questions || 1)) * 100) 
        : 0;

      setQuizResult({
        score: data?.score || 0,
        totalQuestions: data?.total_questions || 0,
        percentage,
        timeTaken: data?.time_taken_seconds || 0,
      });
      setHasCompleted(true);

      toast({
        title: 'Quiz submitted!',
        description: `You scored ${data?.score || 0} out of ${data?.total_questions || 0} (${percentage}%)`,
      });
    } catch (error: unknown) {
      const errorMessage = (() => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
          const anyErr = error as Record<string, unknown>;
          const msg = anyErr.message;
          const details = anyErr.details;
          const hint = anyErr.hint;
          if (typeof msg === 'string' && msg.trim()) return msg;
          if (typeof details === 'string' && details.trim()) return details;
          if (typeof hint === 'string' && hint.trim()) return hint;
        }
        return 'Failed to submit quiz. Please try again.';
      })();

      console.error('Error submitting quiz:', error);

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      isSubmittingRef.current = false;
    }
  }, [user, contest, startedAt, answers, quizResult, hasCompleted, toast]);

  const handleSubmitClick = () => {
    // Always show early-confirmation dialog when time is remaining
    if (timeRemaining > 0) {
      setShowEarlySubmitDialog(true);
    } else {
      // Time's up - submit directly
      handleSubmit();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (quizResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="mb-6">
              {quizResult.percentage >= 70 ? (
                <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto" />
              ) : quizResult.percentage >= 40 ? (
                <Trophy className="h-20 w-20 text-amber-500 mx-auto" />
              ) : (
                <XCircle className="h-20 w-20 text-destructive mx-auto" />
              )}
            </div>

            <h1 className="text-2xl font-bold mb-2">
              Quiz Completed!
            </h1>
            
            <p className="text-muted-foreground mb-6">
              Great job completing the quiz!
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-3xl font-bold text-primary">{quizResult.score}</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-3xl font-bold">{quizResult.totalQuestions}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-3xl font-bold text-primary">{quizResult.percentage}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted mb-6">
              <p className="text-sm text-muted-foreground">Time Taken</p>
              <p className="text-xl font-mono font-bold">
                {Math.floor(quizResult.timeTaken / 60)}m {quizResult.timeTaken % 60}s
              </p>
            </div>

            <div className="space-y-3">
              <Link to={`/leaderboard?contest=${contest?.id}`} className="block">
                <Button className="w-full" size="lg">
                  <Trophy className="h-4 w-4 mr-2" />
                  View Leaderboard
                </Button>
              </Link>
              <Link to="/contests" className="block">
                <Button variant="outline" className="w-full" size="lg">
                  Browse More Contests
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contest || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Quiz not available</h2>
          <Button onClick={() => navigate('/contests')}>Back to Contests</Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const options = Array.isArray(currentQuestion.options) 
    ? currentQuestion.options as string[]
    : [];
  const answeredCount = Object.keys(answers).length;
  const isUrgent = timeRemaining < 60;

  return (
    <div className="min-h-screen bg-background">
      {/* Early Submit Confirmation Dialog */}
      <EarlySubmitDialog
        open={showEarlySubmitDialog}
        onOpenChange={setShowEarlySubmitDialog}
        onConfirm={() => {
          setShowEarlySubmitDialog(false);
          handleSubmit();
        }}
        answeredCount={answeredCount}
        totalQuestions={questions.length}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="font-semibold truncate max-w-[200px] md:max-w-none">
                {contest.name}
              </h1>
              <Badge variant="outline">
                {answeredCount}/{questions.length} answered
              </Badge>
            </div>

            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isUrgent ? 'bg-destructive/20 text-destructive' : 'bg-secondary'
            }`}>
              <Timer className={`h-4 w-4 ${isUrgent ? 'animate-pulse' : ''}`} />
              <span className={`font-mono font-bold ${isUrgent ? 'timer-urgent' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Navigation */}
          <div className="flex flex-wrap gap-2 mb-8">
            {questions.map((q, idx) => (
              <Button
                key={q.id}
                variant={currentIndex === idx ? 'default' : 'outline'}
                size="sm"
                className={`w-10 h-10 p-0 ${
                  answers[q.id] !== undefined 
                    ? 'bg-primary/20 border-primary' 
                    : ''
                }`}
                onClick={() => setCurrentIndex(idx)}
              >
                {idx + 1}
              </Button>
            ))}
          </div>

          {/* Question Card */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="secondary">Question {currentIndex + 1}</Badge>
              {answers[currentQuestion.id] !== undefined && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <Flag className="h-3 w-3 mr-1" />
                  Answered
                </Badge>
              )}
            </div>

            <h2 className="text-lg md:text-xl font-medium mb-6">
              {currentQuestion.question_text}
            </h2>

            {currentQuestion.code_block && (
              <pre className="bg-secondary p-4 rounded-lg mb-6 overflow-x-auto text-sm font-mono">
                <code>{currentQuestion.code_block}</code>
              </pre>
            )}

            <div className="space-y-3">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectAnswer(idx)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    answers[currentQuestion.id] === idx
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-secondary border-border hover:border-primary/50'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      answers[currentQuestion.id] === idx
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {/* Always-visible Submit Button */}
            <Button 
              onClick={handleSubmitClick}
              disabled={submitting}
              className="bg-primary"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
