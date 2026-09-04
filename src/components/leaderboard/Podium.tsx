import { Trophy, Medal, Clock, Crown, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface PodiumEntry {
  user_id: string;
  rank: number;
  score: number;
  time_taken_seconds?: number | null;
  profile?: {
    id: string;
    username: string;
    avatar_url?: string | null;
  } | null;
}

interface PodiumProps {
  entries: PodiumEntry[];
  currentUserId?: string;
}

const formatTime = (seconds: number | null | undefined) => {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

function PodiumCard({ entry, position, currentUserId }: { 
  entry: PodiumEntry; 
  position: 1 | 2 | 3;
  currentUserId?: string;
}) {
  const isCurrentUser = entry.user_id === currentUserId;
  
  const config = {
    1: {
      size: 'h-40',
      avatarSize: 'w-20 h-20',
      icon: Crown,
      iconColor: 'text-amber-400',
      bgColor: 'bg-gradient-to-b from-amber-500/20 to-amber-600/5',
      borderColor: 'border-amber-500/50',
      glowClass: 'shadow-lg shadow-amber-500/20',
      order: 'order-2',
      label: '1st',
      badgeLabel: 'Champion',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    2: {
      size: 'h-32',
      avatarSize: 'w-16 h-16',
      icon: Medal,
      iconColor: 'text-slate-400',
      bgColor: 'bg-gradient-to-b from-slate-400/20 to-slate-500/5',
      borderColor: 'border-slate-400/50',
      glowClass: 'shadow-lg shadow-slate-400/20',
      order: 'order-1',
      label: '2nd',
      badgeLabel: 'Runner-up',
      badgeColor: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
    },
    3: {
      size: 'h-28',
      avatarSize: 'w-14 h-14',
      icon: Medal,
      iconColor: 'text-orange-500',
      bgColor: 'bg-gradient-to-b from-orange-500/20 to-orange-600/5',
      borderColor: 'border-orange-500/50',
      glowClass: 'shadow-lg shadow-orange-500/20',
      order: 'order-3',
      label: '3rd',
      badgeLabel: 'Third Place',
      badgeColor: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    },
  };

  const c = config[position];
  const Icon = c.icon;

  return (
    <div className={`flex flex-col items-center ${c.order}`}>
      {/* Rank Icon */}
      <div className="relative mb-3">
        <Icon className={`h-8 w-8 ${c.iconColor} ${position === 1 ? 'animate-pulse' : ''}`} />
        {position === 1 && (
          <div className="absolute inset-0 blur-lg opacity-50">
            <Icon className={`h-8 w-8 ${c.iconColor}`} />
          </div>
        )}
      </div>

      {/* Avatar */}
      <Link to={`/profile/${entry.user_id}`} className="group">
        <Avatar className={`${c.avatarSize} border-2 ${c.borderColor} ${c.glowClass} transition-transform group-hover:scale-110`}>
          <AvatarImage src={entry.profile?.avatar_url || undefined} />
          <AvatarFallback className={`${c.bgColor} text-lg font-bold`}>
            {entry.profile?.username?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* Username */}
      <Link 
        to={`/profile/${entry.user_id}`}
        className={`mt-3 font-semibold text-sm hover:text-primary transition-colors ${
          isCurrentUser ? 'text-primary' : 'text-foreground'
        }`}
      >
        {entry.profile?.username || 'Anonymous'}
        {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
      </Link>

      {/* Badge */}
      <Badge variant="outline" className={`mt-1 text-xs ${c.badgeColor}`}>
        {c.badgeLabel}
      </Badge>

      {/* Score */}
      <p className={`text-2xl font-bold ${position === 1 ? 'text-amber-400' : 'text-primary'}`}>
        {entry.score}
      </p>
      <p className="text-xs text-muted-foreground">points</p>

      {/* Time */}
      {entry.time_taken_seconds && (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(entry.time_taken_seconds)}
        </div>
      )}

      {/* Podium Base */}
      <div className={`w-full max-w-[120px] ${c.size} ${c.bgColor} rounded-t-lg border-t border-x ${c.borderColor} mt-4 flex items-start justify-center pt-4`}>
        <span className={`text-3xl font-bold ${c.iconColor}`}>{c.label}</span>
      </div>
    </div>
  );
}

export function Podium({ entries, currentUserId }: PodiumProps) {
  const top3 = entries.slice(0, 3);

  if (top3.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          Top Performers
          <Trophy className="h-5 w-5 text-amber-400" />
        </h2>
        <p className="text-sm text-muted-foreground">Congratulations to our champions!</p>
      </div>

      <div className="flex items-end justify-center gap-4 md:gap-8">
        {top3[1] && <PodiumCard entry={top3[1]} position={2} currentUserId={currentUserId} />}
        {top3[0] && <PodiumCard entry={top3[0]} position={1} currentUserId={currentUserId} />}
        {top3[2] && <PodiumCard entry={top3[2]} position={3} currentUserId={currentUserId} />}
      </div>
    </div>
  );
}
