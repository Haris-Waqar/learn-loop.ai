'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock3, Infinity, Layers3, Plus } from 'lucide-react';

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
      href={`/session?loopId=${encodeURIComponent(loop.loopId)}`}
      onClick={() => {
        touchRecentLoop(loop.loopId);
      }}
      className="group relative overflow-hidden rounded-[28px] border border-[#133047] bg-[linear-gradient(180deg,#0b1420_0%,#09111b_100%)] p-6 shadow-[0_14px_40px_rgba(2,12,24,0.24),inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0d9488]/35 hover:bg-[#0b1620] hover:shadow-[0_24px_80px_rgba(2,12,24,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(79,183,179,0.12),transparent_35%)]" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="max-w-[24ch] text-xl font-semibold tracking-tight text-[#dce8f8]">
              {loop.title}
            </h2>
          </div>
          <span className="inline-flex rounded-full border border-[#123041] bg-[#081018] px-3 py-1 font-mono text-[10px] tracking-[0.24em] text-white/35 uppercase transition-colors duration-300 group-hover:text-[#4FB7B3]/80">
            Resume
          </span>
        </div>

        <p className="mb-6 text-sm leading-[1.75] text-[#4e6a88]">
          {metadata}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-4 text-sm text-white/40">
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
    const savedLoops = readRecentLoops();
    setLoops(savedLoops.length > 0 ? savedLoops : DEMO_LOOPS);
    setHasHydrated(true);
  }, []);

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="absolute left-6 top-6 sm:left-10 sm:top-7">
        <Link href="/" className="inline-flex items-center gap-2">
          <Infinity className="size-6 text-white" strokeWidth={2.4} />
          <span className="text-2xl font-bold tracking-tight text-white">LearnLoop</span>
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-16 pt-28 sm:px-10 sm:pb-20 sm:pt-32">

        <header className="mb-12 flex flex-col gap-6 sm:mb-14 sm:flex-row sm:items-start sm:justify-between">
          <div className="pt-2">
            <h1 className="max-w-[12ch] text-[clamp(2.1rem,4vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[#dce8f8]">
              Recent Loops
            </h1>
            <p className="mt-4 max-w-xl text-base leading-[1.8] text-white/65 sm:text-lg">
              Pick up where you left off or start a new loop.
            </p>
          </div>

          <Link
            href="/session"
            className="group relative inline-flex self-start overflow-hidden rounded-full bg-white px-6 py-3.5 text-[0.95rem] font-semibold text-[#081018] sm:mt-1"
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
                className="h-56 rounded-[28px] border border-[#0f1e2e] bg-[#090f18]/80"
              />
            ))}
          </div>
        ) : loops.length === 0 ? (
          <section className="rounded-[32px] border border-dashed border-[#123041] bg-[#090f18]/80 px-8 py-16 text-center sm:px-12">
            <p className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#4FB7B3]/65 uppercase">
              No saved loops
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#dce8f8]">
              Start your first loop.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-[1.9] text-[#4e6a88] sm:text-base">
              Create a new loop to turn your material into a grounded summary, live recall chat,
              flashcards, memorables, and a handoff for next time.
            </p>
            <Link
              href="/session"
              className="group relative mt-8 inline-flex overflow-hidden rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#081018]"
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
              <p className="font-mono text-[10px] tracking-[0.28em] text-white/35 uppercase">
                {loops === DEMO_LOOPS ? 'Preview loops' : 'Saved loops'}
              </p>
              {loops === DEMO_LOOPS ? (
                <p className="text-sm text-[#4e6a88]">
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
