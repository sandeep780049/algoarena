import { useRef } from 'react';
import { Download, Share2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

interface CertificateCardProps {
  username: string;
  contestName: string;
  contestDate: string;
  rank: number;
  certificateCode: string;
  issuedAt: string;
  showActions?: boolean;
}

export function CertificateCard({
  username,
  contestName,
  contestDate,
  rank,
  certificateCode,
  issuedAt,
  showActions = true,
}: CertificateCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getRankTitle = (rank: number) => {
    if (rank === 1) return { title: 'Champion', emoji: '🥇', color: 'text-amber-400' };
    if (rank === 2) return { title: 'Runner-up', emoji: '🥈', color: 'text-slate-400' };
    if (rank === 3) return { title: 'Third Place', emoji: '🥉', color: 'text-orange-500' };
    return { title: 'Top 10 Performer', emoji: '⭐', color: 'text-primary' };
  };

  const rankInfo = getRankTitle(rank);

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
      toast({ title: 'Error', description: 'Failed to generate certificate', variant: 'destructive' });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${certificateCode}.png`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Downloaded!', description: 'Certificate saved to your device.' });
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/certificate/${certificateCode}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Link Copied!', description: 'Certificate link copied to clipboard.' });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/certificate/${certificateCode}`;
    const shareData = {
      title: `JC AlgoArena Certificate - ${username}`,
      text: `🏆 ${username} achieved Rank #${rank} in ${contestName}! View certificate:`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="space-y-4">
      {/* Certificate Card */}
      <div
        ref={cardRef}
        className="relative p-8 rounded-xl bg-gradient-to-br from-card via-card to-primary/10 border-2 border-primary/30 overflow-hidden"
      >
        {/* Background decorations */}
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">
              <span className="text-primary">JC</span> AlgoArena
            </h2>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">
              Certificate of Achievement
            </p>
          </div>

          {/* Rank Badge */}
          <div className="text-center mb-6">
            <span className="text-5xl">{rankInfo.emoji}</span>
            <p className={`text-2xl font-bold mt-2 ${rankInfo.color}`}>
              {rankInfo.title}
            </p>
            <p className="text-muted-foreground">Rank #{rank}</p>
          </div>

          {/* Recipient */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">This certifies that</p>
            <p className="text-3xl font-bold text-primary mt-1">{username}</p>
          </div>

          {/* Achievement Details */}
          <div className="text-center mb-8 space-y-1">
            <p className="text-muted-foreground">
              has successfully achieved a top rank in
            </p>
            <p className="text-xl font-semibold">{contestName}</p>
            <p className="text-sm text-muted-foreground">
              held on {format(new Date(contestDate), 'MMMM d, yyyy')}
            </p>
          </div>

          {/* Certificate Details */}
          <div className="flex justify-between items-end pt-6 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Certificate ID</p>
              <p className="font-mono text-sm text-primary">{certificateCode}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Issued on</p>
              <p className="text-sm">{format(new Date(issuedAt), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleCopyLink} variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          <Button onClick={handleShare} variant="default" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      )}
    </div>
  );
}
