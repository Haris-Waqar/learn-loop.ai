# LearnLoop — Product Requirements Document

> AI-powered study assistant that transforms raw learning material into structured knowledge through summarization, Q&A, key memorables, and flashcards — using a dynamic expert persona engine built on LangChain.

---

## 1. Project Overview

| Field | Detail |
|---|---|
| **Project Name** | LearnLoop |
| **Type** | Full-stack web application (no backend, no external DB) |
| **Purpose** | Turn any study material (transcript, notes, article) into an interactive study session with AI |
| **Portfolio Signal** | Demonstrates: LangChain Chains, Memory, Dynamic Prompt Construction, Structured Outputs, Stateless Serverless Patterns |
| **Stack** | Next.js (App Router), LangChain JS, OpenAI API, Tailwind CSS, shadcn/ui, Framer Motion |
| **Storage** | localStorage (client) + in-memory reconstruction per API call (server) |
| **Deployment** | Vercel — single command, no infra |
| **Upgrade Path** | v2 replaces chain router with a LangGraph agent after RAG Agents course |

---

## 2. The Core Problem

When studying, you often have raw material — a transcript, a set of notes, a dense article — but no efficient way to:
- Extract what actually matters
- Test your understanding interactively
- Generate revision aids (flashcards) from the same session context

Existing tools treat each action in isolation. LearnLoop chains them into a single stateful session where every output builds on what came before.

---

## 3. User Flow

```
1. User pastes study material
2. App runs ClassifierChain + PersonaBuilderChain (once, at session start)
3. Session header shows: detected subject, subtopic, active expert persona
4. User triggers study modes explicitly:
   [ Summarize ] [ Ask a Question ] [ Key Memorables ] [ Generate Flashcards ]
5. Every action is context-aware — memory carries forward
6. On every Q&A message: TopicShiftChain runs silently in parallel
7. If topic shift detected → modal prompt to continue or start new chat
8. If context window nearing limit → auto-compress old messages silently
9. On session end → offer compressed summary as seed for next session
```

---

## 4. Architecture

### 4.1 The Stateless Serverless Pattern

Next.js on Vercel uses serverless API routes — each request spins up a fresh instance. In-memory state does not persist between calls. The solution: **treat every API route as a pure function**. State lives in the browser, gets sent with every request, and is returned updated after every response.

```
Browser (localStorage)                  Next.js API Route (stateless)
──────────────────────                  ──────────────────────────────
sessionId                               
persona                 ─── request ──► Reconstruct DocArrayInMemorySearch
subject                                 from serialized vectors
serializedVectors       ◄── response ── Run chain
recentMessages          ─── request ──► Use recentMessages + rollingSum
rollingSum              ◄── response ── Return answer + updated state
```

The API route receives everything it needs, does its work, and returns the updated state. The client saves it. Fully stateless by design — the same pattern production serverless apps use.

### 4.2 LangChain Chain Map

```
Input Material (pasted text)
        │
        ▼
[SequentialChain: Session Init] — runs ONCE at session start
        │
        ├── [ClassifierChain]
        │   Prompt: "Identify the academic subject and subtopic.
        │   Return JSON: { subject, subtopic, confidence }"
        │   Output: { subject, subtopic, confidence }
        │
        └── [PersonaBuilderChain]
            Input: { subject, subtopic }
            Prompt: "Write a 2-sentence expert system prompt for a world-class
            specialist in {subject} / {subtopic}."
            Output: persona string → stored in localStorage, injected into all
            downstream chains as system prompt

        ┌─────────────────────────────────────────────────┐
        │  All chains below receive {persona} as system   │
        │  prompt. ClassifierChain never runs again       │
        │  unless TopicShiftChain detects a change.       │
        └─────────────────────────────────────────────────┘
        │
        ├── [SummaryChain]
        │   Input: { material, persona }
        │   Task: Summarize into 5–8 bullet points
        │   Output: summary string → stored in localStorage
        │
        ├── [QAChain] ← primary interaction chain
        │   Input: { question, persona, recentMessages, rollingSum, vectors }
        │   Retrieval: DocArrayInMemorySearch reconstructed from serialized vectors
        │              → similarity search → top 3 relevant chunks
        │   Context: rollingSum (compressed past) + recentMessages (last 6 verbatim)
        │   Output: answer string + updated recentMessages
        │
        ├── [MemorableChain]
        │   Input: { material, summary, recentMessages, rollingSum, persona }
        │   Task: Extract 5–7 key must-remember points
        │   Output: memorables string[] → stored in localStorage
        │
        ├── [FlashcardChain]
        │   Input: { material, summary, memorables, recentMessages, rollingSum, persona }
        │   Task: Generate 5–10 flashcards as structured JSON
        │   Output: [{ front: string, back: string }]
        │   Parser: StructuredOutputParser + ResponseSchema
        │
        ├── [TopicShiftChain] ← runs silently on every Q&A message
        │   Input: { currentSubject, currentSubtopic, userMessage }
        │   Prompt: "Is this message clearly about a different academic subject?
        │   Return JSON: { shifted: boolean, newSubject: string | null }"
        │   On shifted: true → trigger topic shift modal
        │
        └── [CompressorChain] ← runs automatically when token threshold hit
            Input: { oldestMessages[] }
            Task: Summarize into 2–3 sentences
            Output: summaryChunk → appended to rollingSum,
                    oldestMessages removed from recentMessages
```

### 4.3 localStorage State Shape

```javascript
{
  sessionId: "uuid-v4",
  subject: "Chemical Engineering",
  subtopic: "Process Simulation / ASPEN",
  persona: "You are a senior process engineer with 15+ years...",
  classifierRanOnce: true,
  material: "full raw transcript...",
  summary: "bullet point summary...",
  memorables: ["concept 1", "concept 2"],
  flashcards: [{ front: "...", back: "..." }],
  serializedVectors: [...],      // DocArrayInMemorySearch serialized to JSON
  recentMessages: [              // last 6 messages verbatim
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ],
  rollingSum: "Earlier in this session we discussed...",
  tokenCount: 1840,
  previousSessionSummary: null  // populated when carrying context into new chat
}
```

### 4.4 Session State Machine

```
[IDLE]
  → User pastes material + clicks "Start Session"

[INITIALISING]
  → SequentialChain: ClassifierChain → PersonaBuilderChain
  → Embed material → serialize vectors → store in localStorage
  → classifierRanOnce = true

[ACTIVE SESSION]
  → Every Q&A message:
      TopicShiftChain runs in parallel (silent)
      Token counter updates after response
  → tokenCount < 60%  → send recentMessages as-is
  → tokenCount 60–80% → CompressorChain runs on oldest 4 messages silently
  → tokenCount > 80%  → show context limit banner

[TOPIC SHIFT DETECTED]
  → Show modal:
    "Looks like you've moved to {newSubject}.
     Continue here or start a fresh session?"
    [ Continue Here ] [ Start New Chat ]
  → Continue Here:
      Re-run ClassifierChain + PersonaBuilderChain
      Re-embed or continue with existing vectors
      Insert divider in chat log: "── Topic changed to {newSubject} ──"
      Update localStorage: subject, subtopic, persona, vectors
  → Start New Chat:
      Run CompressorChain on full session → generate handoff summary
      Store in localStorage as previousSessionSummary
      Clear all other session state
      New session starts with previousSessionSummary injected as context

[CONTEXT LIMIT WARNING] (>80% tokens)
  → Show banner: "Session context is getting full."
  → Options: [ Auto-Summarise Earlier Context ] [ Start New Chat ]

[SESSION END]
  → User clicks "End Session"
  → Offer: "Save a summary of this session for your next chat?"
  → [ Yes, carry it forward ] [ No, clear everything ]
  → Clear localStorage session state
```

---

## 5. Features

### 5.1 Material Input
- Large text area for pasting transcripts, notes, or articles
- Word count + estimated token count display
- "Start Session" button — triggers ClassifierChain + embedding
- Orphan session check on load: if prior `sessionId` found with `classifierRanOnce: true`, offer to resume or clear

### 5.2 Session Header (post-classification)
- Detected subject badge (e.g., "Chemical Engineering")
- Detected subtopic badge (e.g., "Process Simulation / ASPEN")
- Active persona label (e.g., "Studying with: Senior Process Engineer")
- Confidence indicator (low / medium / high from ClassifierChain)
- Token usage bar — visual, updates after every message

### 5.3 Study Mode Panel
Four explicit action buttons, always visible during an active session:

| Button | Chain | Output |
|---|---|---|
| Summarize | SummaryChain | Bullet-point summary rendered in chat |
| Ask a Question | QAChain + DocArrayInMemorySearch | Conversational reply with retrieval |
| Key Memorables | MemorableChain | Numbered list of must-remember points |
| Generate Flashcards | FlashcardChain | Structured flashcard deck |

### 5.4 Chat / Output Panel
- Scrollable session log — all outputs in chronological order
- Each block labeled by type: Summary / Answer / Memorables / Flashcards
- Topic change dividers inline in the log
- Streaming responses for Q&A
- Copy button per output block

### 5.5 Topic Shift Modal
- Triggered when TopicShiftChain returns `shifted: true`
- Shows detected new subject
- Options: Continue Here (re-classify in place) or Start New Chat (with summary handoff)

### 5.6 Context Limit Banner
- Shown when token usage exceeds 80%
- Auto-summarise option (CompressorChain runs on oldest messages)
- Start new chat option (with summary handoff)

### 5.7 Flashcard Viewer
- Flip animation (front → back on click) via Framer Motion
- Previous / Next navigation
- Export as CSV (Anki-compatible)
- Cards are context-aware — generated from full session state, not just raw material

### 5.8 Session Handoff
- On session end or new chat: CompressorChain generates a 3–5 bullet handoff summary
- Shown as collapsible "Prior Session Context" block at top of new chat
- User can dismiss for a clean start

---

## 6. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Full-stack in one repo, API routes included |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| Animations | Framer Motion | Flashcard flip, transitions |
| LangChain | LangChain JS (langchain npm) | Same repo as frontend, deploys to Vercel |
| Vector Search | DocArrayInMemorySearch | In-memory, serializable, no external DB needed |
| Memory | Manual (localStorage) | Survives refresh, serializable, serverless-compatible |
| LLM | `gpt-4o-mini` | Cost-efficient across multiple chain calls per session |
| Output Parsing | StructuredOutputParser + ResponseSchema | Flashcards, Classifier, TopicShift all return JSON |
| Deployment | Vercel | Single command deploy, serverless API routes |

---

## 7. LangChain Concepts Demonstrated

| Concept | Where It Appears |
|---|---|
| `LLMChain` | SummaryChain, MemorableChain, FlashcardChain, TopicShiftChain, CompressorChain |
| `SequentialChain` | ClassifierChain → PersonaBuilderChain at session init |
| `RouterChain` pattern | API routes read user action, route to correct chain |
| `DocArrayInMemorySearch` | Embedded material chunks for Q&A retrieval |
| `StructuredOutputParser` + `ResponseSchema` | Classifier, TopicShift, Flashcards return typed JSON |
| `ChatPromptTemplate` | All chains use parameterized templates |
| Dynamic Prompt Construction | PersonaBuilder output injected as system prompt into all downstream chains |
| Manual Memory Management | Stateless serverless pattern — serialize/deserialize via localStorage |
| Context Window Management | Token counting + CompressorChain for rolling summarisation |

---

## 8. API Routes

```
POST /api/session/start
  Body:    { material: string }
  Returns: { sessionId, subject, subtopic, persona, confidence, serializedVectors }
  Chains:  ClassifierChain → PersonaBuilderChain → embed + serialize

POST /api/session/summarize
  Body:    { material, persona }
  Returns: { summary: string } (streamed)
  Chains:  SummaryChain

POST /api/session/ask
  Body:    { question, persona, recentMessages, rollingSum, serializedVectors }
  Returns: { answer, updatedMessages, topicShift: { shifted, newSubject } }
  Chains:  QAChain (retrieval via reconstructed DocArrayInMemorySearch)
           + TopicShiftChain (parallel, silent)

POST /api/session/compress
  Body:    { messagesToCompress: Message[] }
  Returns: { summaryChunk: string }
  Chains:  CompressorChain
  Trigger: Client calls this when tokenCount crosses 60% threshold

POST /api/session/memorables
  Body:    { material, summary, recentMessages, rollingSum, persona }
  Returns: { memorables: string[] }
  Chains:  MemorableChain

POST /api/session/flashcards
  Body:    { material, summary, memorables, recentMessages, rollingSum, persona }
  Returns: { flashcards: [{ front: string, back: string }] }
  Chains:  FlashcardChain

POST /api/session/handoff
  Body:    { material, summary, recentMessages, rollingSum, persona }
  Returns: { handoffSummary: string }
  Chains:  CompressorChain (full session → 3–5 bullet handoff)
  Trigger: User ends session or starts new chat after topic shift
```

---

## 9. Pages & Routes

```
/           → Landing page (material input, start session)
/session    → Active study session (all modes, chat log, modals)
```

Flashcard viewer renders as a modal over `/session` — no separate route needed.

---

## 10. Out of Scope for v1

- User authentication or saved session history
- PDF / file upload ← add after "Chat with Your Data" (swap DocArrayInMemorySearch for persistent Chroma + file loaders)
- Persistent vector store ← add after "Chat with Your Data" (Chroma or Pinecone)
- Agent-based autonomous mode ← add after "RAG Agents with LLMs" (replace router with LangGraph agent)
- Spaced repetition scheduling
- Cross-device session sync

---

## 11. v2 Upgrade Path (Post-RAG Agents Course)

Chain implementations stay identical. Only the orchestration layer changes:

**v1 — Explicit command routing:**
```
User clicks [ Generate Flashcards ]
  → API route checks action === "flashcards" → calls FlashcardChain
```

**v2 — LangGraph agent routing:**
```
User types "ok I think I've covered enough, let's test myself"
  → Agent reasons over session state + user intent
  → Agent decides: invoke FlashcardChain
  → Result returned — no button press needed
```

Portfolio story: *"v1 demonstrated chain composition and memory management. v2 replaced the router with a LangGraph agent — same chains, smarter orchestration."*

---

## 12. Portfolio Positioning

**What this demonstrates:**
- You understand when LangChain is justified — orchestration complexity, not just API wrapping
- You can compose multiple chains into a coherent, stateful product pipeline
- You understand the stateless serverless constraint and designed around it cleanly
- You implemented context window management — a real production concern
- You built something you actually use — authentic, not contrived

**Demo script (3 minutes):**
1. Paste a real transcript — your LangChain course notes work perfectly
2. Show session init: subject detected, expert persona assembled
3. Hit Summarize — show persona shaping the output
4. Ask 2–3 follow-up questions — show memory and retrieval working together
5. Ask something off-topic — trigger the topic shift modal live
6. Generate flashcards — show they reflect the Q&A, not just raw transcript
7. Show flip UI + CSV export

**One-liner for Upwork / portfolio:**
*"Study assistant that classifies your material, assembles a domain expert persona, and runs a context-aware multi-chain pipeline across summarization, retrieval Q&A, and flashcard generation — fully stateless, no backend required."*

---

## 13. Suggested Build Order

1. Set up Next.js + Tailwind + shadcn/ui
2. Build `/api/session/start` — ClassifierChain + PersonaBuilderChain + embedding + serialization
3. Wire session header UI — confirm subject, subtopic, persona render correctly
4. Build SummaryChain + `/api/session/summarize` — first end-to-end mode working
5. Build QAChain + `/api/session/ask` — add DocArrayInMemorySearch reconstruction
6. Add TopicShiftChain inside `/api/session/ask` — wire up topic shift modal
7. Add token counting client-side + `/api/session/compress` — CompressorChain
8. Build MemorableChain + FlashcardChain
9. Build flashcard flip UI (Framer Motion) + CSV export
10. Build `/api/session/handoff` — session summary on end / new chat
11. Polish: session log, copy buttons, context limit banner, orphan session check
12. Deploy to Vercel
13. Record demo
