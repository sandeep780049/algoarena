import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Home,
  Trophy,
  Code2,
  User,
  Settings,
  Calendar,
  Info,
  Mail,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const go = (path: string) => () => run(() => navigate(path));

  const signOutAndClose = async () => {
    onOpenChange(false);
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={go('/')}>
            <Home className="mr-2 h-4 w-4" /> Home
          </CommandItem>
          <CommandItem onSelect={go('/contests')}>
            <Trophy className="mr-2 h-4 w-4" /> Contests
          </CommandItem>
          <CommandItem onSelect={go('/leaderboard')}>
            <Code2 className="mr-2 h-4 w-4" /> Leaderboard
          </CommandItem>
          {user && (
            <CommandItem onSelect={go('/profile')}>
              <User className="mr-2 h-4 w-4" /> My Profile
            </CommandItem>
          )}
          {isAdmin && (
            <CommandItem onSelect={go('/admin')}>
              <Settings className="mr-2 h-4 w-4" /> Admin Panel
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          {user ? (
            <CommandItem onSelect={signOutAndClose}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </CommandItem>
          ) : (
            <>
              <CommandItem onSelect={go('/auth')}>
                <LogIn className="mr-2 h-4 w-4" /> Sign In
              </CommandItem>
              <CommandItem onSelect={go('/auth/signup')}>
                <LogIn className="mr-2 h-4 w-4" /> Create Account
              </CommandItem>
            </>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={go('/about')}>
            <Info className="mr-2 h-4 w-4" /> About
          </CommandItem>
          <CommandItem onSelect={go('/contact')}>
            <Mail className="mr-2 h-4 w-4" /> Contact
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
