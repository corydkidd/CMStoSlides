'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all hover:bg-white/10 group"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-white/60 group-hover:text-cyan-400 transition-colors" />
      ) : (
        <Sun className="w-5 h-5 text-white/60 group-hover:text-cyan-400 transition-colors" />
      )}
    </button>
  );
}
