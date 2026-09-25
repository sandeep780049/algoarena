import { Flame, CheckCircle2, Circle } from 'lucide-react';

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
  completedToday: boolean;
  isActive?: boolean;
}

export function StreakCard({
  currentStreak,
  longestStreak,
  totalCompleted,
  completedToday,
  isActive = true,
}: StreakCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            currentStreak > 0 ? 'bg-glow-warning/20 glow-warning' : 'bg-secondary'
          }`}
        >
          <Flame className={`h-7 w-7 ${currentStreak > 0 ? 'text-glow-warning' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {isActive ? 'Current Streak' : 'Start your streak'}
          </p>
          <p className="text-3xl font-bold">
            {currentStreak}
            <span className="text-base font-medium text-muted-foreground ml-2">
              {currentStreak === 1 ? 'day' : 'days'}
            </span>
          </p>
        </div>
        {isActive && (
          <div className="ml-auto">
            {completedToday ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glow-success/20 text-glow-success text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Done today
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glow-warning/20 text-glow-warning text-sm font-medium">
                <Circle className="h-4 w-4" />
                Pending
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-glow-warning">{longestStreak}</p>
          <p className="text-xs text-muted-foreground">Longest Streak</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-primary">{totalCompleted}</p>
          <p className="text-xs text-muted-foreground">Days Completed</p>
        </div>
      </div>
    </div>
  );
}
