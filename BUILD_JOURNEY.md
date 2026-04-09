# LearnLoop Build Journey

> **Intent of this document:** This file records the reasoning, tradeoffs, questions, answers, and implementation decisions made while building LearnLoop. Future agent models should use this as a project-memory document to understand why the code looks the way it does, what assumptions were made, which questions were already resolved, and how the architecture evolved from the PRD into the actual implementation.

---

## What This Document Is For

This is not the product spec.

The PRD in [`learnloop-prd.md`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/learnloop-prd.md) explains what LearnLoop is supposed to become.

The execution checklist in [`EXECUTION_PLAN.md`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/EXECUTION_PLAN.md) explains which phase is being built and what is complete.

This document explains the journey:
- what was brainstormed
- what questions came up during implementation
- what answers were chosen
- why those answers were correct for this repo and environment

---

## Project Direction

LearnLoop is being built as an AI-powered study assistant that turns raw study material into a structured learning session. The intended experience is:
- user pastes material
- app detects the subject and subtopic
- app creates an expert persona for that session
- later study actions reuse that session context

The architecture chosen from the beginning is stateless server-side + persistent client-side session state:
- server routes do work and return updated state
- browser stores state in `localStorage`
- later requests send the needed state back to the server

This architectural decision drives many of the implementation choices below.

---

## Early Brainstorming Themes

### 1. Stateless serverless pattern

One of the most important early ideas was that the app should work well with Next.js serverless routes on Vercel. That means server memory cannot be treated as durable session state.

Key implication:
- every route should behave like a pure function over request data

That led to the session shape in [`types/session.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/types/session.ts) and to the decision to serialize retriever state instead of trying to keep it alive on the server.

### 2. Session initialization as a real pipeline

The start of a session is not just “save raw material.” It needs to establish the full context that later features depend on:
- classification
- persona
- serialized retrieval data
- initial session defaults

That is why Phase 2 was implemented as a real initialization pipeline rather than a thin input endpoint.

### 3. Full session seed instead of partial route output

There was a product and engineering decision to make: should `/api/session/start` return only the raw outputs from chains, or should it return the full `SessionState` object that the client can store directly?

The chosen answer was:
- return a full client-ready session seed

Reason:
- avoids client-side adapter logic later
- makes Phase 9 UI simpler
- keeps the route aligned with the PRD’s browser-owned-state model

This is implemented in [`app/api/session/start/route.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/app/api/session/start/route.ts) and [`lib/session/createSessionSeed.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/session/createSessionSeed.ts).

---

## Questions Asked During the Build

## Q1. Why not use `DocArrayInMemorySearch`?

### Context

The PRD originally referenced `DocArrayInMemorySearch` as the retriever implementation.

### What was checked

The actual installed packages in this repo were inspected:
- `@langchain/openai`
- `@langchain/core`
- `@langchain/community`
- `langchain`

The installed runtime surface exposed `MemoryVectorStore`, but `DocArrayInMemorySearch` was not available in the current dependency set.

### Answer

`DocArrayInMemorySearch` was not used because it is not present in the installed LangChain packages for this project.

### Decision

Use `MemoryVectorStore` as the forward-compatible in-memory retriever target for later phases.

### Why this was the correct decision

- it matches the actual dependency graph
- it avoids planning around a class that does not exist in the environment
- it preserves the same product behavior: in-memory semantic retrieval rebuilt from serialized vectors

### Repo impact

This changed implementation direction, not product direction.

The execution plan was updated so future phases build toward `MemoryVectorStore` reconstruction instead of `DocArrayInMemorySearch`.

---

## Q2. How is `MemoryVectorStore` different from `DocArrayInMemorySearch`?

### Answer

Both are in-memory semantic retrieval options, but for this project the important difference is practical:
- `MemoryVectorStore` is available in the installed LangChain version
- `DocArrayInMemorySearch` is not

For LearnLoop, the user-facing need is not tied to one exact class. The real requirement is:
- chunk material
- embed chunks
- preserve enough data to rebuild retrieval state later

So the critical persisted data is:
- `pageContent`
- `metadata`
- `embedding`

That is why the `SerializedVector` type exists and why the Phase 2 response includes serialized vectors.

---

## Q3. If `MemoryVectorStore` is in-memory, why return chunk text, metadata, and embeddings to the client?

### Answer

Yes, that is exactly why.

`MemoryVectorStore` only lives in memory while the route is running. Once the request ends, the in-memory store is gone.

Because LearnLoop is intentionally stateless on the server:
- the server cannot be the durable owner of retrieval state
- the browser must persist the retriever inputs

So the route returns serialized vectors and the client stores them in `localStorage`. On future requests, the client can send them back and the server can reconstruct a retriever for that request.

This is the core persistence model for LearnLoop’s session memory.

---

## Q4. Why did the route return a full `SessionState` instead of only chain outputs?

### Answer

Returning only chain outputs would have left the client responsible for assembling the rest of the session state.

That would create duplicated logic and future UI coupling. Returning a full `SessionState` seed keeps the API aligned with the app’s state model.

### Decision

`POST /api/session/start` returns:
- classifier output
- persona
- serialized vectors
- generated `sessionId`
- initialized default fields like `summary`, `memorables`, `flashcards`, `recentMessages`, and `rollingSum`
- estimated `tokenCount`

This makes the response directly storable.

---

## Q5. Why was a dedicated `createSessionSeed()` helper added?

### Answer

The route could have built the session object inline, but that would have mixed:
- request parsing
- chain execution
- session-state construction

The helper was added to keep session construction explicit and reusable.

### File

[`createSessionSeed.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/session/createSessionSeed.ts)

### Benefit

- cleaner route handler
- easier testing
- one place to evolve default session state later

---

## Questions That Came Up During Verification

## Q6. Why did the integration script need alias patching?

### Context

The route imports internal files using the repo alias form `@/...`, which works in Next.js.

The Phase 2 integration script runs through `ts-node`, not through Next’s runtime, so alias resolution was not automatically available there.

### Answer

The script patched module resolution at runtime so it could import the route and reuse the actual implementation rather than duplicating test-only logic.

### Why this matters

The integration script tests the real route path, not a separate hand-written harness.

File:
- [`scripts/test-session-start.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/scripts/test-session-start.ts)

---

## Q7. Why did the classifier prompt initially fail?

### Context

The first classifier prompt included a JSON example directly in the prompt text.

LangChain prompt templates treat `{...}` as variable placeholders.

### Answer

The JSON braces had to be escaped as `{{ ... }}` inside the prompt string.

### Lesson

When using `ChatPromptTemplate`, raw JSON examples inside prompt strings need escaped braces or LangChain will try to interpret them as template variables.

---

## Q8. Why did `npm run build` initially fail even though the code was correct?

### Context

The build attempted to fetch Google fonts used by `next/font`.

### Answer

The initial build failure was due to sandbox network restrictions, not a code defect.

After rerunning with network access, the build completed successfully.

### Lesson

Not every build failure in this repo is an implementation problem. Some are environment-related and need to be separated from actual regressions.

---

## What Was Implemented in Phase 2

### Chains and helpers

- [`classifierChain.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/langchain/chains/classifierChain.ts)
- [`personaBuilderChain.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/langchain/chains/personaBuilderChain.ts)
- [`vectorStore.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/langchain/vectorStore.ts)
- [`createSessionSeed.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/lib/session/createSessionSeed.ts)

### Route

- [`app/api/session/start/route.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/app/api/session/start/route.ts)

### Test harness

- [`scripts/test-session-start.ts`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/scripts/test-session-start.ts)

### Key behaviors

- validates non-empty material
- classifies subject and subtopic
- generates a two-sentence expert persona
- chunks and embeds material
- returns serialized vectors for later retrieval reconstruction
- returns a full `SessionState` seed ready for client persistence

---

## Verified Outcomes

The following were verified during implementation:
- chemistry-style input produced chemistry-related classification and persona
- software-engineering input produced a different classification and persona
- serialized vectors were returned and non-empty
- empty material returned `400`
- production build passed

The execution plan was updated to reflect:
- Phase 1 completion notes
- Phase 2 completion
- the shift from `DocArrayInMemorySearch` wording to `MemoryVectorStore` compatibility

---

## Practical Guidance For Future Agents

If you are continuing work on LearnLoop:

- treat [`learnloop-prd.md`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/learnloop-prd.md) as product intent
- treat [`EXECUTION_PLAN.md`](/Users/haris/Documents/AI%20Projects/LearnLoop%20AI/learnloop.ai/EXECUTION_PLAN.md) as phase status
- treat this file as implementation-memory and decision history

Important constraints already established:
- server routes are stateless by design
- browser persistence is part of the architecture, not a temporary workaround
- serialized vectors are intentionally returned so retrieval can be reconstructed per request
- `MemoryVectorStore` is the current retrieval target unless dependencies change
- `SessionState` is the primary client persistence shape

If future work revisits retrieval:
- only switch back to `DocArrayInMemorySearch` if the repo dependencies are intentionally changed and the new class is actually available
- preserve the serialized vector contract unless there is a strong migration reason

---

## Suggested Ongoing Use

As the project grows, add entries here when:
- a technical assumption changes
- the PRD and implementation diverge
- a major debugging lesson is learned
- a future agent would otherwise have to rediscover the same reasoning

This document should remain short enough to scan, but specific enough to prevent repeated confusion.
