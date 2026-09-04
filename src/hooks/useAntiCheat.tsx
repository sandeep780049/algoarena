import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useAntiCheat(isActive: boolean) {
  const { toast } = useToast();

  useEffect(() => {
    if (!isActive) return;

    // Show initial warning
    toast({
      title: '⚠️ Contest Mode Active',
      description: 'Screenshots and copying are discouraged during live contests.',
      duration: 5000,
    });

    // Prevent context menu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast({
        title: 'Action Blocked',
        description: 'Right-click is disabled during live contests.',
        variant: 'destructive',
      });
    };

    // Prevent copy/cut/paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast({
        title: 'Action Blocked',
        description: 'Copying is disabled during live contests.',
        variant: 'destructive',
      });
    };

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A, Ctrl+P (print), Ctrl+S (save)
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        toast({
          title: 'Action Blocked',
          description: 'Keyboard shortcuts are disabled during live contests.',
          variant: 'destructive',
        });
      }
      // Block Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        toast({
          title: 'Screenshots Discouraged',
          description: 'Screenshots are discouraged during live contests.',
          variant: 'destructive',
        });
      }
    };

    // Prevent text selection via mouse
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Prevent drag
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('paste', handleCopy);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    // Add CSS class to body for additional protections
    document.body.classList.add('anti-cheat-active');

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('paste', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.body.classList.remove('anti-cheat-active');
    };
  }, [isActive, toast]);
}
