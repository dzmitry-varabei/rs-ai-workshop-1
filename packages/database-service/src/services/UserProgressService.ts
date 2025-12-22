/**
 * User Progress Service
 * 
 * Business logic for user word progress and quiz statistics.
 */

import type { UserWordStateRepository } from '@english-learning/domain';
import type { UserStatsResponse } from '../types/api.js';

export class UserProgressService {
  constructor(private userWordStateRepository: UserWordStateRepository) {}

  async markWordKnown(userId: string, wordId: string): Promise<void> {
    await this.userWordStateRepository.markKnown(userId as any, wordId as any);
  }

  async markWordUnknown(userId: string, wordId: string): Promise<void> {
    await this.userWordStateRepository.markUnknown(userId as any, wordId as any);
  }

  async getUserStats(userId: string): Promise<UserStatsResponse> {
    const stats = await this.userWordStateRepository.getStats(userId as any);
    
    return {
      totalSeen: stats.totalSeen,
      known: stats.known,
      unknown: stats.unknown,
      learning: stats.learning,
      knowledgePercentage: stats.knowledgePercentage,
    };
  }

  async getWordStatus(userId: string, wordId: string) {
    return this.userWordStateRepository.getStatus(userId as any, wordId as any);
  }

  async resetProgress(userId: string): Promise<void> {
    await this.userWordStateRepository.resetProgress(userId as any);
  }

  async getWordIdsByStatus(userId: string, status: 'known' | 'unknown' | 'learning') {
    return this.userWordStateRepository.getWordIdsByStatus(userId as any, status);
  }
}