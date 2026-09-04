import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Question, Contest } from '@/lib/supabase';
import { Plus, Edit, Trash2, Save, X, Settings, Trophy, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';

// Validation schemas for admin forms
const questionSchema = z.object({
  questionText: z.string().trim().min(1, "Question text is required").max(1000, "Question text must be under 1000 characters"),
  codeBlock: z.string().max(5000, "Code block must be under 5000 characters").optional(),
  options: z.array(z.string().trim().min(1, "Option cannot be empty").max(500, "Option must be under 500 characters")).length(4, "Exactly 4 options required"),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string().max(2000, "Explanation must be under 2000 characters").optional(),
});

const contestSchema = z.object({
  contestName: z.string().trim().min(1, "Contest name is required").max(200, "Contest name must be under 200 characters"),
  contestDesc: z.string().max(1000, "Description must be under 1000 characters").optional(),
  contestCode: z.string().trim().min(1, "Contest code is required").max(50, "Contest code must be under 50 characters").regex(/^[A-Za-z0-9_-]+$/, "Contest code can only contain letters, numbers, hyphens, and underscores"),
  contestType: z.enum(['daily', 'weekly', 'special']),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute").max(480, "Duration cannot exceed 8 hours"),
  selectedQuestions: z.array(z.string().uuid()).optional(),
});

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'questions' | 'contests'>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showContestForm, setShowContestForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);

  // Question form state
  const [questionText, setQuestionText] = useState('');
  const [codeBlock, setCodeBlock] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [explanation, setExplanation] = useState('');

  // Contest form state
  const [contestName, setContestName] = useState('');
  const [contestDesc, setContestDesc] = useState('');
  const [contestType, setContestType] = useState<'daily' | 'weekly' | 'special'>('daily');
  const [contestCode, setContestCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast({ title: 'Access denied', description: 'Admin access required.', variant: 'destructive' });
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: q }, { data: c }] = await Promise.all([
      supabase.from('questions').select('*').order('created_at', { ascending: false }),
      supabase.from('contests').select('*').order('created_at', { ascending: false }),
    ]);
    setQuestions((q as Question[]) || []);
    setContests((c as Contest[]) || []);
    setLoading(false);
  };

  const resetQuestionForm = () => {
    setQuestionText(''); setCodeBlock(''); setOptions(['', '', '', '']);
    setCorrectAnswer(0); setExplanation(''); setEditingQuestion(null); setShowQuestionForm(false);
  };

  const resetContestForm = () => {
    setContestName(''); setContestDesc(''); setContestType('daily'); setContestCode('');
    setStartTime(''); setDuration(30); setSelectedQuestions([]); setEditingContest(null); setShowContestForm(false);
  };

  const saveQuestion = async () => {
    const validation = questionSchema.safeParse({
      questionText, codeBlock: codeBlock || undefined, options, correctAnswer, explanation: explanation || undefined,
    });
    if (!validation.success) {
      toast({ title: 'Validation Error', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    const data = { question_text: validation.data.questionText, code_block: validation.data.codeBlock || null, options: validation.data.options, correct_answer: validation.data.correctAnswer, explanation: validation.data.explanation || null, created_by: user?.id };
    if (editingQuestion) {
      await supabase.from('questions').update(data).eq('id', editingQuestion.id);
    } else {
      await supabase.from('questions').insert(data);
    }
    toast({ title: 'Success', description: 'Question saved.' });
    resetQuestionForm(); fetchData();
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', id);
    toast({ title: 'Deleted' }); fetchData();
  };

  const saveContest = async () => {
    const validation = contestSchema.safeParse({
      contestName, contestDesc: contestDesc || undefined, contestCode, contestType, startTime, duration,
      selectedQuestions: selectedQuestions.length > 0 ? selectedQuestions : undefined,
    });
    if (!validation.success) {
      toast({ title: 'Validation Error', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    const contestData = { name: validation.data.contestName, description: validation.data.contestDesc || null, contest_type: validation.data.contestType, contest_code: validation.data.contestCode, start_time: new Date(validation.data.startTime).toISOString(), duration_minutes: validation.data.duration, created_by: user?.id };
    let contestId = editingContest?.id;
    if (editingContest) {
      await supabase.from('contests').update(contestData).eq('id', editingContest.id);
    } else {
      const { data } = await supabase.from('contests').insert(contestData).select().single();
      contestId = data?.id;
    }
    if (contestId && selectedQuestions.length > 0) {
      await supabase.from('contest_questions').delete().eq('contest_id', contestId);
      const cqData = selectedQuestions.map((qId, idx) => ({ contest_id: contestId, question_id: qId, order_index: idx }));
      await supabase.from('contest_questions').insert(cqData);
    }
    toast({ title: 'Success', description: 'Contest saved.' });
    resetContestForm(); fetchData();
  };

  const publishContest = async (contest: Contest) => {
    const { data: cq } = await supabase.from('contest_questions').select('id').eq('contest_id', contest.id);
    if (!cq || cq.length === 0) {
      toast({ title: 'Error', description: 'Cannot publish contest without questions!', variant: 'destructive' }); return;
    }
    await supabase.from('contests').update({ is_published: true }).eq('id', contest.id);
    toast({ title: 'Published!' }); fetchData();
  };

  const editQuestion = (q: Question) => {
    setEditingQuestion(q); setQuestionText(q.question_text); setCodeBlock(q.code_block || '');
    setOptions(q.options as string[]); setCorrectAnswer(q.correct_answer); setExplanation(q.explanation || '');
    setShowQuestionForm(true);
  };

  const editContest = async (c: Contest) => {
    setEditingContest(c); setContestName(c.name); setContestDesc(c.description || '');
    setContestType(c.contest_type as 'daily' | 'weekly' | 'special'); setContestCode(c.contest_code);
    setStartTime(format(new Date(c.start_time), "yyyy-MM-dd'T'HH:mm")); setDuration(c.duration_minutes);
    const { data } = await supabase.from('contest_questions').select('question_id').eq('contest_id', c.id).order('order_index');
    setSelectedQuestions(data?.map(d => d.question_id) || []);
    setShowContestForm(true);
  };

  if (authLoading || loading) return <Layout><div className="container mx-auto px-4 py-12"><div className="animate-pulse h-64 bg-secondary rounded-xl" /></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8"><Settings className="inline h-8 w-8 mr-3 text-primary" />Admin Panel</h1>

        <div className="flex flex-wrap gap-2 mb-8">
          <Button variant={activeTab === 'questions' ? 'default' : 'outline'} onClick={() => setActiveTab('questions')}><FileText className="h-4 w-4 mr-2" />Questions ({questions.length})</Button>
          <Button variant={activeTab === 'contests' ? 'default' : 'outline'} onClick={() => setActiveTab('contests')}><Trophy className="h-4 w-4 mr-2" />Contests ({contests.length})</Button>
        </div>

        {activeTab === 'questions' && (
          <div>
            <Button onClick={() => setShowQuestionForm(true)} className="mb-6"><Plus className="h-4 w-4 mr-2" />Add Question</Button>
            {showQuestionForm && (
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <div className="flex justify-between mb-4"><h3 className="font-semibold">{editingQuestion ? 'Edit' : 'New'} Question</h3><Button variant="ghost" size="icon" onClick={resetQuestionForm}><X className="h-4 w-4" /></Button></div>
                <div className="space-y-4">
                  <div><Label>Question Text *</Label><Textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="What is the output?" /></div>
                  <div><Label>Code Block</Label><Textarea value={codeBlock} onChange={e => setCodeBlock(e.target.value)} className="font-mono" placeholder="console.log(1+1);" /></div>
                  <div><Label>Options *</Label>{options.map((o, i) => <div key={i} className="flex gap-2 mt-2"><input type="radio" checked={correctAnswer === i} onChange={() => setCorrectAnswer(i)} /><Input value={o} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Option ${i + 1}`} /></div>)}</div>
                  <div><Label>Explanation</Label><Textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explain the answer..." /></div>
                  <Button onClick={saveQuestion}><Save className="h-4 w-4 mr-2" />Save</Button>
                </div>
              </div>
            )}
            <div className="space-y-4">{questions.map(q => (
              <div key={q.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-start">
                <div className="flex-1"><p className="font-medium">{q.question_text}</p>{q.code_block && <pre className="text-sm text-muted-foreground mt-2 font-mono bg-secondary/50 p-2 rounded">{q.code_block.slice(0, 100)}...</pre>}</div>
                <div className="flex gap-2"><Button variant="ghost" size="icon" onClick={() => editQuestion(q)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}</div>
          </div>
        )}

        {activeTab === 'contests' && (
          <div>
            <Button onClick={() => setShowContestForm(true)} className="mb-6"><Plus className="h-4 w-4 mr-2" />Create Contest</Button>
            {showContestForm && (
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <div className="flex justify-between mb-4"><h3 className="font-semibold">{editingContest ? 'Edit' : 'New'} Contest</h3><Button variant="ghost" size="icon" onClick={resetContestForm}><X className="h-4 w-4" /></Button></div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><Label>Name *</Label><Input value={contestName} onChange={e => setContestName(e.target.value)} /></div>
                  <div><Label>Code *</Label><Input value={contestCode} onChange={e => setContestCode(e.target.value)} placeholder="DAILY001" /></div>
                  <div><Label>Type</Label><select value={contestType} onChange={e => setContestType(e.target.value as 'daily' | 'weekly' | 'special')} className="w-full h-10 rounded-lg border border-border bg-background px-3"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="special">Special</option></select></div>
                  <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
                  <div className="md:col-span-2"><Label>Start Time *</Label><Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Description</Label><Textarea value={contestDesc} onChange={e => setContestDesc(e.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Questions ({selectedQuestions.length} selected)</Label><div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-2">{questions.map(q => (<label key={q.id} className="flex items-center gap-2 p-2 rounded hover:bg-secondary cursor-pointer"><input type="checkbox" checked={selectedQuestions.includes(q.id)} onChange={e => setSelectedQuestions(e.target.checked ? [...selectedQuestions, q.id] : selectedQuestions.filter(id => id !== q.id))} /><span className="text-sm truncate">{q.question_text}</span></label>))}</div></div>
                </div>
                <Button onClick={saveContest} className="mt-4"><Save className="h-4 w-4 mr-2" />Save Contest</Button>
              </div>
            )}
            <div className="space-y-4">{contests.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div><div className="flex items-center gap-2 mb-2"><h3 className="font-semibold">{c.name}</h3><Badge>{c.contest_type}</Badge>{c.is_published ? <Badge className="bg-green-500/20 text-green-400">Published</Badge> : <Badge variant="outline">Draft</Badge>}</div><p className="text-sm text-muted-foreground">{format(new Date(c.start_time), 'PPP p')} • {c.duration_minutes}min • Code: {c.contest_code}</p></div>
                  <div className="flex gap-2">{!c.is_published && <Button size="sm" onClick={() => publishContest(c)}>Publish</Button>}<Button variant="ghost" size="icon" onClick={() => editContest(c)}><Edit className="h-4 w-4" /></Button></div>
                </div>
              </div>
            ))}</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
