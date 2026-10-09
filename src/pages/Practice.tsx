import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type {
  PracticeAnswerResult,
  PracticeFilters,
  PracticeQuestion,
  PracticeStats,
} from '@/lib/supabase';
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';

const ALL = 'all';
const PAGE_SIZE = 10;

/** Reasons mirrored by the CHECK constraint on public.question_reports. */
const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'wrong_answer', label: 'Wrong answer marked correct' },
  { value: 'bad_explanation', label: 'Explanation is wrong or unhelpful' },
  { value: 'typo', label: 'Typo in the question or code' },
  { value: 'unclear', label: 'Question is unclear' },
  { value: 'other', label: 'Something else' },
];

const EMPTY_FILTERS: PracticeFilters = { total: 0, difficulties: [], tags: [] };

/** Colours reused from the daily challenge so both surfaces read the same way. */
const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'bg-glow-success/10 text-glow-success border-glow-success/30',
  medium: 'bg-glow-warning/10 text-glow-warning border-glow-warning/30',
  hard: 'bg-destructive/10 text-destructive border-destructive/30',
};

function difficultyClass(difficulty: string | null) {
  return DIFFICULTY_CLASS[(difficulty || 'medium').toLowerCase()] ?? DIFFICULTY_CLASS.medium;
}

export default function Practice() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [filters, setFilters] = useState<PracticeFilters>(EMPTY_FILTERS);
  const [difficulty, setDifficulty] = useState<string>(ALL);
  const [tag, setTag] = useState<string>(ALL);

  // `searchInput` is what the field holds; `search` is what has settled long
  // enough to be worth a round trip. Keeping them separate avoids firing an RPC
  // on every keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<PracticeAnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<PracticeStats | null>(null);

  // Session-only tallies. The durable copy lives in practice_attempts and is
  // re-read after every graded answer, this only drives the header live.
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const current = questions[index] ?? null;
  const revealed = result !== null;

  const loadFilters = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_practice_filters');
    if (error) return;
    setFilters((data as PracticeFilters | null) ?? EMPTY_FILTERS);
  }, []);

  const loadStats = useCallback(async () => {
    if (!user) {
      setStats(null);
      return;
    }
    const { data } = await supabase.rpc('get_practice_stats');
    setStats((data as PracticeStats | null) ?? null);
  }, [user]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await supabase.rpc('get_practice_questions', {
      p_difficulty: difficulty,
      p_tag: tag,
      p_search: search,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    });

    if (error) {
      setLoadError(error.message);
      setQuestions([]);
      setLoading(false);
      return;
    }

    setQuestions((data as PracticeQuestion[] | null) ?? []);
    setIndex(0);
    setSelected(null);
    setResult(null);
    setLoading(false);
  }, [difficulty, tag, search]);

  // Debounce the search box so each keystroke does not trigger an RPC.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;

    const timer = setTimeout(() => setSearch(trimmed), 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    if (authLoading) return;
    loadFilters();
    loadStats();
  }, [authLoading, loadFilters, loadStats]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleCheck = async () => {
    if (!current || selected === null) return;

    setChecking(true);

    const { data, error } = await supabase.rpc('check_practice_answer', {
      p_question_id: current.id,
      p_selected_answer: selected,
    });

    if (error) {
      toast({
        title: 'Could not check answer',
        description: error.message,
        variant: 'destructive',
      });
      setChecking(false);
      return;
    }

    const payload = data as PracticeAnswerResult | null;

    if (!payload || payload.error) {
      toast({
        title: 'Cannot check answer',
        description: payload?.error ?? 'Something went wrong. Try again.',
        variant: 'destructive',
      });
      setChecking(false);
      return;
    }

    setResult(payload);
    setSessionAnswered((prev) => prev + 1);
    if (payload.is_correct) {
      setSessionCorrect((prev) => prev + 1);
    }
    if (user) {
      await loadStats();
    }
    setChecking(false);
  };

  const handleNext = () => {
    if (index + 1 >= questions.length) {
      loadQuestions();
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
    setResult(null);
  };

  const submitReport = async () => {
    if (!current || !reportReason) return;

    setReportSubmitting(true);
    const { data, error } = await supabase.rpc('submit_question_report', {
      p_question_id: current.id,
      p_reason: reportReason,
      p_detail: reportDetail.trim() || null,
    });
    setReportSubmitting(false);

    if (error) {
      toast({
        title: 'Could not send report',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const payload = data as { error?: string; already_reported?: boolean } | null;
    if (payload?.error) {
      toast({ title: 'Cannot send report', description: payload.error, variant: 'destructive' });
      return;
    }

    setReportOpen(false);
    setReportReason('');
    setReportDetail('');
    toast({
      title: payload?.already_reported ? 'Already reported' : 'Report sent',
      description: payload?.already_reported
        ? 'This question is already in the review queue.'
        : 'Thanks — a moderator will take a look.',
    });
  };

  // Keyboard shortcuts: A-D / 1-4 to pick, Enter to check or advance,
  // N to skip. Matches the shortcuts already used on the quiz screen so the
  // two answering surfaces behave the same way.
  useEffect(() => {
    if (loading || !current) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      // The radio group renders focusable inputs; let Space/Enter work natively there.
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'SELECT')) {
        if (e.key === 'Enter' || e.key === ' ') return;
      }

      const key = e.key.toLowerCase();

      if (key >= 'a' && key <= 'd') {
        const optionIndex = key.charCodeAt(0) - 97;
        if (optionIndex < options.length && !revealed) {
          e.preventDefault();
          setSelected(optionIndex);
        }
        return;
      }

      if (key >= '1' && key <= '4') {
        const optionIndex = Number(key) - 1;
        if (optionIndex < options.length && !revealed) {
          e.preventDefault();
          setSelected(optionIndex);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (revealed) handleNext();
        else if (selected !== null && !checking) handleCheck();
        return;
      }

      if (key === 'n' && revealed) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, current, options.length, revealed, selected, checking, index, questions.length]);

  const sessionAccuracy = useMemo(
    () => (sessionAnswered > 0 ? Math.round((sessionCorrect / sessionAnswered) * 100) : 0),
    [sessionAnswered, sessionCorrect],
  );

  const answerIndex = result?.correct_answer ?? null;
  const solvedCorrectly = result?.is_correct === true;
  const options = current?.options ?? [];

  return (
    <Layout>
      <SEO
        title="Practice"
        description="Practise output-based coding questions filtered by difficulty and topic. Get instant feedback and explanations with no timer and no streak risk."
        path="/practice"
      />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Target className="h-4 w-4" />
              Practice Mode
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Untimed practice, instant feedback</h1>
            <p className="text-muted-foreground">
              Every question in the bank, filtered how you want. Wrong answers cost
              nothing here — that is the point.
            </p>
          </div>

          {stats && stats.total_attempted > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-glow-success" />
                  Your progress
                </h2>
                <span className="text-sm text-muted-foreground">
                  {stats.total_correct}/{stats.total_attempted} correct
                </span>
              </div>
              <Progress value={Number(stats.accuracy)} className="h-2" />
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span>{stats.accuracy}% accuracy</span>
                <span>{stats.answered_today} answered today</span>
                {Object.entries(stats.by_difficulty).map(([level, count]) => (
                  <span key={level}>
                    {level}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1.5 block" htmlFor="practice-search">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="practice-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search prompts, code, or tags…"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block" htmlFor="difficulty">
                  Difficulty
                </label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Any difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Any difficulty</SelectItem>
                    {filters.difficulties.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block" htmlFor="tag">
                  Topic
                </label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger id="tag">
                    <SelectValue placeholder="Any topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Any topic</SelectItem>
                    {filters.tags.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-xl p-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Could not load questions</h2>
              <p className="text-muted-foreground mb-6">{loadError}</p>
              <Button onClick={loadQuestions}>Try again</Button>
            </div>
          ) : !current ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No questions match those filters</h2>
              <p className="text-muted-foreground mb-6">
                {search ? `Nothing found for "${search}". ` : ''}
                Try widening the difficulty or topic selection.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() => {
                    setDifficulty(ALL);
                    setTag(ALL);
                    setSearchInput('');
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
                <Link to="/daily">
                  <Button variant="outline">Try the Daily Challenge</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                <span>
                  Question {index + 1} of {questions.length}
                </span>
                {sessionAnswered > 0 && (
                  <span>
                    Session {sessionCorrect}/{sessionAnswered} · {sessionAccuracy}%
                  </span>
                )}
              </div>
              <div className="h-1 bg-secondary rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((index + 1) / questions.length) * 100}%` }}
                />
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <Badge variant="outline" className={difficultyClass(current.difficulty)}>
                    {current.difficulty || 'medium'}
                  </Badge>
                  {revealed && (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      {solvedCorrectly ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-glow-success" />
                          Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-destructive" />
                          Incorrect
                        </>
                      )}
                    </span>
                  )}
                </div>

                <h2 className="text-lg md:text-xl font-medium mb-6">{current.question_text}</h2>

                {current.code_block && (
                  <pre className="bg-secondary p-4 rounded-lg mb-6 overflow-x-auto text-sm font-mono">
                    <code>{current.code_block}</code>
                  </pre>
                )}

                <div className="space-y-3">
                  {options.map((option, idx) => {
                    const isChosen = selected === idx;
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
                        disabled={revealed}
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
                    {result?.explanation && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <p className="text-sm font-medium flex items-center gap-2 mb-1">
                          <Lightbulb className="h-4 w-4 text-glow-warning" />
                          Explanation
                        </p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {result.explanation}
                        </p>
                      </div>
                    )}
                    {!user && (
                      <p className="text-xs text-muted-foreground mt-3">
                        <Link
                          to="/auth?returnTo=%2Fpractice"
                          className="text-primary hover:underline"
                        >
                          Sign in
                        </Link>{' '}
                        to save your progress across sessions.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  {revealed ? (
                    <Button className="w-full bg-primary" onClick={handleNext}>
                      {index + 1 >= questions.length ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          New set of questions
                        </>
                      ) : (
                        <>
                          Next question
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-primary"
                      disabled={selected === null || checking}
                      onClick={handleCheck}
                    >
                      {checking ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Check answer'
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {current.tags && current.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {current.tags
                    .filter((t) => t !== 'output')
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTag(t)}
                        className="px-3 py-1 rounded-full text-xs bg-secondary border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-5">
                <p className="text-xs text-muted-foreground">
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    1–4
                  </kbd>{' '}
                  to pick ·{' '}
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    Enter
                  </kbd>{' '}
                  to check ·{' '}
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    N
                  </kbd>{' '}
                  for next
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setReportOpen(true)}
                >
                  <Flag className="h-3.5 w-3.5 mr-1.5" />
                  Report
                </Button>
              </div>

              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Report this question</DialogTitle>
                    <DialogDescription>
                      Wrong answer key, broken explanation, or a typo? Tell us so it gets fixed.
                    </DialogDescription>
                  </DialogHeader>

                  <RadioGroup
                    value={reportReason}
                    onValueChange={setReportReason}
                    className="gap-2"
                  >
                    {REPORT_REASONS.map((r) => (
                      <label
                        key={r.value}
                        htmlFor={`report-${r.value}`}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          reportReason === r.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-secondary/40 hover:border-primary/40'
                        }`}
                      >
                        <RadioGroupItem value={r.value} id={`report-${r.value}`} />
                        <span className="text-sm">{r.label}</span>
                      </label>
                    ))}
                  </RadioGroup>

                  <div>
                    <Label htmlFor="report-detail" className="text-xs text-muted-foreground">
                      Anything else? (optional)
                    </Label>
                    <Textarea
                      id="report-detail"
                      value={reportDetail}
                      onChange={(e) => setReportDetail(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="What did you spot?"
                      className="mt-1.5"
                    />
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setReportOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={submitReport}
                      disabled={!reportReason || reportSubmitting}
                    >
                      {reportSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Send report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <p className="text-center text-xs text-muted-foreground mt-6">
                Practice does not affect your daily streak or the leaderboard.{' '}
                <Link to="/daily" className="text-primary hover:underline">
                  Play the Daily Challenge
                </Link>{' '}
                for that.
              </p>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}