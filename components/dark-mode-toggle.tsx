'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function DarkModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!mounted) return <div className="h-10 w-10 rounded-full" aria-hidden />;

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="cursor-pointer group relative flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-card-foreground shadow-md transition-all duration-300 hover:scale-110 hover:shadow-[0_4px_20px_rgba(79,183,179,0.35)] active:scale-95 dark:border-white/10 dark:bg-white dark:text-[#081018]"
    >
      {/* Ripple on press */}
      <span className="absolute inset-0 rounded-full scale-0 bg-[#4FB7B3]/15 transition-transform duration-300 group-active:scale-100" />

      {/* Icon — key forces remount → triggers animate-in on each toggle */}
      <span key={String(isDark)} className="animate-in fade-in zoom-in-50 duration-200">
        {isDark
          ? <Moon className="size-5 text-[#4FB7B3]" strokeWidth={2} />
          : <Sun  className="size-5 text-[#4FB7B3]" strokeWidth={2} />
        }
      </span>
    </button>
  );
}
