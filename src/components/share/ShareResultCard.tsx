import { useRef } from 'react';
import { 
  Share2, 
  Download, 
  Copy, 
  Trophy,
  Instagram,
  MessageCircle,
  Twitter,
  Crown,
  Medal,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface ShareResultCardProps {
  contestName: string;
  rank: number;
  score: number;
  totalQuestions: number;
  username: string;
  avatarUrl?: string | null;
  timeTaken?: string;
}

export function ShareResultCard({
  contestName,
  rank,
  score,
  totalQuestions,
  username,
  avatarUrl,
  timeTaken,
}: ShareResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { text: '🥇 Champion', color: 'text-amber-400', icon: Crown };
    if (rank === 2) return { text: '🥈 Runner-up', color: 'text-slate-400', icon: Medal };
    if (rank === 3) return { text: '🥉 Third Place', color: 'text-orange-500', icon: Medal };
    if (rank <= 10) return { text: `⭐ Top 10 - #${rank}`, color: 'text-primary', icon: Star };
    return { text: `Rank #${rank}`, color: 'text-muted-foreground', icon: null };
  };

  const rankBadge = getRankBadge(rank);
  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0e1a',
        scale: 2,
      });
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (error) {
      console.error('Error generating image:', error);
      return null;
    }
  };

  const handleDownload = async () => {
    const blob = await generateImage();
    if (!blob) {
      toast({ title: 'Error', description: 'Failed to generate image', variant: 'destructive' });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jc-algoarena-result-${contestName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Downloaded!', description: 'Result card saved to your device.' });
  };

  const handleCopyImage = async () => {
    const blob = await generateImage();
    if (!blob) {
      toast({ title: 'Error', description: 'Failed to generate image', variant: 'destructive' });
      return;
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast({ title: 'Copied!', description: 'Image copied to clipboard.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to copy image', variant: 'destructive' });
    }
  };

  const handleShareWhatsApp = async () => {
    const text = `🏆 Check out my result on JC AlgoArena!\n\n📌 ${contestName}\n🎖️ ${rankBadge.text}\n✅ Score: ${score}/${totalQuestions} (${accuracy}%)\n\nJoin the competition: ${window.location.origin}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareTwitter = async () => {
    const text = `🏆 Just competed in ${contestName} on @JCAlgoArena!\n\n🎖️ ${rankBadge.text}\n✅ Score: ${score}/${totalQuestions} (${accuracy}%)\n\nJoin the arena: ${window.location.origin}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareInstagram = async () => {
    await handleDownload();
    toast({ 
      title: 'Ready for Instagram!', 
      description: 'Image downloaded. Open Instagram and share it to your story!' 
    });
  };

  return (
    <div className="space-y-4">
      {/* Shareable Card */}
      <div
        ref={cardRef}
        className="relative p-6 rounded-xl bg-gradient-to-br from-card via-card to-primary/5 border border-border overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">
                <span className="text-primary">JC</span> AlgoArena
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              @jc_coder_
            </span>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16 border-2 border-primary/30">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-xl font-bold">
                {username?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-lg">{username}</p>
              <div className="flex items-center gap-2">
                <p className={`font-semibold ${rankBadge.color}`}>{rankBadge.text}</p>
                {rank <= 10 && (
                  <Badge variant="outline" className={`${rank <= 3 ? 'bg-amber-500/20 border-amber-500/30' : 'bg-primary/20 border-primary/30'}`}>
                    {rank <= 3 ? 'Winner' : 'Top 10'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contest Name */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Contest</p>
            <p className="font-semibold text-lg">{contestName}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-background/50">
              <p className="text-2xl font-bold text-primary">{score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50">
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50">
              <p className="text-2xl font-bold">{timeTaken || '-'}</p>
              <p className="text-xs text-muted-foreground">Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button onClick={handleCopyImage} variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShareInstagram}>
              <Instagram className="h-4 w-4 mr-2" />
              Instagram Story
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareTwitter}>
              <Twitter className="h-4 w-4 mr-2" />
              Twitter / X
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
