export interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'summary' | 'answer' | 'memorable' | 'flashcard' | 'system';
  timestamp: number;
}

export interface SerializedVector {
  pageContent: string;
  metadata: Record<string, unknown>;
  embedding: number[];
}

export interface SessionState {
  sessionId: string;
  subject: string;
  subtopic: string;
  persona: string;
  confidence: 'low' | 'medium' | 'high';
  classifierRanOnce: boolean;
  material: string;
  summary: string | null;
  memorables: string[];
  flashcards: Flashcard[];
  serializedVectors: SerializedVector[];
  recentMessages: Message[];
  rollingSum: string;
  tokenCount: number;
  handoffSummary: string | null;
  previousSessionSummary: string | null;
}

export interface LoopWorkspaceState {
  loopId: string;
  materialDraft: string;
  sessionState: SessionState | null;
  createdAt: number;
  updatedAt: number;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface RecentLoop {
  loopId: string;
  title: string;
  subject: string;
  subtopic: string;
  updatedAt: number;
  sourceCount: number;
}

export type StudyIntent = 'qa' | 'summarize' | 'memorables' | 'flashcards';
export type IntentConfidence = 'low' | 'medium' | 'high';

export interface TopicShiftResult {
  shifted: boolean;
  newSubject: string | null;
}

export interface IntentClassificationResult {
  intent: StudyIntent;
  confidence: IntentConfidence;
}

export interface RetrievedChunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export interface AskCompleteEventBase {
  intent: StudyIntent;
  intentConfidence: IntentConfidence;
  updatedMessages: Message[];
  rollingSum: string;
  tokenCount: number;
  compressionApplied: boolean;
  shouldWarn: boolean;
}

export interface QaAskCompleteEvent extends AskCompleteEventBase {
  intent: 'qa';
  answer: string;
  retrievedChunks: RetrievedChunk[];
  topicShift: TopicShiftResult;
}

export interface SummarizeAskCompleteEvent extends AskCompleteEventBase {
  intent: 'summarize';
  summary: string;
}

export interface MemorablesAskCompleteEvent extends AskCompleteEventBase {
  intent: 'memorables';
  memorables: string[];
}

export interface FlashcardsAskCompleteEvent extends AskCompleteEventBase {
  intent: 'flashcards';
  flashcards: Flashcard[];
}

export type AskCompleteEvent =
  | QaAskCompleteEvent
  | SummarizeAskCompleteEvent
  | MemorablesAskCompleteEvent
  | FlashcardsAskCompleteEvent;

export interface ClassifierResult {
  subject: string;
  subtopic: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
