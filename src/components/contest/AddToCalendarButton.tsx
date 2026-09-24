import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';

interface AddToCalendarButtonProps {
  contestName: string;
  startTime: Date;
  durationMinutes: number;
}

function formatGCalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * "Add to Google Calendar" link for an upcoming contest. Opens Google
 * Calendar's event-creation page pre-filled with the contest details.
 */
export function AddToCalendarButton({ contestName, startTime, durationMinutes }: AddToCalendarButtonProps) {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${contestName} — JC AlgoArena`,
    dates: `${formatGCalDate(startTime)}/${formatGCalDate(endTime)}`,
    details: `Compete in ${contestName} on JC AlgoArena. Register and join the quiz at https://jc-algoarena.vercel.app/contests`,
  });

  const calendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

  return (
    <Button variant="outline" className="w-full" asChild>
      <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
        <CalendarPlus className="h-4 w-4 mr-2" />
        Add to Google Calendar
      </a>
    </Button>
  );
}
