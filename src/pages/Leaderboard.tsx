import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Contest, Profile } from '@/lib/supabase';
import { Podium } from '@/components/leaderboard/Podium';
import { RankBadge } from '@/components/leaderboard/RankBadge';
import { ShareResultCard } from '@/components/share/ShareResultCard';
import { ShareTop3Card } from '@/components/share/ShareTop3Card';
import { CertificateCard } from '@/components/certificate/CertificateCard';
import { 
  Trophy, 
  Clock, 
  Lock,
  Share2,
  Award,
  FileText
} from 'lucide-react';
import { addMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LeaderboardEntry {
  user_id: string;
  rank: number;
  score: number | null;
  total_questions: number | null;
  time_taken_seconds: number | null;
  profile: Profile | null;
}

interface LeaderboardRpcEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
}

interface GlobalLeaderboardRpcEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_score: number;
  contest_count: number;
}

interface CertificateData {
  certificate_code: string;
  rank: number;
  username: string;
  contest_name: string;
  contest_date: string;
  issued_at: string;
}

function getContestStatus(contest: Contest): 'upcoming' | 'live' | 'ended' {
  const startTime = new Date(contest.start_time);
  const endTime = addMinutes(startTime, contest.duration_minutes);
  const now = new Date();

  if (now < startTime) return 'upcoming';
  if (now >= startTime && now < endTime) return 'live';
  return 'ended';
}

export default function Leaderboard() {
  const { user, profile: currentUserProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get('contest');
  
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContest, setSelectedContest] = useState<string | null>(contestId);
  const [selectedContestData, setSelectedContestData] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContestLocked, setIsContestLocked] = useState(false);
  const [certificates, setCertificates] = useState<Record<string, CertificateData>>({});
  const [userCompletedContests, setUserCompletedContests] = useState<number | null>(null);
  const isGlobalLeaderboardLocked = !selectedContest && userCompletedContests === 0 && !isAdmin;

  useEffect(() => {
    fetchContests();
    fetchUserCompletedContests();
  }, [user]);

  useEffect(() => {
    if (selectedContest) {
      const contest = contests.find(c => c.id === selectedContest);
      setSelectedContestData(contest || null);
      
      if (contest) {
        const status = getContestStatus(contest);
        setIsContestLocked(status === 'live' || status === 'upcoming');
      }
      
      fetchLeaderboard(selectedContest);
    } else {
      setSelectedContestData(null);
      setIsContestLocked(false);
      fetchGlobalLeaderboard();
    }
  }, [selectedContest, contests]);

  const fetchContests = async () => {
    const { data } = await supabase
      .from('contests')
      .select('*')
      .eq('is_published', true)
      .order('start_time', { ascending: false });
    
    setContests((data as Contest[]) || []);
  };

  const fetchUserCompletedContests = async () => {
    if (!user) {
      setUserCompletedContests(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('contest_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('completed_at', 'is', null);

      if (error) {
        console.error('Error fetching user completed contests:', error);
        setUserCompletedContests(0);
        return;
      }
      setUserCompletedContests(count ?? 0);
    } catch (error) {
      console.error('Error fetching user completed contests:', error);
      setUserCompletedContests(0);
    }
  };

  const fetchLeaderboard = async (contestId: string) => {
    setLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_leaderboard_entries', {
        p_contest_id: contestId
      });

      if (error) throw error;

      const resultsData = rpcData as unknown as LeaderboardRpcEntry[] | null;

      if (resultsData && resultsData.length > 0) {
        const entries: LeaderboardEntry[] = resultsData.map(entry => ({
          user_id: entry.user_id,
          rank: entry.rank,
          score: entry.score,
          total_questions: entry.total_questions,
          time_taken_seconds: entry.time_taken_seconds,
          profile: {
            id: entry.user_id,
            username: entry.username,
            avatar_url: entry.avatar_url,
            created_at: '',
            updated_at: '',
          } as Profile,
        }));
        setEntries(entries);

        // Fetch certificates for top 10
        const { data: certsData } = await supabase
          .from('certificates')
          .select('*')
          .eq('contest_id', contestId);
        
        if (certsData) {
          const certsMap: Record<string, CertificateData> = {};
          certsData.forEach((cert: any) => {
            certsMap[cert.user_id] = {
              certificate_code: cert.certificate_code,
              rank: cert.rank,
              username: cert.username,
              contest_name: cert.contest_name,
              contest_date: cert.contest_date,
              issued_at: cert.issued_at,
            };
          });
          setCertificates(certsMap);
        }
      } else {
        setEntries([]);
        setCertificates({});
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: rpcData, error } = await supabase.rpc('get_global_leaderboard');

      if (error) throw error;

      const resultsData = rpcData as unknown as GlobalLeaderboardRpcEntry[] | null;

      if (resultsData && resultsData.length > 0) {
        const entries: LeaderboardEntry[] = resultsData.map(entry => ({
          user_id: entry.user_id,
          rank: entry.rank,
          score: entry.total_score,
          total_questions: entry.contest_count,
          time_taken_seconds: null,
          profile: {
            id: entry.user_id,
            username: entry.username,
            avatar_url: entry.avatar_url,
            created_at: '',
            updated_at: '',
          } as Profile,
        }));
        setEntries(entries);
      } else {
        setEntries([]);
      }
      setCertificates({});
    } catch (error) {
      console.error('Error fetching global leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCertificate = async (userId: string) => {
    if (!selectedContest) return;

    try {
      const { data, error } = await supabase.rpc('generate_certificate', {
        p_contest_id: selectedContest,
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; certificate_code?: string };
      
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Certificate Generated!',
        description: `Certificate code: ${result.certificate_code}`,
      });

      // Refresh leaderboard to get certificate data
      fetchLeaderboard(selectedContest);
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate certificate',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
    if (rank === 2) return 'bg-slate-400/20 text-slate-400 border-slate-400/30';
    if (rank === 3) return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    if (rank <= 10) return 'bg-primary/20 text-primary border-primary/30';
    return 'bg-secondary text-secondary-foreground border-border';
  };

  const currentUserEntry = user ? entries.find(e => e.user_id === user.id) : null;
  const top3Entries = entries.slice(0, 3);
  const restEntries = entries.filter(e => e.rank > 3);

  const renderShareButton = (entry: LeaderboardEntry, entryProfile: Profile | null) => {
    if (!selectedContestData) return null;
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Result</DialogTitle>
          </DialogHeader>
          <ShareResultCard
            contestName={selectedContestData.name}
            rank={entry.rank}
            score={entry.score || 0}
            totalQuestions={entry.total_questions || 0}
            username={entryProfile?.username || 'Anonymous'}
            avatarUrl={entryProfile?.avatar_url}
            timeTaken={formatTime(entry.time_taken_seconds as number)}
          />
        </DialogContent>
      </Dialog>
    );
  };

  const renderCertificateButton = (entry: LeaderboardEntry) => {
    if (!selectedContestData || entry.rank > 10) return null;
    
    const isCurrentUser = entry.user_id === user?.id;
    const canView = isCurrentUser || isAdmin;
    
    if (!canView) return null;

    const cert = certificates[entry.user_id];
    
    if (cert) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <FileText className="h-4 w-4" />
              Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Certificate of Achievement</DialogTitle>
            </DialogHeader>
            <CertificateCard
              username={cert.username}
              contestName={cert.contest_name}
              contestDate={cert.contest_date}
              rank={cert.rank}
              certificateCode={cert.certificate_code}
              issuedAt={cert.issued_at}
            />
          </DialogContent>
        </Dialog>
      );
    }

    // Show generate button for admin or the user themselves
    const contest = selectedContestData;
    const status = getContestStatus(contest);
    
    if (status !== 'ended') return null;

    return (
      <Button 
        size="sm" 
        variant="outline" 
        className="gap-1"
        onClick={() => handleGenerateCertificate(entry.user_id)}
      >
        <FileText className="h-4 w-4" />
        Get Certificate
      </Button>
    );
  };

  return (
    <Layout>
      <SEO 
        title="Leaderboard"
        description="View global and contest-specific rankings on JC AlgoArena. See top performers, track your position, and compete for the top spot."
        path="/leaderboard"
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <Trophy className="inline-block h-8 w-8 text-primary mr-3" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            {selectedContest ? 'Contest rankings' : 'Global rankings across all contests'}
          </p>
        </div>

        {/* Contest Selector */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!selectedContest ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedContest(null)}
            >
              Global
            </Button>
            {contests.slice(0, 5).map((contest) => (
              <Button
                key={contest.id}
                variant={selectedContest === contest.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedContest(contest.id)}
              >
                {contest.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Contest Locked Notice */}
        {isContestLocked && selectedContestData && (
          <div className="mb-8 p-6 rounded-xl bg-glow-warning/10 border border-glow-warning/30">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-glow-warning" />
              <div>
                <h3 className="font-semibold text-glow-warning">Leaderboard Locked</h3>
                <p className="text-sm text-muted-foreground">
                  Results will be visible after the contest ends.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Global Leaderboard Locked Notice */}
        {isGlobalLeaderboardLocked && (
          <div className="mb-8 p-6 rounded-xl bg-glow-warning/10 border border-glow-warning/30">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-glow-warning" />
              <div>
                <h3 className="font-semibold text-glow-warning">Complete Your First Contest</h3>
                <p className="text-sm text-muted-foreground">
                  The global leaderboard will unlock after you complete your first contest.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : isContestLocked ? (
          <div className="text-center py-20">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Results Hidden</h3>
            <p className="text-muted-foreground">
              The leaderboard will be revealed after the contest ends.
            </p>
          </div>
        ) : isGlobalLeaderboardLocked ? (
          <div className="text-center py-20">
            <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Global Leaderboard Locked</h3>
            <p className="text-muted-foreground mb-4">
              Complete at least one contest to unlock the global leaderboard.
            </p>
            <Link to="/contests">
              <Button>
                <Trophy className="h-4 w-4 mr-2" />
                Browse Contests
              </Button>
            </Link>
          </div>
        ) : entries.length > 0 ? (
          <div className="space-y-8">
            {/* Podium for Top 3 */}
            <Podium entries={entries} currentUserId={user?.id} />

            {/* Share Top 3 Button */}
            {selectedContestData && top3Entries.length >= 3 && (
              <div className="flex justify-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Award className="h-4 w-4" />
                      Share Top 3
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Share Top 3 Winners</DialogTitle>
                    </DialogHeader>
                    <ShareTop3Card
                      contestName={selectedContestData.name}
                      entries={top3Entries.map(entry => ({
                        rank: entry.rank,
                        username: entry.profile?.username || 'Anonymous',
                        score: entry.score || 0,
                        timeTaken: formatTime(entry.time_taken_seconds as number),
                        avatarUrl: entry.profile?.avatar_url,
                      }))}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Top 3 Share/Certificate Buttons */}
            {selectedContestData && top3Entries.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mb-4">
                {top3Entries.map((entry) => {
                  const isCurrentUser = entry.user_id === user?.id;
                  const canShare = isCurrentUser || isAdmin;
                  
                  if (!canShare) return null;
                  
                  return (
                    <div key={entry.user_id} className="flex items-center gap-2">
                      <Badge className={getRankBadgeStyle(entry.rank)}>
                        #{entry.rank}
                      </Badge>
                      <span className="text-sm font-medium">
                        {entry.profile?.username || 'Anonymous'}
                        {isCurrentUser && ' (You)'}
                      </span>
                      <RankBadge rank={entry.rank} />
                      {renderShareButton(entry, entry.profile)}
                      {renderCertificateButton(entry)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* "— You —" Row */}
            {currentUserEntry && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="text-center text-sm text-muted-foreground mb-3">— You —</div>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <Badge className={getRankBadgeStyle(currentUserEntry.rank)}>
                      #{currentUserEntry.rank}
                    </Badge>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={currentUserEntry.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {currentUserEntry.profile?.username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{currentUserEntry.profile?.username} (You)</p>
                        <RankBadge rank={currentUserEntry.rank} />
                      </div>
                      <p className="text-sm text-muted-foreground">Your ranking</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{currentUserEntry.score}</p>
                      <p className="text-sm text-muted-foreground">points</p>
                    </div>
                    <div className="flex gap-2">
                      {renderShareButton(currentUserEntry, currentUserProfile)}
                      {renderCertificateButton(currentUserEntry)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Ranking List (from rank 4 onwards) */}
            {restEntries.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold mb-4">Full Rankings</h3>
                
                {/* Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm text-muted-foreground">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-4">User</div>
                  <div className="col-span-2 text-center">Score</div>
                  <div className="col-span-2 text-center">Questions</div>
                  <div className="col-span-1 text-center">Time</div>
                  <div className="col-span-2 text-center">Actions</div>
                </div>

                {restEntries.map((entry) => {
                  const isCurrentUser = entry.user_id === user?.id;
                  const canShare = isCurrentUser || isAdmin;
                  
                  return (
                    <div
                      key={entry.user_id}
                      className={`grid grid-cols-12 gap-4 items-center p-4 rounded-lg transition-colors ${
                        isCurrentUser 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'bg-card border border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="col-span-2 md:col-span-1">
                        <Badge variant="outline" className={getRankBadgeStyle(entry.rank)}>
                          #{entry.rank}
                        </Badge>
                      </div>
                      <div className="col-span-10 md:col-span-4">
                        <Link 
                          to={`/profile/${entry.user_id}`}
                          className="flex items-center gap-3 hover:text-primary transition-colors"
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/20">
                              {entry.profile?.username?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate flex items-center gap-2">
                            {entry.profile?.username || 'Anonymous'}
                            {isCurrentUser && <span className="text-primary">(You)</span>}
                            <RankBadge rank={entry.rank} size="sm" />
                          </span>
                        </Link>
                      </div>
                      <div className="col-span-4 md:col-span-2 text-center">
                        <span className="text-lg font-bold text-primary">{entry.score}</span>
                      </div>
                      <div className="col-span-4 md:col-span-2 text-center text-muted-foreground">
                        {entry.total_questions || '-'}
                      </div>
                      <div className="col-span-4 md:col-span-1 text-center text-muted-foreground">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {formatTime(entry.time_taken_seconds as number)}
                      </div>
                      <div className="col-span-12 md:col-span-2 flex justify-center gap-2">
                        {canShare && selectedContestData && renderShareButton(entry, entry.profile)}
                        {renderCertificateButton(entry)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No results yet</h3>
            <p className="text-muted-foreground">
              {selectedContest 
                ? 'No one has completed this contest yet.'
                : 'Be the first to compete and claim your spot!'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}