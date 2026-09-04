import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Download, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Top3Entry {
  rank: number;
  username: string;
  score: number;
  timeTaken: string;
  avatarUrl?: string | null;
}

interface ShareTop3CardProps {
  contestName: string;
  entries: Top3Entry[];
}

export function ShareTop3Card({ contestName, entries }: ShareTop3CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#0a0a0f',
      scale: 2,
    });
    
    return canvas.toDataURL('image/png');
  };

  const handleDownload = async () => {
    const imageData = await generateImage();
    if (!imageData) return;

    const link = document.createElement('a');
    link.download = `${contestName.replace(/\s+/g, '-')}-top3.png`;
    link.href = imageData;
    link.click();
    toast.success('Top 3 image downloaded!');
  };

  const handleCopy = async () => {
    const imageData = await generateImage();
    if (!imageData) return;

    try {
      const blob = await fetch(imageData).then(r => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast.success('Image copied to clipboard!');
    } catch {
      toast.error('Failed to copy image');
    }
  };

  const handleShare = async () => {
    const imageData = await generateImage();
    if (!imageData) return;

    try {
      const blob = await fetch(imageData).then(r => r.blob());
      const file = new File([blob], 'top3.png', { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({
          title: `${contestName} - Top 3 Winners`,
          text: `Check out the top 3 winners of ${contestName}!`,
          files: [file],
        });
      } else {
        handleCopy();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        handleCopy();
      }
    }
  };

  const getBadgeInfo = (rank: number) => {
    switch (rank) {
      case 1:
        return { emoji: '🥇', title: 'Champion', color: 'from-amber-400 to-yellow-500', glow: 'shadow-amber-500/50' };
      case 2:
        return { emoji: '🥈', title: 'Runner-up', color: 'from-slate-300 to-slate-400', glow: 'shadow-slate-400/50' };
      case 3:
        return { emoji: '🥉', title: 'Third Place', color: 'from-orange-400 to-amber-600', glow: 'shadow-orange-500/50' };
      default:
        return { emoji: '', title: '', color: '', glow: '' };
    }
  };

  return (
    <div className="space-y-4">
      {/* The shareable card */}
      <div
        ref={cardRef}
        className="relative p-8 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        }}
      >
        {/* Confetti / Celebratory elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Sparkles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '4px',
                height: '4px',
                background: ['#FFD700', '#C0C0C0', '#CD7F32', '#FF6B6B', '#4ECDC4'][i % 5],
                borderRadius: '50%',
                boxShadow: `0 0 6px ${['#FFD700', '#C0C0C0', '#CD7F32', '#FF6B6B', '#4ECDC4'][i % 5]}`,
              }}
            />
          ))}
          
          {/* Confetti pieces */}
          {[...Array(15)].map((_, i) => (
            <div
              key={`confetti-${i}`}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${8 + Math.random() * 8}px`,
                height: `${4 + Math.random() * 4}px`,
                background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#3B82F6'][i % 5],
                transform: `rotate(${Math.random() * 360}deg)`,
                borderRadius: '2px',
              }}
            />
          ))}

          {/* Glowing circles */}
          <div 
            className="absolute -top-20 -left-20 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }}
          />
          <div 
            className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)' }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-3xl mb-2">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-1">{contestName}</h2>
            <p className="text-slate-400 text-sm">Top 3 Winners</p>
          </div>

          {/* Podium display */}
          <div className="flex justify-center items-end gap-4 mb-6">
            {/* 2nd Place */}
            {entries[1] && (
              <div className="flex flex-col items-center">
                <div className={`text-4xl mb-2`}>🥈</div>
                <div 
                  className="w-24 h-24 rounded-xl flex flex-col items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                    boxShadow: '0 0 20px rgba(100, 116, 139, 0.4)'
                  }}
                >
                  <span className="text-white font-bold text-sm truncate w-20 text-center">
                    {entries[1].username}
                  </span>
                  <span className="text-white/80 text-xs">{entries[1].score} pts</span>
                  <span className="text-white/60 text-xs">{entries[1].timeTaken}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">Runner-up</div>
              </div>
            )}

            {/* 1st Place */}
            {entries[0] && (
              <div className="flex flex-col items-center -mt-8">
                <div className={`text-5xl mb-2`}>🥇</div>
                <div 
                  className="w-28 h-28 rounded-xl flex flex-col items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    boxShadow: '0 0 30px rgba(251, 191, 36, 0.5)'
                  }}
                >
                  <span className="text-black font-bold text-sm truncate w-24 text-center">
                    {entries[0].username}
                  </span>
                  <span className="text-black/80 text-xs">{entries[0].score} pts</span>
                  <span className="text-black/60 text-xs">{entries[0].timeTaken}</span>
                </div>
                <div className="mt-2 text-xs text-amber-400 font-semibold">Champion</div>
              </div>
            )}

            {/* 3rd Place */}
            {entries[2] && (
              <div className="flex flex-col items-center">
                <div className={`text-4xl mb-2`}>🥉</div>
                <div 
                  className="w-24 h-24 rounded-xl flex flex-col items-center justify-center shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    boxShadow: '0 0 20px rgba(234, 88, 12, 0.4)'
                  }}
                >
                  <span className="text-white font-bold text-sm truncate w-20 text-center">
                    {entries[2].username}
                  </span>
                  <span className="text-white/80 text-xs">{entries[2].score} pts</span>
                  <span className="text-white/60 text-xs">{entries[2].timeTaken}</span>
                </div>
                <div className="mt-2 text-xs text-orange-400">Third Place</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-slate-400">Powered by</span>
              <span className="text-sm font-semibold text-white">QuizMaster</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center">
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button onClick={handleCopy} variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <Button onClick={handleShare} size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </div>
    </div>
  );
}
