/**
 * Database Service API Types
 * 
 * These types define the HTTP API contract between the database service
 * and client applications (web app, telegram bot).
 */

import { z } from 'zod';
import type { WordId, UserId, WordStatus, SrsDifficulty } from '@english-learning/data-layer-domain';

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

export const UpdateProfileRequestSchema = z.object({
  timezone: z.string().optional(),
  dailyWordLimit: z.number().int().min(1).max(100).optional(),
  preferredWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM format
  preferredWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),   // HH:MM format
  paused: z.boolean().optional(),
});

export const GenerateLinkCodeRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const GetTelegramConnectionRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const DisconnectTelegramRequestSchema = z.object({
  userId: z.string().uuid(),
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

export interface UserProfileResponse {
  id: string;
  telegramChatId?: string;
  timezone: string;
  dailyWordLimit: number;
  preferredWindowStart: string; // HH:MM format
  preferredWindowEnd: string;   // HH:MM format
  paused: boolean;
}

export interface DeliveryWindowResponse {
  withinWindow: boolean;
  windowStart: string;
  windowEnd: string;
  userTimezone: string;
}

export interface DailyLimitResponse {
  hasReachedLimit: boolean;
  reviewsToday: number;
  dailyLimit: number;
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
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type GenerateLinkCodeRequest = z.infer<typeof GenerateLinkCodeRequestSchema>;
export type GetTelegramConnectionRequest = z.infer<typeof GetTelegramConnectionRequestSchema>;
export type DisconnectTelegramRequest = z.infer<typeof DisconnectTelegramRequestSchema>;