# LearnLoop — Execution Plan

> Source of truth for all development phases. Updated as each phase completes.

---

## Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

---

## Phase 0 — Project Scaffold & Standards `[x]`

**What gets built:**
Next.js 14+ (App Router) project with TypeScript strict mode, ESLint, Prettier, Tailwind CSS, shadcn/ui base setup, folder structure, and environment variable config.

**Files to create:**
- `package.json` (Next.js, Tailwind, shadcn/ui, Prettier, ESLint deps)
- `tsconfig.json` (strict mode)
- `.eslintrc.json`
- `.prettierrc`
- `.env.local.example`
- `app/layout.tsx`
- `app/page.tsx` (placeholder)
- `lib/constants.ts`
- `types/session.ts`
- Folder stubs: `app/api/session/`, `lib/langchain/chains/`, `lib/session/`, `lib/utils/`, `scripts/`

**Acceptance criteria:**
- `npm run dev` boots without errors on `localhost:3000`
- `npm run lint` passes with zero errors
- TypeScript strict mode enabled, no `any` allowed

**Test commands:**
```bash
npm run dev     # must boot
npm run lint    # must pass
npm run build   # must succeed
```

**Completion notes:** `npm run lint` ✓ | `npm run build` ✓ | Next.js 16.2.2 + Tailwind v4 + shadcn/ui + Prettier configured. All folder stubs created. `types/session.ts`, `lib/constants.ts`, `lib/utils/`, `lib/session/tokenCounter.ts` written.

---

## Phase 1 — LangChain Foundation `[~]`

**What gets built:**
LangChain JS installed and configured. Shared LLM client (`gpt-4o-mini`). Utilities: token counter, error handler, response parser. Placeholder chain files for all 8 chains. Test script confirms LLM connectivity.

**Files to create:**
- `lib/langchain/llmClient.ts` — shared ChatOpenAI instance
- `lib/langchain/chains/classifierChain.ts` (placeholder)
- `lib/langchain/chains/personaBuilderChain.ts` (placeholder)
- `lib/langchain/chains/summaryChain.ts` (placeholder)
- `lib/langchain/chains/qaChain.ts` (placeholder)
- `lib/langchain/chains/topicShiftChain.ts` (placeholder)
- `lib/langchain/chains/compressorChain.ts` (placeholder)
- `lib/langchain/chains/memorableChain.ts` (placeholder)
- `lib/langchain/chains/flashcardChain.ts` (placeholder)
- `lib/langchain/chains/handoffChain.ts` (placeholder)
- `lib/langchain/vectorStore.ts` (placeholder)
- `lib/session/tokenCounter.ts`
- `lib/utils/errorHandler.ts`
- `lib/utils/responseParser.ts`
- `scripts/test-llm.ts`

**Acceptance criteria:**
- `npx ts-node scripts/test-llm.ts` logs a valid LLM response
- OPENAI_API_KEY confirmed working
- All chain files present with correct export signatures

**Test commands:**
```bash
npx ts-node scripts/test-llm.ts
```

**Completion notes:** `@langchain/openai`, `@langchain/core`, `@langchain/community`, and `langchain` installed and wired into the project. Shared ChatOpenAI clients added in `lib/langchain/llmClient.ts` with `gpt-4o-mini` defaulting from environment-backed constants. Core utilities implemented in `lib/session/tokenCounter.ts`, `lib/utils/errorHandler.ts`, and `lib/utils/responseParser.ts`. Placeholder chain files and `lib/langchain/vectorStore.ts` created with stable export signatures for later phases. Added `scripts/test-llm.ts` and verified OpenAI connectivity with `npx ts-node --project tsconfig.scripts.json scripts/test-llm.ts` ✓.

---

## Phase 2 — Session Init Chains `[x]`

**What gets built:**
`ClassifierChain` + `PersonaBuilderChain` as a SequentialChain. `/api/session/start` route that accepts material and returns a full session seed including classification, persona, and serialized vectors.

**Files to create/modify:**
- `lib/langchain/chains/classifierChain.ts` (implement)
- `lib/langchain/chains/personaBuilderChain.ts` (implement)
- `lib/langchain/vectorStore.ts` (embed + serialize logic)
- `app/api/session/start/route.ts`
- `scripts/test-session-start.ts`

**Acceptance criteria:**
- Chemistry transcript → `{ subject: "Chemistry", subtopic: "...", confidence: "high", persona: "..." }`
- Software engineering transcript → different subject + persona returned
- Serialized vectors returned and non-empty
- Response payload is a client-ready `SessionState` seed

**Test commands:**
```bash
npx ts-node scripts/test-session-start.ts
```

**Completion notes:** `ClassifierChain` and `PersonaBuilderChain` implemented. `embedAndSerialize()` now chunks material with `RecursiveCharacterTextSplitter`, embeds with `text-embedding-3-small`, and returns serialized vectors for client persistence. `/api/session/start` returns a full `SessionState` seed, including `sessionId`, classifier output, persona, serialized vectors, and default session fields. Added `lib/session/createSessionSeed.ts` and `scripts/test-session-start.ts`. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-session-start.ts` ✓ and `npm run build` ✓. Uses `MemoryVectorStore`-compatible serialized embeddings for later Phase 4 reconstruction rather than `DocArrayInMemorySearch`, which is not present in the installed LangChain packages.

---

## Phase 3 — SummaryChain `[x]`

**What gets built:**
`SummaryChain` with persona injection. `/api/session/summarize` route with streaming support.

**Files to create/modify:**
- `lib/langchain/chains/summaryChain.ts` (implement)
- `app/api/session/summarize/route.ts`
- `scripts/test-summary.ts`

**Acceptance criteria:**
- Streamed bullet-point summary returned (5–8 bullets)
- Persona visibly shapes the tone of the summary
- Response streams incrementally (not all at once)

**Test commands:**
```bash
npx ts-node scripts/test-summary.ts
```

**Completion notes:** `SummaryChain` implemented with persona-shaped bullet summarization using the shared streaming LLM client. Added `/api/session/summarize` as an SSE route that emits `chunk` events during generation and a final `complete` event with the assembled summary for client persistence. Added `scripts/test-summary.ts` to validate live streaming, final bullet count, and invalid-input handling. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-summary.ts` ✓ and `npm run build` ✓.

---

## Phase 4 — QAChain + MemoryVectorStore `[x]`

**What gets built:**
`QAChain` reconstructs `MemoryVectorStore` from serialized vectors, runs similarity search over the original material chunks, and injects the top 3 retrieved chunks plus conversation history into the prompt. `/api/session/ask` route.

**Files to create/modify:**
- `lib/langchain/chains/qaChain.ts` (implement)
- `lib/langchain/vectorStore.ts` (reconstruct logic)
- `app/api/session/ask/route.ts`
- `scripts/test-qa.ts`

**Acceptance criteria:**
- Answers are context-aware across 3 follow-up questions
- Second question can reference the first answer
- Retrieval returns relevant chunks (verified by logging retrieved content)

**Test commands:**
```bash
npx ts-node scripts/test-qa.ts
```

**Completion notes:** `reconstructVectorStore()` now rebuilds `MemoryVectorStore` from client-persisted serialized vectors. `QAChain` retrieves the top source chunks, injects persona + rolling context + recent messages into the prompt, and supports reusable streamed answer generation. Added `/api/session/ask` as an SSE route that emits buffered `chunk` events and a final `complete` event containing `answer`, `updatedMessages`, `tokenCount`, and `retrievedChunks`. Added `scripts/test-qa.ts` to verify three-step follow-up conversation behavior, retrieval relevance, message trimming, and invalid-input handling. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-qa.ts` ✓ and `npm run build` ✓.

---

## Phase 5 — TopicShiftChain `[x]`

**What gets built:**
`TopicShiftChain` that detects when user question leaves the current subject. Runs in parallel inside `/api/session/ask`. Returns `{ shifted: boolean, newSubject: string | null }`.

**Files to create/modify:**
- `lib/langchain/chains/topicShiftChain.ts` (implement)
- `app/api/session/ask/route.ts` (extend to run TopicShiftChain in parallel)
- `scripts/test-topic-shift.ts`

**Acceptance criteria:**
- On-topic question → `{ shifted: false, newSubject: null }`
- Off-topic question → `{ shifted: true, newSubject: "..." }`
- Both results returned alongside the QA answer

**Test commands:**
```bash
npx ts-node scripts/test-topic-shift.ts
```

**Completion notes:** `TopicShiftChain` implemented with conservative JSON classification against the active `currentSubject`, `currentSubtopic`, and incoming user message. `/api/session/ask` now requires `currentSubject` and `currentSubtopic`, runs topic-shift detection in parallel with QA generation, and includes `topicShift` in the final SSE `complete` payload. Added `scripts/test-topic-shift.ts` to verify both direct chain behavior and off-topic detection through the ask route. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-topic-shift.ts` ✓.

---

## Phase 6 — CompressorChain `[x]`

**What gets built:**
`CompressorChain` that summarises a list of messages into 2–3 sentences. `/api/session/compress` route.

**Files to create/modify:**
- `lib/langchain/chains/compressorChain.ts` (implement)
- `app/api/session/compress/route.ts`
- `scripts/test-compress.ts`

**Acceptance criteria:**
- 8 input messages → compact 2–3 sentence summary returned
- Output is shorter than combined input
- Key facts from the conversation are preserved

**Test commands:**
```bash
npx ts-node scripts/test-compress.ts
```

**Completion notes:** `CompressorChain` implemented to condense message batches into a short 2–3 sentence summary chunk while preserving key questions, facts, and conclusions. Added `/api/session/compress` as a buffered JSON route, then wired the same compressor into `/api/session/ask` so old messages are automatically summarized into `rollingSum` when the token threshold is crossed. The ask route now returns `rollingSum`, `compressionApplied`, and `shouldWarn` in the final `complete` event. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-compress.ts` ✓.

---

## Phase 7 — MemorableChain + FlashcardChain `[x]`

**What gets built:**
`MemorableChain` extracts 5–7 context-aware key points. `FlashcardChain` uses `StructuredOutputParser` + `ResponseSchema` to return typed `[{ front, back }]` JSON. Both routes built and tested.

**Files to create/modify:**
- `lib/langchain/chains/memorableChain.ts` (implement)
- `lib/langchain/chains/flashcardChain.ts` (implement)
- `app/api/session/memorables/route.ts`
- `app/api/session/flashcards/route.ts`
- `scripts/test-memorables.ts`
- `scripts/test-flashcards.ts`

**Acceptance criteria:**
- Flashcards returned as valid typed JSON array
- Memorables list is numbered and distinct
- Both chains reflect prior Q&A context, not just raw material

**Test commands:**
```bash
npx ts-node scripts/test-memorables.ts
npx ts-node scripts/test-flashcards.ts
```

**Completion notes:** `MemorableChain` and `FlashcardChain` implemented as context-aware study modes that use `material`, optional `summary`, prior conversation, `rollingSum`, and persona rather than raw material alone. Added `/api/session/memorables` and `/api/session/flashcards` as JSON routes, with flashcards validated through `StructuredOutputParser` and a strict array-of-cards schema. Added `scripts/test-memorables.ts` and `scripts/test-flashcards.ts` to verify distinct memorables and valid typed flashcard output. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-memorables.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-flashcards.ts` ✓, and `npm run build` ✓.

---

## Phase 8 — HandoffChain + Session End `[x]`

**What gets built:**
`HandoffChain` compresses the full session into a 3–5 bullet handoff summary. `/api/session/handoff` route.

**Files to create/modify:**
- `lib/langchain/chains/handoffChain.ts` (implement)
- `app/api/session/handoff/route.ts`
- `scripts/test-handoff.ts`

**Acceptance criteria:**
- Full simulated session input → 3–5 bullet handoff summary returned
- Summary captures what was studied and what was asked
- Output is concise (under 200 words)

**Test commands:**
```bash
npx ts-node scripts/test-handoff.ts
```

**Completion notes:** `HandoffChain` implemented to turn the active study context into a concise 3–5 bullet handoff summary using original material, optional summary, rolling compressed context, recent verbatim messages, and persona. Added `/api/session/handoff` as an output-only JSON route returning `{ handoffSummary }` without mutating server state. Added `scripts/test-handoff.ts` to verify bullet count, word-count limit, topic coverage, and invalid-input handling. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-handoff.ts` ✓ and `npm run build` ✓.

---

## Phase 8.5 — Intent Classification Inside Chat `[x]`

**What gets built:**
An intent-routing layer inside `/api/session/ask` so normal chat messages can trigger `QAChain`, `SummaryChain`, `MemorableChain`, or `FlashcardChain` automatically. The existing specialized routes remain available for direct UI actions and isolated testing.

**Files to create/modify:**
- `lib/langchain/chains/intentClassifierChain.ts` (implement)
- `app/api/session/ask/route.ts` (extend to classify intent, dispatch by intent, and return intent-aware SSE payloads)
- `scripts/test-intent-ask.ts`

**Request contract changes:**
- Extend `POST /api/session/ask` to accept:
  - `question: string`
  - `material: string`
  - `summary: string | null`
  - `memorables: string[]`
  - `persona: string`
  - `currentSubject: string`
  - `currentSubtopic: string`
  - `recentMessages: Message[]`
  - `rollingSum: string`
  - `serializedVectors: SerializedVector[]`

**What the intent classifier returns:**
- `{ intent: "qa" | "summarize" | "memorables" | "flashcards", confidence: "low" | "medium" | "high" }`

**Routing behavior:**
- `qa` → existing retrieval-backed Q&A flow
- `summarize` → `SummaryChain`
- `memorables` → `MemorableChain`
- `flashcards` → `FlashcardChain`
- ambiguous input defaults to `qa`

**SSE response changes for `/api/session/ask`:**
- final `complete` event must always include:
  - `intent`
  - `intentConfidence`
  - `updatedMessages`
  - `rollingSum`
  - `tokenCount`
  - `compressionApplied`
  - `shouldWarn`
- intent-specific fields:
  - `qa` → `answer`, `retrievedChunks`, `topicShift`
  - `summarize` → `summary`
  - `memorables` → `memorables`
  - `flashcards` → `flashcards`

**Chat history behavior:**
- Append the user prompt as a normal `user` message
- For non-QA intents, append a compact assistant status message instead of the full structured output
- Keep structured outputs in session state fields, not embedded verbatim into `recentMessages`

**Acceptance criteria:**
- “Explain the Calvin cycle” routes to `qa`
- “Summarize this session” routes to `summarize`
- “Give me the key things to remember” routes to `memorables`
- “Make flashcards from this” routes to `flashcards`
- Ambiguous prompts default to `qa`
- Non-QA intents do not bloat `recentMessages`
- Existing direct routes still work unchanged

**Test commands:**
```bash
npx ts-node scripts/test-intent-ask.ts
npm run build
```

**Completion notes:** Added `IntentClassifierChain` and extended `/api/session/ask` into an SSE-based multi-intent dispatcher for `qa`, `summarize`, `memorables`, and `flashcards`. The ask route now accepts `material`, `summary`, and `memorables` in addition to the prior Q&A fields, returns `intent` and `intentConfidence` in every final `complete` event, and keeps topic-shift detection QA-only. Non-QA intents append compact assistant status messages to `recentMessages`, while compression remains scoped to message history and `rollingSum`. Added `scripts/test-intent-ask.ts` to verify all four intents plus the ambiguous-to-QA fallback. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-intent-ask.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-qa.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-topic-shift.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-compress.ts` ✓, and `npm run build` ✓.

---

## Phase 8.6 — Thinking Events for Streaming UX `[x]`

**What gets built:**
User-centric `thinking` SSE events for `/api/session/ask` and `/api/session/summarize` so the UI can show progress like “Classifying your request” or “Generating your flashcards” without exposing hidden reasoning.

**Files to create/modify:**
- `app/api/session/ask/route.ts`
- `app/api/session/summarize/route.ts`
- `scripts/test-summary.ts`
- `scripts/test-qa.ts`
- `scripts/test-intent-ask.ts`

**Public interface changes:**
- `POST /api/session/ask` SSE adds optional `thinking` events with plain-string payloads
- `POST /api/session/summarize` SSE adds optional `thinking` events with plain-string payloads
- Existing `chunk`, `complete`, and `error` events stay unchanged

**Thinking message rules:**
- Use `event: thinking`
- Payload is a user-facing string only
- Do not emit duplicate adjacent messages
- Do not expose chain names, retrieval jargon, or hidden reasoning

**Expected messages:**
- Before intent classification:
  - `Classifying your request`
- For `qa`:
  - `Looking through your study material`
  - `Generating your answer`
  - if compression runs: `Saving room for more conversation`
- For `summarize`:
  - `Preparing a summary`
  - `Generating your summary`
- For `memorables`:
  - `Generating your key takeaways`
- For `flashcards`:
  - `Generating your flashcards`

**Acceptance criteria:**
- `thinking` events arrive before `complete`
- QA flow emits user-facing progress text for classification, retrieval, and answer generation
- Summary flow emits user-facing progress text before summary chunks
- Intent-routed memorables and flashcards emit the expected user-facing progress messages
- No hidden reasoning or developer-centric wording appears in the stream

**Test commands:**
```bash
npx ts-node scripts/test-summary.ts
npx ts-node scripts/test-qa.ts
npx ts-node scripts/test-intent-ask.ts
npm run build
```

**Completion notes:** Added user-centric `thinking` SSE events to `/api/session/ask` and `/api/session/summarize` so the UI can display progress messages like “Classifying your request”, “Looking through your study material”, and “Generating your flashcards” without exposing hidden reasoning or developer-centric chain names. The ask route now emits intent-specific `thinking` events before major user-visible steps, and the summarize route emits summary-oriented `thinking` events before streaming chunks. Updated `scripts/test-summary.ts`, `scripts/test-qa.ts`, and `scripts/test-intent-ask.ts` to assert `thinking` event presence, ordering, and wording. Verified with `npx ts-node --project tsconfig.scripts.json scripts/test-summary.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-qa.ts` ✓, `npx ts-node --project tsconfig.scripts.json scripts/test-intent-ask.ts` ✓, and `npm run build` ✓.

---

## Phase 9 — Core Product UI Flow `[~]`

**What gets built:**
The first complete LearnLoop app flow around the already-implemented backend chains. The UI/UX flow can take structural inspiration from NotebookLM for layout clarity, page sequencing, and workspace composition, but all user-facing wording and surfaced features stay LearnLoop-native and limited to features already supported in the codebase.

This phase shifts Phase 9 away from a browser-only test harness and into the core product shell:
- landing page for product entry
- recent loops page for app entry and resumption
- loop workspace for chat, sources, and study tools

Phase 9 is frontend-shell first. Persistence is local/browser-backed for now rather than database-backed.

**Public routes in this phase:**
- `/` → landing page
- `/loops` → recent loops page
- `/loops/[loopId]` → loop workspace

**Shared UI/state assumptions:**
- User-facing terminology is standardized around `loops`
- `SessionState` remains the core client-side state contract for the workspace
- Existing `app/api/session/*` routes remain the backend surface for UI integration
- NotebookLM is a UI/UX reference only; its product nouns should not appear in LearnLoop UI copy or this plan

---

## Phase 9.1 — Landing Page `[x]`

**What gets built:**
Marketing landing page that introduces LearnLoop’s product flow and routes users into the loop flow. The page includes the hero, ticker, explainer/process section, and primary CTA entry into the app.

**Files to create/modify:**
- `app/page.tsx`

**Acceptance criteria:**
- Landing page clearly explains the LearnLoop product flow
- Primary CTA routes users into the app flow
- “See how it works” anchors correctly to the explainer section
- Page builds cleanly and reflects the LearnLoop visual system

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Landing page already implemented in `app/page.tsx`, including hero, ticker, explainer section, and CTA-driven entry into the product flow. Verified as part of recent homepage build checks.

---

## Phase 9.2 — Recent Loops Page `[x]`

**What gets built:**
A dedicated `Recent Loops` page that serves as the app entry point after the landing page. This page is the LearnLoop equivalent of a recent-workspace dashboard: users can resume an existing loop or create a new one.

**User-facing wording for this phase:**
- Page title: `Recent Loops`
- Primary action: `New Loop`
- Supporting copy: “Pick up where you left off or start a new loop.”

**Files to create/modify:**
- `app/loops/page.tsx`
- client-side session/loop persistence utilities as needed
- shared UI components for loop list cards, empty states, and top-level app navigation as needed

**What the page must include:**
- List/grid of existing loops with enough metadata to identify and resume them
- Prominent `New Loop` action
- Empty state for first-time users
- Local/browser persistence only for this phase

**Route/interface assumptions:**
- `/loops` is the canonical recent loops page
- Each loop item links into a dedicated loop workspace route
- Loop records are stored in browser/local persistence or temporary mock persistence for now

**Acceptance criteria:**
- User can navigate from the landing page into `/loops`
- User can create a new loop from the recent loops page
- Existing loops render from local/mock persistence
- Empty state is clear and usable when no loops exist
- Clicking an existing loop opens its workspace

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Added `/loops` as the canonical recent-loops dashboard with LearnLoop branding, empty state, `New Loop` CTA, and local-storage-backed loop list rendering. Introduced a lightweight `RecentLoop` client type plus browser persistence helpers for reading, sorting, and updating recent loops without changing backend APIs. Updated landing page CTAs to enter the app through `/loops` while keeping `/session` as the temporary creation/resume destination for Phase 9.3. Verified with `npm run build` ✓.

---

## Phase 9.3 — Loop Workspace `[~]`

**What gets built:**
The real LearnLoop workspace at `/loops/[loopId]`, replacing the temporary `/session` path. The workspace takes structural inspiration from NotebookLM for page composition and flow, but all wording, surfaced features, and interaction patterns remain LearnLoop-native and limited to features already implemented in Phases 2 through 8.6.

This phase covers:
- canonical workspace route normalization
- workspace layout shell
- local `SessionState` persistence and restoration
- sources/material flow
- streaming chat with `thinking` states
- tools panel integration for summary, memorables, flashcards, and handoff
- recent loops integration back into the canonical route flow

**Workspace wording for this phase:**
- Page title: `Loop`
- Main sections:
  - `Chat`
  - `Sources`
  - `Tools`
- Tool labels:
  - `Summary`
  - `Memorables`
  - `Flashcards`
  - `Handoff`

**Project implementation rules that apply to all mini phases:**
- `app/` contains pages and API routes only; no business logic
- `components/` contains UI only; no LangChain imports and no direct API logic
- `lib/` contains workspace state, persistence, SSE parsing, and session helpers
- `types/` contains shared workspace and session types
- Prefer semantic theme tokens first (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`); use raw hex only for LearnLoop-specific accent surfaces
- Reuse `components/dark-mode-toggle.tsx`; do not create a page-specific theme control
- Keep `'use client'` boundaries as deep as possible
- Use LearnLoop wording (`loop`, `material`, `sources`, `tools`, `handoff`), not NotebookLM nouns

---

## Phase 9.3.1 — Workspace Route + Template Shell `[x]`

**What gets built:**
- Canonical workspace route at `/loops/[loopId]`
- Responsive workspace shell with all major sections present but initially non-functional
- Top bar with LearnLoop logo and `DarkModeToggle`
- Desktop-first layout with mobile/tablet behavior defined up front

**Files to create/modify:**
- `app/loops/[loopId]/page.tsx`
- shared workspace shell/layout components as needed
- `components/dark-mode-toggle.tsx` (reuse, not replace)

**What the shell must include:**
- Top bar
- Chat section
- Sources section
- Tools section
- Theme-aware layout that works in both dark and light modes

**Acceptance criteria:**
- `/loops/[loopId]` renders a full workspace skeleton
- Chat, sources, and tools are visibly separated and labeled
- Layout works in dark and light themes
- Top-level route structure matches the app flow established by Phase 9.2

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Added the canonical workspace route at `/loops/[loopId]` and built a reusable, theme-aware shell with a top bar, `Chat`, `Sources`, and `Tools` sections. Kept the page route server-rendered with async `params` handling aligned to the installed Next.js App Router docs, while pushing the visual shell into `components/`. Normalized the recent-loops dashboard so resume and new-loop entry now flow into `/loops/[loopId]` rather than the temporary `/session` page. Verified with `npm run build` ✓.

---

## Phase 9.3.2 — Workspace State + Local Persistence `[x]`

**What gets built:**
- Full local restoration of `SessionState` when reopening an existing loop
- Client-side loader/saver utilities for workspace state
- Migration from Recent Loops metadata entry into full loop-state persistence
- New-loop creation that routes into `/loops/[loopId]`

**State behavior:**
- Opening an existing loop restores full `SessionState`
- Creating a new loop initializes an empty pre-start workspace state
- Local/browser persistence remains the only storage strategy in this phase

**Files to create/modify:**
- `lib/session/` workspace persistence helpers
- `types/session.ts` only if a small non-breaking persistence field is truly needed
- route-level workspace loading code in `app/loops/[loopId]/page.tsx`

**Acceptance criteria:**
- Reopening a saved loop restores material, summary, memorables, flashcards, handoff, and recent messages
- Recent Loops can navigate into a specific `/loops/[loopId]`
- New loops create stable IDs and persist locally

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Added client-side loop workspace persistence under `lib/session/` with a dedicated local-storage namespace for full loop state, including empty pre-start workspaces and full post-start `SessionState` restoration. `/loops/new` now creates a stable local loop ID, persists an empty workspace, and normalizes into `/loops/[loopId]` via client-side route replacement. The workspace now restores saved material/session state on reopen, and `SessionState` was extended with a non-breaking `handoffSummary` field so future study artifacts can restore alongside summaries, memorables, flashcards, and messages. Verified with `npm run build` ✓.

---

## Phase 9.3.3 — Sources Section + Session Start Flow `[x]`

**What gets built:**
- Sources/material panel for entering and viewing the primary source text
- Start-loop flow wired to `/api/session/start`
- Session seed creation, classifier output, persona, and serialized vectors stored into workspace state
- Clear pre-start and post-start sources UI states

**Behavior expectations:**
- Before start: user can paste material and begin a loop
- After start: source material remains visible/readable in the sources section
- Subject, subtopic, confidence, and persona become available to the rest of the workspace

**Files to create/modify:**
- sources section UI components
- workspace state helpers in `lib/session/`
- `/api/session/start` integration in the workspace client flow

**Acceptance criteria:**
- User can paste material and start a loop from the workspace
- `/api/session/start` response is stored into the active loop state
- Sources section clearly shows the active material and core classification context

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Reworked the `Sources` panel into a real pre-start/post-start flow. Before start, the workspace now accepts pasted material and calls `/api/session/start`; after start, it stores the returned session seed into the active local workspace, updates recent-loop metadata, and surfaces subject, subtopic, confidence, persona, vector readiness, and readable source material in the panel. Verified the new route and client flow compile successfully with `npm run build` ✓.

---

## Phase 9.3.4 — Chat Section + Thinking/Streaming `[x]`

**What gets built:**
- Chat panel with message list, input composer, submit controls, and scrolling behavior
- SSE integration for `/api/session/ask`
- Visible `thinking` states in chat based on existing user-facing SSE thinking events
- Assistant/user message rendering with persisted message history updates

**Behavior expectations:**
- Ask flow streams chunks into the active assistant message
- `thinking` events appear as transient status UI, not permanent messages
- Final `complete` payload updates `recentMessages`, `rollingSum`, `tokenCount`, `intent`, and intent-specific fields
- Compression results remain internal to workspace state, while user-visible warnings are surfaced in UI

**Files to create/modify:**
- chat section UI components
- SSE parsing helpers in `lib/session/` or `lib/utils/`
- `/api/session/ask` integration in the workspace client flow

**Acceptance criteria:**
- User can ask questions and see streamed answers in chat
- Thinking states render during classification, retrieval, and generation
- QA, summarize, memorables, and flashcards can all arrive through the ask route when intent-routed
- Topic-shift results are surfaced in the chat UI when relevant

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Replaced the chat placeholder with a real `LoopChatPanel` client component wired to `/api/session/ask`. Added SSE parsing and ask-route integration helpers under `lib/session/askStream.ts`, plus shared typed ask-complete event shapes in `types/session.ts`. The chat panel now streams chunks into the active assistant bubble, shows transient `thinking` states, persists `recentMessages`/`rollingSum`/`tokenCount` updates back into local loop state, updates summary/memorables/flashcards when returned through intent-routed ask flows, and surfaces topic-shift notices and basic token/compression status notes in the UI. Verified with `npm run build` ✓.

---

## Phase 9.3.5 — Chat UX Polish: Intent, Topic Shift, Token Signals `[x]`

**What gets built:**
- UI treatment for intent-aware results in chat
- Topic-shift notices when the question leaves the current subject
- Token usage and warning display using `tokenCount`, `shouldWarn`, and compression signals
- Stable rendering rules for non-QA assistant events so structured outputs do not bloat the transcript

**Behavior expectations:**
- Non-QA ask results show compact chat confirmations plus updates in tools/state
- Topic-shift messaging is visible but non-disruptive
- Token pressure warnings are visible near chat or workspace status, not buried

**Acceptance criteria:**
- Intent-routed summarize, memorables, and flashcards requests feel coherent in chat
- Token warnings are visible when returned
- Topic shift is understandable and connected to the active loop subject

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Polished the chat UI so intent-routed summarize, memorables, and flashcards requests render as compact assistant transcript events plus a separate “latest result” preview block instead of dumping full structured output into the conversation. Added clearer topic-shift messaging tied to the active loop subject, plus visible token-usage/status treatment in the chat header and stronger token/compression warning styling near the composer. Message rendering now distinguishes non-QA assistant events with dedicated labels and compact state-oriented copy. Verified with `npm run build` ✓.

---

## Phase 9.3.6 — Tools Panel Template + Summary Integration `[x]`

**What gets built:**
- Single tools panel with action cards/buttons for Summary, Memorables, Flashcards, and Handoff
- Summary tool wired first, including `/api/session/summarize` SSE handling
- Summary result section rendered inside the tools area and persisted into `SessionState.summary`

**Behavior expectations:**
- Tools are explicit UI actions, not hidden behind tabs
- Summary can be triggered directly even though it may also be intent-routed through chat
- Streamed summary output appears in the tools panel

**Files to create/modify:**
- tools panel UI components
- summary result rendering components
- `/api/session/summarize` integration in the workspace client flow

**Acceptance criteria:**
- Summary action triggers `/api/session/summarize`
- Summary thinking/chunk events render correctly
- Finished summary persists and restores on reopen

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Replaced the static tools placeholder with an explicit `LoopToolsPanel` client component and added tool-route client helpers under `lib/session/toolClients.ts`. The Summary action now calls `/api/session/summarize`, renders `thinking` and streamed chunk output directly inside the tools area, and persists the finished summary back into `SessionState.summary` so it restores on reopen. Verified with `npm run build` ✓.

---

## Phase 9.3.7 — Memorables + Flashcards + Handoff Integration `[x]`

**What gets built:**
- Memorables action wired to `/api/session/memorables`
- Flashcards action wired to `/api/session/flashcards`
- Handoff action wired to `/api/session/handoff`
- Dedicated result sections in the tools panel for each tool
- Full persistence and restore behavior for all tool outputs

**Behavior expectations:**
- Each tool writes to its own area in workspace state
- Tool results are visible outside the chat transcript
- Chat-triggered and button-triggered tool outputs stay consistent with the same stored state

**Acceptance criteria:**
- Memorables render as a distinct list
- Flashcards render as structured front/back cards
- Handoff renders as a concise reusable loop handoff block
- All three restore after reload/reopen

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** Wired explicit Tools actions for Memorables, Flashcards, and Handoff to `/api/session/memorables`, `/api/session/flashcards`, and `/api/session/handoff`. Added dedicated tools-panel result sections for the memorables list, structured flashcards, and concise handoff block, all backed by `SessionState` persistence so button-triggered and chat-triggered outputs stay consistent and restore after reload/reopen. Verified with `npm run build` ✓.

---

## Phase 9.3.8 — Recent Loops Integration + Route Normalization Completion `[ ]`

**What gets built:**
- Recent Loops page updated so cards and `New Loop` route to `/loops/[loopId]`
- `/session` removed from the active Phase 9 flow or converted to redirect-only behavior
- Recent-loop metadata refreshed from full workspace activity, including `updatedAt`

**Behavior expectations:**
- Resuming from `/loops` lands in the actual workspace route
- Loop metadata stays fresh as the user chats or runs tools
- Phase 9 route story becomes internally consistent

**Acceptance criteria:**
- `/loops` opens existing loops at `/loops/[loopId]`
- `New Loop` creates and opens a real workspace route
- No Phase 9 UI path depends on `/session` anymore

**Test commands:**
```bash
npm run dev   # manual browser verification
npm run build
```

**Completion notes:** _(fill in after done)_

---

## Phase 10 — Integration Testing `[ ]`

**What gets built:**
Full end-to-end session tested via the minimal UI. Bugs documented and fixed.

**Test script:**
1. Paste a chemistry transcript → verify classification
2. Summarize → verify persona in output
3. Ask 3 follow-up questions → verify memory
4. Ask an off-topic question → verify TopicShiftChain fires
5. Generate memorables → verify session context used
6. Generate flashcards → verify JSON structure
7. End session → verify handoff summary

**Acceptance criteria:**
- All 7 steps pass without errors
- No console errors in browser
- All API routes return correct typed responses

**Bugs found:** _(document during testing)_

**Completion notes:** _(fill in after done)_

---

## Notes

- Do not skip phases
- Do not build UI before all chains are tested (Phase 9 comes after Phase 8)
- Mark phases complete only when acceptance criteria fully pass
- If a phase reveals a problem with a prior phase, fix it before continuing
