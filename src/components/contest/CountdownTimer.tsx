import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
  onComplete?: () => void;
}

export function CountdownTimer({ targetDate, className = '', onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference <= 0) {
        setIsComplete(true);
        onComplete?.();
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (isComplete) {
    return (
      <span className={`text-glow-success font-semibold ${className}`}>
        Starting now!
      </span>
    );
  }

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Timer className="h-4 w-4 text-primary" />
      <div className="flex items-center gap-1 font-mono text-sm">
        {days > 0 && (
          <>
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
              {days}d
            </span>
          </>
        )}
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
          {String(hours).padStart(2, '0')}h
        </span>
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
          {String(minutes).padStart(2, '0')}m
        </span>
        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
          {String(seconds).padStart(2, '0')}s
        </span>
      </div>
    </div>
  );
}
