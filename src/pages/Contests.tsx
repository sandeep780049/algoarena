import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Contest } from '@/lib/supabase';
import { CountdownTimer } from '@/components/contest/CountdownTimer';
import { 
  Trophy, 
  Clock, 
  Calendar, 
  Users,
  ChevronRight,
  Play,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { format, addMinutes } from 'date-fns';

function getContestStatus(contest: Contest): 'upcoming' | 'live' | 'ended' {
  const startTime = new Date(contest.start_time);
  const endTime = addMinutes(startTime, contest.duration_minutes);
  const now = new Date();

  if (now < startTime) return 'upcoming';
  if (now >= startTime && now < endTime) return 'live';
  return 'ended';
}

interface ContestWithMeta extends Contest {
  registrationCount?: number;
  isRegistered?: boolean;
  hasCompleted?: boolean;
}

function ContestCard({ contest, showRegistration = true }: { contest: ContestWithMeta; showRegistration?: boolean }) {
  const status = getContestStatus(contest);
  const startTime = new Date(contest.start_time);
  const endTime = addMinutes(startTime, contest.duration_minutes);

  const statusConfig = {
    upcoming: {
      badge: 'Upcoming',
      color: 'bg-glow-warning/20 text-glow-warning border-glow-warning/30',
      icon: Calendar,
    },
    live: {
      badge: 'Live Now',
      color: 'bg-glow-success/20 text-glow-success border-glow-success/30',
      icon: Play,
    },
    ended: {
      badge: 'Ended',
      color: 'bg-muted text-muted-foreground border-border',
      icon: CheckCircle,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const typeColors: Record<string, string> = {
    daily: 'bg-primary/20 text-primary',
    weekly: 'bg-accent/20 text-accent',
    special: 'bg-glow-warning/20 text-glow-warning',
  };

  return (
    <div className={`group relative p-6 rounded-xl bg-card border transition-all duration-300 ${
      status === 'live' ? 'border-glow-success/50 glow-success' : 'border-border hover:border-primary/50'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={typeColors[contest.contest_type]}>
              {contest.contest_type.charAt(0).toUpperCase() + contest.contest_type.slice(1)}
            </Badge>
            <Badge variant="outline" className={config.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.badge}
            </Badge>
            {contest.isRegistered && status !== 'ended' && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                Registered
              </Badge>
            )}
            {contest.hasCompleted && (
              <Badge variant="outline" className="bg-glow-success/10 text-glow-success border-glow-success/30">
                <Trophy className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
            {contest.name}
          </h3>
          {contest.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {contest.description}
            </p>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(startTime, 'PPP')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{format(startTime, 'p')} • {contest.duration_minutes} min</span>
          </div>
          {showRegistration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{contest.registrationCount || 0} registered</span>
            </div>
          )}
          {status === 'upcoming' && (
            <CountdownTimer targetDate={startTime} />
          )}
          {status === 'live' && (
            <div className="flex items-center gap-2 text-sm text-glow-success">
              <Play className="h-4 w-4 animate-pulse" />
              <span>Ends at {format(endTime, 'p')}</span>
            </div>
          )}
        </div>

        {/* Action */}
        <Link to={`/contest/${contest.id}`}>
          <Button 
            className="w-full" 
            variant={status === 'live' ? 'default' : 'outline'}
          >
            {status === 'live' ? 'Join Contest' : status === 'upcoming' ? 'View Details' : 'View Results'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function Contests() {
  const { user } = useAuth();
  const [contests, setContests] = useState<ContestWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    fetchContests();
  }, [user]);

  const fetchContests = async () => {
    try {
      const { data: contestsData, error } = await supabase
        .from('contests')
        .select('*')
        .eq('is_published', true)
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Fetch all registration counts and user statuses in parallel
      const contestsWithMeta: ContestWithMeta[] = await Promise.all(
        (contestsData || []).map(async (contest) => {
          // Use secure RPC function for registration count
          const { data: count } = await supabase.rpc('get_contest_registration_count', {
            p_contest_id: contest.id
          });

          let isRegistered = false;
          let hasCompleted = false;

          if (user) {
            // Use secure RPC function for user registration status
            const { data: isReg } = await supabase.rpc('is_user_registered', {
              p_contest_id: contest.id
            });
            isRegistered = isReg || false;

            // Check if user has completed
            const { data: resultData } = await supabase
              .from('contest_results')
              .select('id')
              .eq('contest_id', contest.id)
              .eq('user_id', user.id)
              .not('completed_at', 'is', null)
              .maybeSingle();
            
            hasCompleted = !!resultData;
          }

          return {
            ...contest,
            registrationCount: count || 0,
            isRegistered,
            hasCompleted,
          } as ContestWithMeta;
        })
      );

      setContests(contestsWithMeta);
    } catch (error) {
      console.error('Error fetching contests:', error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingContests = contests.filter(c => getContestStatus(c) === 'upcoming');
  const liveContests = contests.filter(c => getContestStatus(c) === 'live');
  const pastContests = contests.filter(c => getContestStatus(c) === 'ended');
  const myContests = contests.filter(c => c.isRegistered || c.hasCompleted);

  const renderContestGrid = (contestList: ContestWithMeta[], emptyMessage: string) => {
    if (loading) {
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      );
    }

    if (contestList.length === 0) {
      return (
        <div className="text-center py-20">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No contests found</h3>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contestList.map((contest) => (
          <ContestCard key={contest.id} contest={contest} />
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <SEO 
        title="Contests"
        description="Join live coding contests, daily challenges, and weekly competitions on JC AlgoArena. Compete against coders worldwide and climb the leaderboard."
        path="/contests"
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <Trophy className="inline-block h-8 w-8 text-primary mr-3" />
            Contests
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Join live competitions, test your coding knowledge, and climb the leaderboard.
          </p>
        </div>

        {/* Live Contests Banner */}
        {liveContests.length > 0 && (
          <div className="mb-8 p-6 rounded-xl bg-glow-success/10 border border-glow-success/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-glow-success animate-pulse" />
                <h2 className="text-lg font-semibold text-glow-success">
                  {liveContests.length} Contest{liveContests.length > 1 ? 's' : ''} Live Now!
                </h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveContests.map(contest => (
                <Link 
                  key={contest.id} 
                  to={`/contest/${contest.id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
                >
                  <div>
                    <p className="font-semibold">{contest.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {contest.registrationCount} participants
                    </p>
                  </div>
                  <Button size="sm">Join Now</Button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Stats - Clickable to switch tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('live')}
            className={`p-4 rounded-xl bg-glow-success/10 border transition-all text-left ${
              activeTab === 'live' ? 'border-glow-success ring-2 ring-glow-success/30' : 'border-glow-success/30 hover:border-glow-success/60'
            }`}
          >
            <div className="flex items-center gap-2 text-glow-success mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm font-medium">Live Now</span>
            </div>
            <p className="text-2xl font-bold">{liveContests.length}</p>
          </button>
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`p-4 rounded-xl bg-glow-warning/10 border transition-all text-left ${
              activeTab === 'upcoming' ? 'border-glow-warning ring-2 ring-glow-warning/30' : 'border-glow-warning/30 hover:border-glow-warning/60'
            }`}
          >
            <div className="flex items-center gap-2 text-glow-warning mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Upcoming</span>
            </div>
            <p className="text-2xl font-bold">{upcomingContests.length}</p>
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`p-4 rounded-xl bg-muted border transition-all text-left ${
              activeTab === 'past' ? 'border-muted-foreground ring-2 ring-muted-foreground/30' : 'border-border hover:border-muted-foreground/60'
            }`}
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Past</span>
            </div>
            <p className="text-2xl font-bold">{pastContests.length}</p>
          </button>
          <button 
            onClick={() => setActiveTab('my')}
            className={`p-4 rounded-xl bg-primary/10 border transition-all text-left ${
              activeTab === 'my' ? 'border-primary ring-2 ring-primary/30' : 'border-primary/30 hover:border-primary/60'
            }`}
          >
            <div className="flex items-center gap-2 text-primary mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-sm font-medium">My Contests</span>
            </div>
            <p className="text-2xl font-bold">{myContests.length}</p>
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Upcoming</span>
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
              {liveContests.length > 0 && (
                <Badge className="ml-1 bg-glow-success text-glow-success-foreground">
                  {liveContests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Past</span>
            </TabsTrigger>
            <TabsTrigger value="my" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">My Contests</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {renderContestGrid(upcomingContests, 'No upcoming contests. Check back soon!')}
          </TabsContent>

          <TabsContent value="live">
            {renderContestGrid(liveContests, 'No live contests right now.')}
          </TabsContent>

          <TabsContent value="past">
            {renderContestGrid(pastContests, 'No past contests yet.')}
          </TabsContent>

          <TabsContent value="my">
            {user ? (
              renderContestGrid(myContests, "You haven't participated in any contests yet.")
            ) : (
              <div className="text-center py-20">
                <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Sign in to see your contests</h3>
                <p className="text-muted-foreground mb-4">
                  Track your progress and see your contest history.
                </p>
                <Link to="/auth">
                  <Button>Sign In</Button>
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
