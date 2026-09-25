import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StreakCard } from '@/components/daily/StreakCard';
import { StreakCalendar } from '@/components/daily/StreakCalendar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type {
  DailyChallenge,
  DailyChallengeResult,
  DailyStreak,
  StreakLeaderboardEntry,
} from '@/lib/supabase';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const UNAVAILABLE_MESSAGE =
  'The daily challenge is not available right now. Please try again later.';

function isMissingFunctionError(error: { code?: string; message: string }) {
  return error.code === 'PGRST202' || /does not exist/i.test(error.message);
}

export default function DailyChallenge() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const [leaders, setLeaders] = useState<StreakLeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<DailyChallengeResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_daily_challenge');
    if (error) {
      setLoadError(isMissingFunctionError(error) ? UNAVAILABLE_MESSAGE : error.message);
      return;
    }

    const row = (data as DailyChallenge[] | null)?.[0] ?? null;
    setChallenge(row);
    if (row?.already_completed) {
      setSelected(row.selected_answer);
    }
  }, []);

  const loadStreak = useCallback(async () => {
    if (!user) {
      setStreak(null);
      return;
    }

    const { data } = await supabase.rpc('get_daily_challenge_streak');
    setStreak((data as unknown as DailyStreak | null) ?? null);
  }, [user]);

  const loadLeaders = useCallback(async () => {
    const { data } = await supabase.rpc('get_streak_leaderboard', { p_limit: 10 });
    setLeaders((data as StreakLeaderboardEntry[] | null) ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      await Promise.all([loadChallenge(), loadStreak(), loadLeaders()]);
      if (active) {
        setLoading(false);
      }
    };

    if (!authLoading) {
      load();
    }

    return () => {
      active = false;
    };
  }, [authLoading, loadChallenge, loadStreak, loadLeaders]);

  const revealed = Boolean(challenge?.already_completed) || result !== null;
  const justSubmitted = result !== null;
  const playing = Boolean(challenge) && !challenge?.already_completed && result === null;

  useEffect(() => {
    if (!playing) return;

    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [playing]);

  const handleSubmit = async () => {
    if (!challenge || selected === null) return;

    setSubmitting(true);

    const { data, error } = await supabase.rpc('submit_daily_challenge', {
      p_challenge_id: challenge.id,
      p_selected_answer: selected,
      p_time_taken_seconds: elapsed,
    });

    if (error || !data) {
      toast({
        title: 'Submission failed',
        description: error?.message ?? 'Could not submit your answer. Try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    const payload = data as unknown as DailyChallengeResult;

    if (payload.error) {
      toast({ title: 'Cannot submit', description: payload.error, variant: 'destructive' });
      if (payload.already_completed) {
        setResult(null);
        await loadChallenge();
      }
      setSubmitting(false);
      return;
    }

    setResult(payload);
    await Promise.all([loadStreak(), loadLeaders()]);
    setSubmitting(false);
  };

  const answerIndex = result ? result.correct_answer ?? null : challenge?.correct_answer ?? null;
  const chosenIndex = result ? selected : challenge?.selected_answer ?? null;
  const solvedCorrectly = result ? result.is_correct === true : challenge?.is_correct === true;
  const explanationText = result ? result.explanation ?? null : challenge?.explanation ?? null;
  const options = challenge?.options ?? [];

  return (
    <Layout>
      <SEO
        title="Daily Challenge"
        description="Solve one coding question every day, build your streak, and climb the daily challenge leaderboard on JC AlgoArena."
        path="/daily"
      />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glow-warning/10 border border-glow-warning/20 text-glow-warning text-sm font-medium mb-4">
              <Flame className="h-4 w-4" />
              Daily Challenge
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">One question. Every day.</h1>
            <p className="text-muted-foreground">
              {challenge?.challenge_date
                ? `Challenge for ${format(parseISO(challenge.challenge_date), 'MMMM d, yyyy')}`
                : 'A new question drops every day at midnight UTC.'}
            </p>
            {streak && streak.current_streak > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
                <Flame className="h-4 w-4 text-glow-warning" />
                <span className="text-sm">
                  <span className="font-bold text-glow-warning">{streak.current_streak}</span>{' '}
                  <span className="text-muted-foreground">day streak</span>
                </span>
              </div>
            )}
          </div>

          {loading || authLoading ? (
            <div className="bg-card border border-border rounded-xl p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Could not load today&apos;s challenge</h2>
              <p className="text-muted-foreground mb-6">{loadError}</p>
              <Button onClick={() => window.location.reload()}>Try again</Button>
            </div>
          ) : !challenge ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No challenge available today</h2>
              <p className="text-muted-foreground mb-6">
                Check back tomorrow, or enter a live contest in the meantime.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link to="/contests">
                  <Button variant="outline">Browse Contests</Button>
                </Link>
                <Link to="/">
                  <Button>Back to Home</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <Target className="h-3 w-3 mr-1" />
                    {challenge.difficulty || 'medium'}
                  </Badge>
                  {playing && (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatElapsed(elapsed)}
                    </span>
                  )}
                  {revealed && (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      {justSubmitted ? (
                        <>
                          <Clock className="h-4 w-4" />
                          Answered in {formatElapsed(elapsed)}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Completed
                        </>
                      )}
                    </span>
                  )}
                </div>

                <h2 className="text-lg md:text-xl font-medium mb-6">{challenge.question_text}</h2>

                {challenge.code_block && (
                  <pre className="bg-secondary p-4 rounded-lg mb-6 overflow-x-auto text-sm font-mono">
                    <code>{challenge.code_block}</code>
                  </pre>
                )}

                <div className="space-y-3">
                  {options.map((option, idx) => {
                    const isChosen = chosenIndex === idx;
                    const isAnswer = answerIndex === idx;

                    let optionClass = 'bg-secondary border-border hover:border-primary/50';
                    let badgeClass = 'bg-background';

                    if (revealed) {
                      if (isAnswer) {
                        optionClass = 'bg-glow-success/10 border-glow-success text-glow-success';
                        badgeClass = 'bg-glow-success text-white';
                      } else if (isChosen) {
                        optionClass = 'bg-destructive/10 border-destructive text-destructive';
                        badgeClass = 'bg-destructive text-white';
                      } else {
                        optionClass = 'bg-secondary border-border opacity-60';
                      }
                    } else if (isChosen) {
                      optionClass = 'bg-primary/10 border-primary text-primary';
                      badgeClass = 'bg-primary text-primary-foreground';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={revealed || !user}
                        onClick={() => setSelected(idx)}
                        className={`w-full text-left p-4 rounded-lg border transition-all disabled:cursor-default ${optionClass}`}
                      >
                        <span className="inline-flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${badgeClass}`}
                          >
                            {revealed && isAnswer ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : revealed && isChosen ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              String.fromCharCode(65 + idx)
                            )}
                          </span>
                          {option}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {revealed && (
                  <div
                    className={`mt-6 p-4 rounded-lg border ${
                      solvedCorrectly
                        ? 'bg-glow-success/10 border-glow-success/30'
                        : 'bg-destructive/10 border-destructive/30'
                    }`}
                  >
                    <p
                      className={`font-semibold flex items-center gap-2 ${
                        solvedCorrectly ? 'text-glow-success' : 'text-destructive'
                      }`}
                    >
                      {solvedCorrectly ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" /> Correct!
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5" /> Not quite
                        </>
                      )}
                    </p>
                    {answerIndex !== null && !solvedCorrectly && (
                      <p className="text-sm mt-2">
                        The correct answer is{' '}
                        <span className="font-bold text-glow-success">
                          {String.fromCharCode(65 + answerIndex)}
                        </span>
                        .
                      </p>
                    )}
                    {explanationText && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <p className="text-sm font-medium flex items-center gap-2 mb-1">
                          <Lightbulb className="h-4 w-4 text-glow-warning" />
                          Explanation
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {explanationText}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  {user ? (
                    playing ? (
                      <Button
                        className="w-full bg-primary"
                        disabled={selected === null || submitting}
                        onClick={handleSubmit}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Answer'
                        )}
                      </Button>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">
                        Come back tomorrow for a fresh question.
                      </p>
                    )
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Sign in to lock in today&apos;s answer and start your streak.
                      </p>
                      <Link to="/auth?returnTo=%2Fdaily">
                        <Button className="bg-primary">
                          Sign In to Play
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {user && (
                <div className="space-y-6">
                  <StreakCard
                    currentStreak={streak?.current_streak ?? 0}
                    longestStreak={streak?.longest_streak ?? 0}
                    totalCompleted={streak?.total_completed ?? 0}
                    completedToday={streak?.completed_today ?? false}
                  />

                  <StreakCalendar
                    history={streak?.history ?? []}
                    todayKey={challenge.challenge_date}
                  />
                </div>
              )}

              {leaders.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-6 mt-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-glow-warning" />
                      Top Streaks
                    </h2>
                    <span className="text-sm text-muted-foreground">All time</span>
                  </div>

                  <div className="space-y-2">
                    {leaders.map((entry) => (
                      <div
                        key={entry.user_id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50"
                      >
                        <span className="w-8 text-center font-bold text-muted-foreground">
                          {entry.rank}
                        </span>
                        <Avatar className="w-9 h-9 border border-border">
                          <AvatarImage src={entry.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-sm">
                            {entry.username?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Best {entry.longest_streak} · {entry.total_completed} played
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-primary font-bold">
                          <Flame className="h-4 w-4 text-glow-warning" />
                          {entry.current_streak}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
