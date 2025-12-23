/**
 * Database Client Types
 * 
 * Types for HTTP client communication with Database Service.
 */

// Re-export API types from database-service
export interface WordResponse {
  id: string;
  textEn: string;
  level?: string;
  exampleEn?: string;
  exampleRu?: string;
  tags: string[];
  pronunciations: Array<{
    locale: string;
    ipa?: string;
    audioUrl?: string;
  }>;
}

export interface UserStatsResponse {
  totalSeen: number;
  known: number;
  unknown: number;
  learning: number;
  knowledgePercentage: number;
}

export interface SrsItemResponse {
  userId: string;
  wordId: string;
  nextReviewAt: string; // ISO date string
  lastReviewAt: string | null;
  intervalMinutes: number;
  difficultyLast: 'easy' | 'medium' | 'hard' | 'very_hard' | null;
  reviewCount: number;
  active: boolean;
  word: WordResponse;
}

export interface SrsStatsResponse {
  total: number;
  active: number;
  due: number;
  reviewCount: number;
}

export interface LinkCodeResponse {
  code: string;
  expiresAt: string; // ISO date string
}

export interface TelegramConnectionResponse {
  isConnected: boolean;
  linkedAt?: string; // ISO date string
  telegramChatId?: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// Client configuration
export interface DatabaseClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}