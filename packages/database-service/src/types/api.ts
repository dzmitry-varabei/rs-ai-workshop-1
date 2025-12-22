/**
 * Database Service API Types
 * 
 * These types define the HTTP API contract between the database service
 * and client applications (web app, telegram bot).
 */

import { z } from 'zod';
import type { WordId, UserId, WordStatus, SrsDifficulty } from '@english-learning/domain';

// Request/Response schemas for validation
export const GetRandomWordsRequestSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
});

export const MarkWordRequestSchema = z.object({
  userId: z.string().uuid(),
  wordId: z.string().uuid(),
});

export const GetUserStatsRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const GetDueWordsRequestSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const RecordReviewRequestSchema = z.object({
  userId: z.string().uuid(),
  wordId: z.string().uuid(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'very_hard']),
});

// API Response types
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
  difficultyLast: SrsDifficulty | null;
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

// API Error response
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// Type inference helpers
export type GetRandomWordsRequest = z.infer<typeof GetRandomWordsRequestSchema>;
export type MarkWordRequest = z.infer<typeof MarkWordRequestSchema>;
export type GetUserStatsRequest = z.infer<typeof GetUserStatsRequestSchema>;
export type GetDueWordsRequest = z.infer<typeof GetDueWordsRequestSchema>;
export type RecordReviewRequest = z.infer<typeof RecordReviewRequestSchema>;