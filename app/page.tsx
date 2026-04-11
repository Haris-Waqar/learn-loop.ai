import Link from 'next/link';
import { ArrowRight, Infinity, FileText, AlignLeft, MessageCircle, Repeat2 } from 'lucide-react';
import { ShaderHero } from '@/components/shader-hero';
import RotatingText from '@/components/rotating-text';
import { DarkModeToggle } from '@/components/dark-mode-toggle';

const STEP_ICONS = [FileText, AlignLeft, MessageCircle, Repeat2];

const loop = [
  {
    number: '01',
    title: 'Paste your material',
    description:
      'Drop in lecture notes, textbook excerpts, transcripts, or any dense text. LearnLoop holds it as your grounded source for the whole session.',
  },
  {
    number: '02',
    title: 'Get a working summary',
    description:
      'Turn hours of reading into a focused revision summary — not a generic condensation, but one anchored to exactly what you pasted.',
  },
  {
    number: '03',
    title: 'Ask and recall',
    description:
      'Question the material live. Watch LearnLoop think, retrieve context, and stream back a grounded answer as it forms — no hallucinated facts.',
  },
  {
    number: '04',
    title: 'Leave with a handoff',
    description:
      'Generate flashcards, key memorables, and a session brief. The next time you open LearnLoop, you pick up exactly where you left off.',
  },
];

// Words that rotate in "Learn [word]" — adverbs that pair naturally with "Learn"
const ROTATING_WORDS = ['anything.', 'deeply.', 'faster.', 'endlessly.', 'freely.'];

export default function Home() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">

      {/* ── Hero — full-viewport mesh gradient ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-32 text-center">
        <ShaderHero />

        {/* ── Top-left logo (like NotebookLM) ── */}
        <div className="absolute left-6 top-6 z-20 sm:left-10 sm:top-7">
          <Link href="/" className="inline-flex items-center gap-2">
            <Infinity className="size-6 text-foreground" strokeWidth={2.4} />
            <span className="text-2xl font-bold tracking-tight text-foreground">LearnLoop</span>
          </Link>
        </div>

        {/* ── Top-right theme toggle ── */}
        <div className="absolute right-6 top-6 z-20 sm:right-10 sm:top-7">
          <DarkModeToggle />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">

          {/* Headline
               Line 1 — fixed
               Line 2 — "Loop" (static) + single rotating word with teal bg pill
               Pattern mirrors the ReactBits "Creative [thinking]" demo exactly */}
          <h1 className="mb-8 text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
            {/* Static first line — nowrap keeps it on one line */}
            <span className="block whitespace-nowrap">Understand more.</span>

            {/* Second line: static prefix + rotating word */}
            <span className="mt-2 flex items-center justify-center gap-4">
              <span className="text-foreground">Learn</span>
              {/*
                RotatingText with teal background pill on the outer span.
                splitBy="words" so the whole word animates as one unit.
                The `layout` prop on the inner motion.span handles width
                transitions smoothly as words change length.
              */}
              <RotatingText
                texts={ROTATING_WORDS}
                rotationInterval={2600}
                staggerDuration={0.04}
                staggerFrom="first"
                splitBy="words"
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                mainClassName="rounded-2xl bg-[#4FB7B3] px-5 py-2 text-white"
              />
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mb-12 max-w-xl text-lg leading-[1.75] text-[#59757c] sm:text-xl dark:text-white/68">
            Drop in your reading. Get a sharp summary, ask anything, pull out flashcards —
            then leave with a handoff that keeps the loop going.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/loops"
              className="group relative overflow-hidden rounded-full bg-foreground px-8 py-4 text-[0.9375rem] font-semibold text-background dark:bg-white dark:text-[#081018]"
            >
              {/* Default label — slides up and fades on hover */}
              <span className="text-[#4FB7B3] inline-flex items-center gap-3 transition-all duration-300 group-hover:-translate-y-10 group-hover:opacity-0">
                Start your loop
                <ArrowRight className="size-4" />
              </span>
              {/* Hover label — teal bg slides up from below */}
              <span className="absolute inset-0 flex items-center justify-center gap-3 rounded-full bg-[#4FB7B3] text-white translate-y-10 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                Start your loop
                <ArrowRight className="size-4" />
              </span>
            </Link>
            <a
              href="#loop"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-8 py-4 text-[0.9375rem] font-medium text-foreground backdrop-blur-sm transition hover:bg-muted/70 dark:border-white/30 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          aria-hidden
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-40"
        >
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-foreground/50 to-foreground/80 dark:via-white/60 dark:to-white" />
        </div>
      </section>

      {/* ── Ticker separator ── */}
      <div id="loop" className="relative overflow-hidden border-y border-border bg-muted py-5 dark:border-[#0d2229] dark:bg-[#071a1f]">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-muted to-transparent dark:from-[#071a1f]" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-muted to-transparent dark:from-[#071a1f]" />
        <div className="flex">
          {[0, 1].map((strip) => (
            <div
              key={strip}
              aria-hidden={strip === 1}
              className="animate-marquee flex shrink-0 items-center gap-12 whitespace-nowrap pr-12"
            >
              {Array.from({ length: 4 }, (_, repeat) =>
                ['Paste your material', 'Summarize', 'Ask questions', 'Recall', 'Generate flashcards', 'Session handoff'].map((label) => (
                  <span key={`${repeat}-${label}`} className="flex items-center gap-12">
                    <span className="font-mono text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase dark:text-white/50">
                      {label}
                    </span>
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB7B3]/60" />
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── The Loop — dark section ── */}
      <section className="border-t border-[#d6e9e8] bg-[linear-gradient(180deg,rgba(248,252,251,0.94)_0%,rgba(241,248,246,0.98)_100%)] dark:border-[#0c121a] dark:bg-[#060d15] dark:bg-none">
        <div className="mx-auto w-full max-w-7xl px-6 pb-16 pt-16 sm:px-10 lg:pb-20 lg:pt-20">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 font-mono text-[10px] tracking-[0.32em] text-[#2f9f9a] uppercase opacity-90 dark:text-[#4FB7B3] dark:opacity-70">
                How it works
              </p>
              <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-[3.25rem] dark:text-[#dce8f8]">
                One session.<br className="sm:hidden" /> Four steps.
              </h2>
            </div>
            <Link
              href="/loops"
              className="hidden items-center gap-2 text-sm font-medium text-[#4FB7B3] transition hover:text-foreground dark:hover:text-white sm:flex"
            >
              Start your loop <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute left-[1.2rem] top-5 hidden h-[calc(100%-2.5rem)] w-px bg-gradient-to-b from-[#0d9488]/0 via-[#0d9488]/20 to-[#0d9488]/0 dark:via-[#0d9488]/35 md:block"
            />

            <div className="space-y-3">
              {loop.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <div
                    key={step.number}
                    className="group relative overflow-hidden rounded-[26px] border border-[#d3e6e3] bg-[linear-gradient(135deg,rgba(251,255,255,0.96)_0%,rgba(242,249,247,0.96)_55%,rgba(255,251,246,0.92)_100%)] px-5 py-5 shadow-[0_12px_32px_rgba(64,112,110,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#67b9b1]/55 hover:shadow-[0_20px_48px_rgba(64,112,110,0.12)] sm:px-6 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:gap-6 md:px-6 md:py-5 dark:border-[#133047] dark:bg-[linear-gradient(180deg,#0b1420_0%,#09111b_100%)] dark:shadow-[0_14px_40px_rgba(2,12,24,0.24),inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:border-[#0d9488]/35 dark:hover:bg-[#0b1620] dark:hover:shadow-[0_24px_80px_rgba(2,12,24,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(79,183,179,0.16),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(255,219,182,0.16),transparent_26%),linear-gradient(90deg,rgba(255,255,255,0.35),transparent_18%)] dark:bg-[radial-gradient(circle_at_18%_50%,rgba(13,148,136,0.08),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.02),transparent_18%)]" />
                    </div>

                    <div className="relative mb-4 flex items-center gap-4 md:mb-0 md:min-w-[5.25rem] md:flex-col md:items-start md:gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#bfe4df] bg-[#4FB7B3]/14 text-[#228d88] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-all duration-300 group-hover:scale-[1.03] group-hover:border-[#8fd2ca] group-hover:bg-[#4FB7B3]/20 dark:border-[#173347] dark:bg-[#0d9488]/10 dark:text-[#4FB7B3] dark:shadow-none">
                        <Icon className="size-4" strokeWidth={1.8} />
                      </span>
                      <div className="flex min-w-0 items-center gap-3 md:flex-col md:items-start md:gap-1.5">
                        <span className="font-mono text-[10px] tracking-[0.28em] text-[#2f9f9a] uppercase opacity-90 dark:text-[#4FB7B3] dark:opacity-[0.55]">
                          Step
                        </span>
                        <span className="select-none font-mono text-xl font-bold text-[#85c8d5] transition-colors duration-300 group-hover:text-[#53adc0] dark:text-[#60a5fa]/20 dark:group-hover:text-[#60a5fa]/35 md:text-[1.7rem]">
                          {step.number}
                        </span>
                      </div>
                    </div>

                    <div className="relative md:pt-0.5">
                      <div className="mb-2">
                        <h3 className="max-w-[20ch] text-[1.0625rem] font-semibold text-[#152b32] dark:text-[#dce8f8]">
                          {step.title}
                        </h3>
                      </div>
                      <p className="max-w-[62ch] text-sm leading-[1.75] text-[#5e7279] dark:text-[#4e6a88]">
                        {step.description}
                      </p>
                    </div>

                    {i < loop.length - 1 ? (
                      <div className="relative hidden md:flex md:items-start md:pt-1">
                        <span className="rounded-full border border-[#d7e8e6] bg-white/70 px-3 py-1 font-mono text-[10px] tracking-[0.24em] text-[#7c9196] uppercase backdrop-blur-sm dark:border-[#123041] dark:bg-[#081018] dark:text-white/30">
                          Continue
                        </span>
                      </div>
                    ) : (
                      <div className="relative hidden md:flex md:items-start md:pt-1">
                        <span className="rounded-full border border-[#cde7e2] bg-white/70 px-3 py-1 font-mono text-[10px] tracking-[0.24em] text-[#2f9f9a] uppercase opacity-90 backdrop-blur-sm dark:border-[#123041] dark:bg-[#081018] dark:text-[#4FB7B3] dark:opacity-70">
                          Repeat
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-5 right-5 h-px origin-left scale-x-0 bg-gradient-to-r from-[#0d9488]/60 via-[#0d9488]/10 to-transparent transition-transform duration-500 group-hover:scale-x-100 sm:left-6 sm:right-6 md:left-[6rem] md:right-6" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 flex justify-center sm:hidden">
            <Link
              href="/loops"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4FB7B3] transition hover:text-foreground dark:hover:text-white"
            >
              Start your loop <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-muted/50 px-6 py-7 dark:border-[#0c121a] dark:bg-[#060d15] dark:bg-none sm:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Infinity className="size-5 text-foreground" strokeWidth={2.4} />
            <span className="text-sm font-bold tracking-tight text-foreground">LearnLoop</span>
          </div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase dark:text-white/40">
            Your knowledge. Your loop.
          </p>
        </div>
      </footer>
    </main>
  );
}
