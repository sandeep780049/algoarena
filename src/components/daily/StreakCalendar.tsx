import { useMemo } from 'react';
import { addDays, format, startOfWeek, subWeeks } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DailyChallengeEntry } from '@/lib/supabase';

interface StreakCalendarProps {
  history: DailyChallengeEntry[];
  weeks?: number;
  todayKey?: string;
}

type CellState = 'correct' | 'incorrect' | 'empty' | 'future';

const CELL_CLASS: Record<CellState, string> = {
  correct: 'bg-glow-success',
  incorrect: 'bg-destructive',
  empty: 'bg-secondary',
  future: 'bg-secondary/30',
};

const LEGEND: { state: CellState; label: string }[] = [
  { state: 'correct', label: 'Solved' },
  { state: 'incorrect', label: 'Attempted' },
  { state: 'empty', label: 'Missed' },
];

export function StreakCalendar({ history, weeks = 18, todayKey }: StreakCalendarProps) {
  const { columns, monthLabels } = useMemo(() => {
    const byDate = new Map<string, boolean>();
    history.forEach((entry) => byDate.set(entry.date, entry.is_correct));

    const today = new Date();
    const currentKey = todayKey ?? format(today, 'yyyy-MM-dd');
    const start = startOfWeek(subWeeks(today, weeks - 1));

    const nextColumns: { key: string; state: CellState; date: Date; played: boolean }[][] = [];
    const labels: (string | null)[] = [];

    for (let w = 0; w < weeks; w++) {
      const cells: { key: string; state: CellState; date: Date; played: boolean }[] = [];

      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        const key = format(date, 'yyyy-MM-dd');
        const played = byDate.has(key);

        let state: CellState = 'empty';
        if (key > currentKey) {
          state = 'future';
        } else if (played) {
          state = byDate.get(key) ? 'correct' : 'incorrect';
        }

        cells.push({ key, state, date, played });
      }

      nextColumns.push(cells);

      const previous = labels[labels.length - 1];
      const month = format(cells[0].date, 'MMM');
      labels.push(previous === month ? null : month);
    }

    return { columns: nextColumns, monthLabels: labels };
  }, [history, weeks, todayKey]);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Activity</h2>
        <p className="text-sm text-muted-foreground">Last {weeks} weeks</p>
      </div>

      <div className="overflow-x-auto no-scrollbar">
        <div className="inline-flex gap-1 mb-1 pl-7">
          {monthLabels.map((label, index) => (
            <span key={index} className="w-3 text-[10px] text-muted-foreground">
              {label ? label.charAt(0) : ''}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          <div className="flex flex-col gap-1 pr-1">
            {['S', '', 'M', '', 'W', '', 'F'].map((day, index) => (
              <span key={index} className="h-3 w-5 text-[10px] leading-3 text-muted-foreground">
                {day}
              </span>
            ))}
          </div>

          <TooltipProvider delayDuration={0}>
            <div className="flex gap-1">
              {columns.map((cells, columnIndex) => (
                <div key={columnIndex} className="flex flex-col gap-1">
                  {cells.map((cell) => (
                    <Tooltip key={cell.key}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-3 h-3 rounded-sm ${CELL_CLASS[cell.state]} ${
                            cell.state === 'future' ? 'opacity-40' : ''
                          }`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {format(cell.date, 'MMM d, yyyy')}
                        {cell.state === 'future'
                          ? ' — upcoming'
                          : cell.played
                          ? cell.state === 'correct'
                            ? ' — solved'
                            : ' — attempted'
                          : ' — missed'}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        {LEGEND.map((item) => (
          <span key={item.state} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${CELL_CLASS[item.state]}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
