# LearnLoop — Project Document

A reference for project structure, design system, and coding standards. Keep this updated as the project evolves.

---

## What LearnLoop Does

Users paste raw material (lecture notes, textbook excerpts, transcripts). LearnLoop summarizes it, answers questions grounded in that material, generates flashcards and key memorables, and produces a session handoff so every loop builds on the last.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion (`motion/react`) |
| AI / LLM | LangChain + OpenAI |
| Icons | Lucide React |
| UI primitives | Base UI + shadcn/ui |
| WebGL shader | `@paper-design/shaders-react` |
| Font | Poppins (300–800) + Geist Mono |

---

## Project Structure

```
learnloop.ai/
├── app/
│   ├── api/session/          # One route handler per feature
│   │   ├── ask/route.ts
│   │   ├── compress/route.ts
│   │   ├── flashcards/route.ts
│   │   ├── handoff/route.ts
│   │   ├── memorables/route.ts
│   │   ├── start/route.ts
│   │   └── summarize/route.ts
│   ├── session/
│   │   └── page.tsx          # Active session UI (Phase 9+)
│   ├── globals.css           # Tailwind imports, CSS variables, animations
│   ├── layout.tsx            # Root layout — fonts, metadata
│   └── page.tsx              # Landing page
│
├── components/
│   ├── ui/                   # Generic, context-free primitives
│   │   └── button.tsx
│   ├── dark-mode-toggle.tsx  # Header theme toggle button
│   ├── theme-provider.tsx    # next-themes wrapper for app-wide theme state
│   ├── shader-hero.tsx       # MeshGradient WebGL background
│   ├── rotating-text.tsx     # Animated word rotation
│   ├── shiny-text.tsx        # Shine sweep text effect
│   ├── gradient-text.tsx     # Gradient animated text
│   └── particle-hero.tsx     # Canvas particle system (unused)
│
├── lib/
│   ├── langchain/
│   │   ├── chains/           # One file per LangChain chain
│   │   ├── llmClient.ts      # Shared LLM instance
│   │   └── vectorStore.ts    # Vector store setup
│   ├── session/              # Session lifecycle utilities
│   ├── utils/                # Error handling, response parsing
│   ├── constants.ts          # App-wide constants
│   └── utils.ts              # Shared helpers (cn, etc.)
│
├── types/
│   └── session.ts            # All shared TypeScript types
│
└── scripts/                  # One-off chain test runners
```

### Rules

- **`app/`** — pages and API routes only. No business logic.
- **`components/`** — UI only. No API calls, no LangChain imports.
- **`lib/`** — all business logic, AI chains, and utilities. No JSX.
- **`types/`** — shared types live here, not co-located in files that use them.

---

## Color System

Use semantic theme tokens first (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`). Add raw hex values only for LearnLoop-specific accents and special surfaces. The palette has three layers.

### Theme Tokens

| Token | Usage |
|---|---|---|
| `background` | Page background in both themes |
| `foreground` | Default high-emphasis text |
| `card` / `card-foreground` | Generic surfaces and titles |
| `muted` / `muted-foreground` | Secondary surfaces and body copy |
| `border` | Default border treatment |

### Dark-Specific Surfaces

| Token | Value | Usage |
|---|---|---|
| Deep background | `#081018` | Dark UI base / CTA contrast reference |
| Dark surface | `#060d15` | Features section, footer |
| Ticker band | `#071a1f` | Marquee ticker (teal-tinted dark) |
| Card background | `#090f18` to `#0b1420` | Dark cards and panels |
| Card hover | `#0b1620` | Dark cards on hover |
| Section divider | `#0c121a` | Dark section borders |

### Brand Accents

| Token | Value | Usage |
|---|---|---|
| Teal primary | `#0d9488` | RotatingText pill, hover fills, CTA hover |
| Teal light | `#4FB7B3` | Icon tints, link color, ticker dots |
| Lime | `#84cc16` | Dot separators (legacy — minimize new use) |
| Sky blue | `#60a5fa` | Card number accents |

### Light-Mode Support Colors

| Token | Value | Usage |
|---|---|---|
| Light heading | `#152b32` | Titles on tinted light cards |
| Light body | `#5e7279` | Body copy on light surfaces |
| Light caption | `#59757c` | Hero / section supporting text |
| Light meta | `#7c9196` | Pills, labels, metadata |
| Light teal label | `#2f9f9a` | Eyebrows and emphasized small labels |
| Light number accent | `#85c8d5` | Step number treatment in light mode |

### Dark Text

| Token | Value | Usage |
|---|---|---|
| Heading | `#dce8f8` | Section headings, card titles |
| Body | `#4e6a88` | Card body copy |
| Muted | `#2d4a68` | Subtle links, placeholder text |
| White full | `white` | Primary dark-on-light contrast cases |
| White dimmed | `white/80`, `white/50`, `white/40` | Sub-headlines, footer tagline |

### Borders

| Token | Value | Usage |
|---|---|---|
| Card border | `#0f1e2e` | Feature card default border |
| Card border hover | `#0d9488/30` | Feature card teal glow on hover |
| Ticker border | `#0d2229` | Ticker strip border |

---

## Typography

- **Display / UI font**: Poppins — loaded via `next/font/google` in `layout.tsx`, applied via `--font-poppins` CSS variable
- **Mono font**: Geist Mono — used for labels, step numbers, eyebrows
- **Heading sizes**: `clamp()` for responsive display type; fixed sizes for section headings
- **Tracking**: `-0.03em` on large headlines; `0.2–0.32em` on mono uppercase labels
- **Never use**: Inter, Roboto, Arial, or system-ui as the primary font

---

## Theme System

### Architecture

- Theme state is provided once in `app/layout.tsx` via `components/theme-provider.tsx`.
- `ThemeProvider` wraps `next-themes` with `attribute="class"`, `defaultTheme="dark"`, and `enableSystem={false}`.
- `<html>` must include `suppressHydrationWarning` because the theme class changes on the client.
- New pages should consume theme state through CSS classes, not by reading the theme in page components unless interaction depends on it.

### Toggle Pattern

- Reuse `components/dark-mode-toggle.tsx`; do not create page-specific theme buttons.
- The toggle is a client component and waits until mount before rendering the interactive button.
- Use the mounted placeholder pattern (`if (!mounted) return <div className="h-10 w-10 rounded-full" aria-hidden />`) to avoid layout shift and hydration mismatch.
- Toggle placement for top-level pages: top-right, mirrored against the logo (`absolute right-6 top-6 z-20 sm:right-10 sm:top-7`).

### Page Styling Rules

- Start page shells with `bg-background text-foreground`, not hardcoded dark fills.
- For components that need custom dark art direction, keep light mode as the base class and layer dark styling with `dark:*`.
- If a light-only background image or gradient is added, explicitly disable it in dark mode with `dark:bg-none` before applying the dark fill. This avoids the exact regression where dark cards sit on a light section.
- Prefer semantic text classes for shared copy. Only use custom hex colors for refined light-mode hierarchy or brand accents.
- Keep CTA structure theme-aware: `bg-foreground text-background` in light mode, with explicit `dark:bg-white dark:text-[#081018]` where needed.

### Surface Patterns

- Dark cards: teal-tinted navy gradients, subtle inset highlight, deeper shadows.
- Light cards: very soft tinted gradients, restrained warm/teal mixing, lighter shadows, and stronger copy contrast.
- Metadata pills should invert by theme: soft translucent white in light mode, dark navy chip in dark mode.
- Hover effects should preserve the same geometry across themes; only color, shadow, and border intensity should shift.

### Hero / Shader Rules

- `ShaderHero` stays `pointer-events-none` and behind content (`absolute inset-0 z-0`).
- The hero veil must be theme-aware: lighter veil in light mode (`bg-white/45`), darker veil in dark mode (`dark:bg-black/15`).
- When using decorative backgrounds, all readable content must still define its own text colors; do not rely on the shader for contrast.

---

## Coding Standards

### Separation of Concerns

Keep each layer doing one thing:

```
Route handler (app/api/)
  → calls lib/langchain/chains/
      → uses lib/langchain/llmClient.ts
          → returns typed result (types/session.ts)
              → route handler streams/returns response
```

No LangChain imports in components. No JSX in `lib/`. No inline business logic in route handlers.

### Component Design

**Keep components small and single-purpose.**

```tsx
// Good — one job, no side effects
export function StepCard({ number, title, description, icon: Icon }: StepCardProps) { ... }

// Bad — mixing data fetching, layout, and display in one blob
export function FeatureSection() {
  const [data, setData] = useState(...);
  useEffect(() => fetch(...), []);
  return <div>...200 lines...</div>;
}
```

- Components in `components/ui/` must be fully generic — no LearnLoop-specific logic or hardcoded copy
- Animation components (shader-hero, rotating-text, etc.) are `'use client'` — keep them isolated from server components
- Pass data down as props; don't reach up or sideways

### `'use client'` Boundaries

Only mark a component `'use client'` when it uses browser APIs, event handlers, or React hooks. Keep the boundary as deep in the tree as possible — page-level server components should stay server components.

```
app/page.tsx          — server component (no 'use client')
  └── ShaderHero      — 'use client' (WebGL, window events)
  └── RotatingText    — 'use client' (animation, state)
```

- Theme infrastructure is one of the few allowed app-wide client boundaries:
  - `components/theme-provider.tsx` is client-only and lives under the root layout.
  - `components/dark-mode-toggle.tsx` is client-only because it depends on `next-themes` and mount state.
- For mount-sensitive client components (`DarkModeToggle`, `ShaderHero`), prefer `requestAnimationFrame` inside `useEffect` before flipping mounted state. This keeps hydration smoother and matches the current implementation.

### LangChain Chains

One file per chain in `lib/langchain/chains/`. Each chain file exports a single factory function or chain instance:

```ts
// lib/langchain/chains/qaChain.ts
export function buildQAChain(llm: ChatOpenAI) { ... }
```

Never instantiate the LLM inside a chain file — always receive it as a parameter. This makes chains testable in isolation (see `scripts/`).

### API Routes

- One route per feature — never bundle two operations into one endpoint
- Always stream responses where the output is LLM text
- Validate the request body at the top of the handler before touching any chain
- Return consistent error shapes: `{ error: string, code?: string }`

### TypeScript

- Strict mode is on — no `any`, no type assertions unless genuinely unavoidable
- All session-related types live in `types/session.ts`
- Prefer `interface` for object shapes, `type` for unions/intersections

### Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `ShaderHero`, `StepCard` |
| Hooks | `use` prefix | `useSessionStore` |
| Chain builders | `build*Chain` | `buildQAChain` |
| API routes | noun, kebab-case folder | `app/api/session/ask/` |
| Constants | SCREAMING_SNAKE | `ROTATING_WORDS`, `STEP_ICONS` |
| CSS classes (custom) | kebab-case | `animate-marquee`, `landing-float` |

### Avoid

- Inline styles — use Tailwind classes. Exception: CSS variables and dynamic values that Tailwind cannot express.
- Premature abstraction — don't create a helper for something used once.
- Feature flags or backwards-compat shims — just change the code.
- Unused files — remove `particle-hero.tsx` and `gradient-text.tsx` once confirmed unused.
- The word "study" in user-facing copy — use "loop", "session", "material", "recall" instead.

---

## Animation Patterns

### CSS-only (prefer for simple loops)
```css
/* globals.css */
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
.animate-marquee { animation: marquee 36s linear infinite; }
```

### Framer Motion (for interactive / enter animations)
Use `motion/react` (Framer Motion v11+ API). All `motion.*` usage must be inside `'use client'` components.

### Hover patterns
- Slide-swap buttons: outer element `overflow-hidden`, two child spans — one translates out, one translates in
- Card accents: `scale-x-0 → scale-x-100` on a bottom border element (`origin-center`)
- Color transitions: always `transition-colors duration-300`

---

## Font Setup Pattern

Fonts are loaded once in `app/layout.tsx` and wired via CSS variable → `font-family` in `globals.css`:

```tsx
// layout.tsx
const poppins = Poppins({ variable: '--font-poppins', ... });
// applied as className on <html>
```

```css
/* globals.css — direct assignment avoids Tailwind v4 double-var bug */
@layer base {
  html, body {
    font-family: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
  }
}
```

Do **not** chain `var(--font-poppins)` through `--font-sans` and then `@apply font-sans` — Tailwind v4 resolves the double indirection incorrectly.

---

## Environment Variables

All secrets live in `.env.local` (gitignored). See `.env.local.example` for required keys.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | LLM calls via LangChain |

Never hardcode keys. Never import `.env.local` directly — Next.js loads it automatically in `process.env`.
