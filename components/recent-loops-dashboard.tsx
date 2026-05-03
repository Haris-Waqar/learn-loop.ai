'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock3, Infinity, Layers3, Plus } from 'lucide-react';
import { DarkModeToggle } from '@/components/dark-mode-toggle';

import { readRecentLoops, touchRecentLoop } from '@/lib/session/recentLoops';
import type { RecentLoop } from '@/types/session';

const DEMO_LOOPS: RecentLoop[] = [
  // {
  //   loopId: 'demo-chemistry-stoichiometry',
  //   title: 'Chemistry — Stoichiometry',
  //   subject: 'Chemistry',
  //   subtopic: 'Stoichiometry',
  //   updatedAt: Date.now() - 1000 * 60 * 42,
  //   sourceCount: 1,
  // },
  // {
  //   loopId: 'demo-biology-cellular-respiration',
  //   title: 'Biology — Cellular Respiration',
  //   subject: 'Biology',
  //   subtopic: 'Cellular respiration',
  //   updatedAt: Date.now() - 1000 * 60 * 60 * 5,
  //   sourceCount: 1,
  // },
  // {
  //   loopId: 'demo-history-industrial-revolution',
  //   title: 'History — Industrial Revolution',
  //   subject: 'History',
  //   subtopic: 'Industrial Revolution',
  //   updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  //   sourceCount: 1,
  // },
  // {
  //   loopId: 'demo-software-distributed-systems',
  //   title: 'Software Engineering — Distributed Systems',
  //   subject: 'Software Engineering',
  //   subtopic: 'Distributed Systems',
  //   updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  //   sourceCount: 1,
  // },
];

function formatUpdatedAt(timestamp: number) {
  const diff = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(diff / (1000 * 60));

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }

  const hours = Math.round(diff / (1000 * 60 * 60));
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (Math.abs(days) < 7) {
    return formatter.format(days, 'day');
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp);
}

function LoopCard({ loop }: { loop: RecentLoop }) {
  const metadata = loop.subtopic ? `${loop.subject} • ${loop.subtopic}` : loop.subject || 'Untitled Loop';
  const sourceLabel = `${loop.sourceCount} source${loop.sourceCount === 1 ? '' : 's'}`;

  return (
    <Link
      href={`/loops/${encodeURIComponent(loop.loopId)}`}
      onClick={() => {
        touchRecentLoop(loop.loopId);
      }}
      className="group relative overflow-hidden rounded-[28px] border border-[#d3e6e3] bg-[linear-gradient(135deg,rgba(251,255,255,0.97)_0%,rgba(243,249,247,0.97)_55%,rgba(255,250,245,0.94)_100%)] p-6 shadow-[0_12px_32px_rgba(64,112,110,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#67b9b1]/55 hover:shadow-[0_20px_48px_rgba(64,112,110,0.12)] dark:border-[#133047] dark:bg-[linear-gradient(180deg,#0b1420_0%,#09111b_100%)] dark:shadow-[0_14px_40px_rgba(2,12,24,0.24),inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:border-[#0d9488]/35 dark:hover:bg-[#0b1620] dark:hover:shadow-[0_24px_80px_rgba(2,12,24,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(79,183,179,0.16),transparent_35%),radial-gradient(circle_at_85%_18%,rgba(255,219,182,0.14),transparent_28%)] dark:bg-[radial-gradient(circle_at_15%_0%,rgba(79,183,179,0.12),transparent_35%)]" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="max-w-[24ch] text-xl font-semibold tracking-tight text-[#152b32] dark:text-[#dce8f8]">
              {loop.title}
            </h2>
          </div>
          <span className="inline-flex rounded-full border border-[#d7e8e6] bg-white/70 px-3 py-1 font-mono text-[10px] tracking-[0.24em] text-[#7c9196] uppercase backdrop-blur-sm transition-colors duration-300 group-hover:text-[#2f9f9a] dark:border-[#123041] dark:bg-[#081018] dark:text-white/35 dark:group-hover:text-[#4FB7B3]/80">
            Resume
          </span>
        </div>

        <p className="mb-6 text-sm leading-[1.75] text-[#5e7279] dark:text-[#4e6a88]">
          {metadata}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-4 text-sm text-[#6c8389] dark:text-white/40">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="size-4 text-[#4FB7B3]/70" />
            {formatUpdatedAt(loop.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-2">
            <Layers3 className="size-4 text-[#4FB7B3]/70" />
            {sourceLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function RecentLoopsDashboard() {
  const [loops, setLoops] = useState<RecentLoop[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const savedLoops = readRecentLoops();
      setLoops(savedLoops.length > 0 ? savedLoops : DEMO_LOOPS);
      setHasHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute left-6 top-6 z-20 sm:left-10 sm:top-7">
        <Link href="/" className="inline-flex items-center gap-2">
          <Infinity className="size-6 text-foreground" strokeWidth={2.4} />
          <span className="text-2xl font-bold tracking-tight text-foreground">LearnLoop</span>
        </Link>
      </div>

      <div className="absolute right-6 top-6 z-20 sm:right-10 sm:top-7">
        <DarkModeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-16 pt-28 sm:px-10 sm:pb-20 sm:pt-32">

        <header className="mb-12 flex flex-col gap-6 sm:mb-14 sm:flex-row sm:items-start sm:justify-between">
          <div className="pt-2">
            <h1 className="max-w-[12ch] text-[clamp(2.1rem,4vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-foreground dark:text-[#dce8f8]">
              Recent Loops
            </h1>
            <p className="mt-4 max-w-xl text-base leading-[1.8] text-[#59757c] sm:text-lg dark:text-white/65">
              Pick up where you left off or start a new loop.
            </p>
          </div>

          <Link
            href="/loops/new"
            className="group relative inline-flex self-start overflow-hidden rounded-full bg-foreground px-6 py-3.5 text-[0.95rem] font-semibold text-background sm:mt-1 dark:bg-white dark:text-[#081018]"
          >
            <span className="inline-flex items-center gap-3 transition-all duration-300 group-hover:-translate-y-10 group-hover:opacity-0">
              <Plus className="size-4" />
              New Loop
            </span>
            <span className="absolute inset-0 flex items-center justify-center gap-3 rounded-full bg-[#4FB7B3] text-white translate-y-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <Plus className="size-4" />
              New Loop
            </span>
          </Link>
        </header>

        {!hasHydrated ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-56 rounded-[28px] border border-[#d6e8e5] bg-[linear-gradient(135deg,rgba(251,255,255,0.94)_0%,rgba(242,248,246,0.92)_100%)] dark:border-[#0f1e2e] dark:bg-none dark:bg-[linear-gradient(180deg,#0b1420_0%,#09111b_100%)]"
              />
            ))}
          </div>
        ) : loops.length === 0 ? (
          <section className="rounded-[32px] border border-dashed border-[#cde4e0] bg-[linear-gradient(180deg,rgba(246,251,250,0.96)_0%,rgba(239,247,245,0.98)_100%)] px-8 py-16 text-center sm:px-12 dark:border-white/15 dark:bg-none dark:bg-[linear-gradient(180deg,#0b1420_0%,#09111b_100%)] dark:shadow-[0_14px_40px_rgba(2,12,24,0.24),inset_0_1px_0_rgba(255,255,255,0.03)]">
            <p className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#2f9f9a] uppercase opacity-90 dark:text-[#6dd4cf] dark:opacity-100">
              No saved loops
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Start your first loop.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-[1.9] text-muted-foreground sm:text-base">
              Create a new loop to turn your material into a grounded summary, live recall chat,
              flashcards, memorables, and a handoff for next time.
            </p>
            <Link
              href="/loops/new"
              className="group relative mt-8 inline-flex overflow-hidden rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background dark:bg-white dark:text-[#081018]"
            >
              <span className="inline-flex items-center gap-3 transition-all duration-300 group-hover:-translate-y-10 group-hover:opacity-0">
                <Plus className="size-4" />
                New Loop
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-3 rounded-full bg-[#4FB7B3] text-white translate-y-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <Plus className="size-4" />
                New Loop
              </span>
            </Link>
          </section>
        ) : (
          <section>
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] tracking-[0.28em] text-[#7c9196] uppercase dark:text-white/35">
                {loops === DEMO_LOOPS ? 'Preview loops' : 'Saved loops'}
              </p>
              {loops === DEMO_LOOPS ? (
                <p className="text-sm text-[#5e7279] dark:text-[#4e6a88]">
                  Showing hard-coded loops until local loops are created.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
            {loops.map((loop) => (
              <LoopCard key={loop.loopId} loop={loop} />
            ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
