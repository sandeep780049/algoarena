import { Badge } from '@/components/ui/badge';
import { Crown, Medal, Star } from 'lucide-react';

interface RankBadgeProps {
  rank: number;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function getRankBadgeInfo(rank: number) {
  if (rank === 1) return { 
    label: 'Champion', 
    emoji: '🥇', 
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: Crown,
  };
  if (rank === 2) return { 
    label: 'Runner-up', 
    emoji: '🥈', 
    color: 'bg-slate-400/20 text-slate-400 border-slate-400/30',
    icon: Medal,
  };
  if (rank === 3) return { 
    label: 'Third Place', 
    emoji: '🥉', 
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    icon: Medal,
  };
  if (rank <= 10) return { 
    label: 'Top 10', 
    emoji: '⭐', 
    color: 'bg-primary/20 text-primary border-primary/30',
    icon: Star,
  };
  return null;
}

export function RankBadge({ rank, showIcon = true, size = 'sm' }: RankBadgeProps) {
  const info = getRankBadgeInfo(rank);
  
  if (!info) return null;

  const Icon = info.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Badge 
      variant="outline" 
      className={`${info.color} ${size === 'md' ? 'text-sm py-1' : ''}`}
    >
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {info.label}
    </Badge>
  );
}
