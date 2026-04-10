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
  previousSessionSummary: string | null;
}

export interface Flashcard {
  front: string;
  back: string;
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
