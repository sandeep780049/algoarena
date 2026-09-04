import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { RankBadge, getRankBadgeInfo } from '@/components/leaderboard/RankBadge';
import { supabase } from '@/lib/supabase';
import type { ContestResult, Contest, Profile as ProfileType } from '@/lib/supabase';
import { 
  User, 
  Trophy, 
  Calendar, 
  Clock,
  ChevronRight,
  Star,
  Target,
  Award,
  TrendingUp,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface UserStats {
  totalContests: number;
  totalScore: number;
  avgScore: number;
  bestRank: number | null;
  accuracy: number;
  totalQuestions: number;
  correctAnswers: number;
  topFinishes: number; // Number of top 10 finishes
  winnerFinishes: number; // Number of top 3 finishes
}

interface ContestRank {
  contestId: string;
  rank: number;
}

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const { user, profile: currentUserProfile, loading: authLoading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [viewingProfile, setViewingProfile] = useState<ProfileType | null>(null);
  const [results, setResults] = useState<(ContestResult & { contest?: Contest; rank?: number })[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalContests: 0,
    totalScore: 0,
    avgScore: 0,
    bestRank: null,
    accuracy: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    topFinishes: 0,
    winnerFinishes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [contestRanks, setContestRanks] = useState<Record<string, number>>({});

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!authLoading && !user && !userId) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate, userId]);

  useEffect(() => {
    if (targetUserId) {
      fetchUserData();
    }
  }, [targetUserId]);

  const fetchUserData = async () => {
    if (!targetUserId) return;

    try {
      // Fetch profile if viewing another user
      if (!isOwnProfile) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .maybeSingle();
        
        if (!profileData) {
          navigate('/');
          return;
        }
        setViewingProfile(profileData);
        setAvatarUrl(profileData.avatar_url);
      } else {
        setAvatarUrl(currentUserProfile?.avatar_url || null);
      }

      // Fetch results
      const { data: resultsData } = await supabase
        .from('contest_results')
        .select('*')
        .eq('user_id', targetUserId)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false });

      if (resultsData && resultsData.length > 0) {
        // Fetch contest details
        const contestIds = resultsData.map(r => r.contest_id);
        const { data: contestsData } = await supabase
          .from('contests')
          .select('*')
          .in('id', contestIds);

        const resultsWithContests = resultsData.map(r => ({
          ...r,
          contest: contestsData?.find(c => c.id === r.contest_id) as Contest,
        }));

        setResults(resultsWithContests);

        // Calculate stats
        const totalScore = resultsData.reduce((sum, r) => sum + (r.score || 0), 0);
        const totalQuestions = resultsData.reduce((sum, r) => sum + (r.total_questions || 0), 0);
        const avgScore = totalScore / resultsData.length;
        const accuracy = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

        // Calculate best rank and top finishes
        let bestRank: number | null = null;
        let topFinishes = 0;
        let winnerFinishes = 0;
        const ranksMap: Record<string, number> = {};
        
        for (const result of resultsData) {
          const { data: rankData } = await supabase
            .from('contest_results')
            .select('user_id, score, time_taken_seconds')
            .eq('contest_id', result.contest_id)
            .not('completed_at', 'is', null)
            .order('score', { ascending: false })
            .order('time_taken_seconds', { ascending: true });

          if (rankData) {
            const userRank = rankData.findIndex(r => r.user_id === targetUserId) + 1;
            if (userRank > 0) {
              ranksMap[result.contest_id] = userRank;
              if (bestRank === null || userRank < bestRank) {
                bestRank = userRank;
              }
              if (userRank <= 10) {
                topFinishes++;
                if (userRank <= 3) {
                  winnerFinishes++;
                }
              }
            }
          }
        }

        setContestRanks(ranksMap);

        // Update results with ranks
        const resultsWithRanks = resultsWithContests.map(r => ({
          ...r,
          rank: ranksMap[r.contest_id],
        }));
        setResults(resultsWithRanks);

        setStats({
          totalContests: resultsData.length,
          totalScore,
          avgScore: Math.round(avgScore * 10) / 10,
          bestRank,
          accuracy: Math.round(accuracy),
          totalQuestions,
          correctAnswers: totalScore,
          topFinishes,
          winnerFinishes,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = (url: string) => {
    setAvatarUrl(url);
    refreshProfile();
  };

  const getRankBadge = (rank: number | null) => {
    if (!rank) return null;
    if (rank === 1) return { label: '🥇 Champion', color: 'bg-amber-500/20 text-amber-500' };
    if (rank <= 3) return { label: '🏆 Top 3', color: 'bg-primary/20 text-primary' };
    if (rank <= 10) return { label: '⭐ Top 10', color: 'bg-accent/20 text-accent-foreground' };
    return null;
  };

  const getAchievementBadges = () => {
    const badges = [];
    if (stats.winnerFinishes > 0) {
      badges.push({ label: `🏆 ${stats.winnerFinishes}x Winner`, color: 'bg-amber-500/20 text-amber-500 border-amber-500/30' });
    }
    if (stats.topFinishes > stats.winnerFinishes) {
      badges.push({ label: `⭐ ${stats.topFinishes}x Top 10`, color: 'bg-primary/20 text-primary border-primary/30' });
    }
    return badges;
  };

  const rankBadge = getRankBadge(stats.bestRank);
  const achievementBadges = getAchievementBadges();
  const displayProfile = isOwnProfile ? currentUserProfile : viewingProfile;

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-secondary rounded-xl" />
            <div className="h-64 bg-secondary rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!displayProfile) {
    return null;
  }

  return (
    <Layout>
      <SEO 
        title={isOwnProfile ? "My Profile" : `${displayProfile.username}'s Profile`}
        description={`View ${isOwnProfile ? 'your' : displayProfile.username + "'s"} contest history, stats, and rankings on JC AlgoArena.`}
        path={isOwnProfile ? "/profile" : `/profile/${targetUserId}`}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {isOwnProfile ? (
              <AvatarUpload
                userId={user!.id}
                currentAvatarUrl={avatarUrl}
                username={displayProfile.username}
                onUploadComplete={handleAvatarUpload}
                size="lg"
              />
            ) : (
              <Avatar className="w-32 h-32 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-4xl font-bold">
                  {displayProfile.username?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{displayProfile.username}</h1>
                {rankBadge && (
                  <Badge className={rankBadge.color}>{rankBadge.label}</Badge>
                )}
              </div>
              {achievementBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {achievementBadges.map((badge, idx) => (
                    <Badge key={idx} variant="outline" className={badge.color}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              )}
              {isOwnProfile && user?.email && (
                <p className="text-muted-foreground">{user.email}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Member since {format(new Date(displayProfile.created_at), 'MMMM yyyy')}
              </p>
            </div>
            {isOwnProfile && (
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Trophy className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.totalContests}</p>
            <p className="text-xs text-muted-foreground">Contests</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Star className="h-6 w-6 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.totalScore}</p>
            <p className="text-xs text-muted-foreground">Total Score</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <TrendingUp className="h-6 w-6 text-glow-success mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.avgScore}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Target className="h-6 w-6 text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Award className="h-6 w-6 text-glow-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.bestRank || '-'}</p>
            <p className="text-xs text-muted-foreground">Best Rank</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
        </div>

        {/* Recent Results */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-6">Contest History</h2>
          
          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((result) => {
                const accuracy = result.total_questions 
                  ? Math.round((result.score || 0) / result.total_questions * 100) 
                  : 0;
                const rank = result.rank;
                
                return (
                  <Link
                    key={result.id}
                    to={`/contest/${result.contest_id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{result.contest?.name || 'Contest'}</p>
                          {rank && rank <= 10 && <RankBadge rank={rank} size="sm" />}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{result.completed_at && format(new Date(result.completed_at), 'PPP')}</span>
                          {result.contest?.contest_type && (
                            <Badge variant="outline" className="text-xs">
                              {result.contest.contest_type}
                            </Badge>
                          )}
                          {rank && (
                            <span className="text-primary font-medium">Rank #{rank}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                      <div>
                        <p className="text-xl font-bold text-primary">
                          {result.score}/{result.total_questions}
                        </p>
                        <p className="text-sm text-muted-foreground">{accuracy}% accuracy</p>
                      </div>
                      <div className="text-muted-foreground">
                        <p className="text-sm">
                          {result.time_taken_seconds 
                            ? `${Math.floor(result.time_taken_seconds / 60)}m ${result.time_taken_seconds % 60}s`
                            : '-'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contests completed yet</h3>
              <p className="text-muted-foreground mb-4">
                {isOwnProfile ? 'Join a contest to see your results here!' : 'This user hasn\'t participated in any contests yet.'}
              </p>
              {isOwnProfile && (
                <Link to="/contests">
                  <Button>
                    Browse Contests
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
