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

## Phase 5 — TopicShiftChain `[ ]`

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

**Completion notes:** _(fill in after done)_

---

## Phase 6 — CompressorChain `[ ]`

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

**Completion notes:** _(fill in after done)_

---

## Phase 7 — MemorableChain + FlashcardChain `[ ]`

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

**Completion notes:** _(fill in after done)_

---

## Phase 8 — HandoffChain + Session End `[ ]`

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

**Completion notes:** _(fill in after done)_

---

## Phase 9 — Minimal UI (Functional, Not Polished) `[ ]`

**What gets built:**
Bare-bones UI to test all chains through the browser without Postman. No animations, no polish.

**Files to create/modify:**
- `app/page.tsx` (material input + Start Session button)
- `app/session/page.tsx` (session info panel, mode buttons, Q&A input, output panel, token usage)
- Basic Tailwind layout only

**Acceptance criteria:**
- Full end-to-end session testable in browser
- All 4 study modes trigger and display output
- Topic shift detected and logged to output panel
- Token usage displayed

**Test commands:**
```bash
npm run dev  # manual browser test
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
