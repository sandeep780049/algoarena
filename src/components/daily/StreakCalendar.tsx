import { useMemo } from 'react';
import { addDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DailyChallengeEntry } from '@/lib/supabase';

const utc = { in: (date: Date) => new Date(date.getTime() + date.getTimezoneOffset() * 60000) } as const;

/** Formats a date in UTC so keys match the yyyy-MM-dd dates stored in Postgres. */
const formatUTC = (date: Date, pattern: string) =>
  format(date, pattern, { in: utc } as Parameters<typeof format>[2]);

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

    // The challenge is keyed on UTC dates, so "today" must be the UTC date too.
    // Falling back to the browser's local date shifts every cell by a day for
    // users who are not on UTC.
    const currentKey = todayKey ?? formatUTC(new Date(), 'yyyy-MM-dd');
    const today = parseISO(`${currentKey}T00:00:00Z`);
    // Anchor on the Sunday that begins the *current* week and walk backwards,
    // so the final column is this week and nothing is projected into the
    // future. subWeeks(today, weeks - 1) counted backwards from mid-week and
    // pushed the whole grid past today.
    const start = subWeeks(startOfWeek(today, { weekStartsOn: 0 }), weeks - 1);

    const nextColumns: { key: string; state: CellState; date: Date; played: boolean }[][] = [];
    const labels: (string | null)[] = [];

    for (let w = 0; w < weeks; w++) {
      const cells: { key: string; state: CellState; date: Date; played: boolean }[] = [];

      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        // Format in UTC so the cell key matches the yyyy-MM-dd keys that the
        // database stores for challenge_date.
        const key = formatUTC(date, 'yyyy-MM-dd');
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
      const month = formatUTC(cells[0].date, 'MMM');
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
            <span key={index} className="w-3 text-[10px] text-muted-foreground whitespace-nowrap">
              {label ?? ''}
            </span>
          ))}
        </div>

        <div className="flex gap-1">
          <div className="flex flex-col gap-1 pr-1">
            {WEEKDAY_INITIALS.map((day, index) => (
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
                        {formatUTC(cell.date, 'MMM d, yyyy')}
                        {cell.state === 'future'
                          ? ' â€” upcoming'
                          : cell.played
                          ? cell.state === 'correct'
                            ? ' â€” solved'
                            : ' â€” attempted'
                          : ' â€” missed'}
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
