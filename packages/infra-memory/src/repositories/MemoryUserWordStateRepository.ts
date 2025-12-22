/**
 * In-memory implementation of UserWordStateRepository
 */

import type { 
  UserWordStateRepository, 
  UserWordStats,
  UserId, 
  WordId, 
  WordStatus 
} from '@english-learning/domain';

interface UserWordState {
  userId: UserId;
  wordId: WordId;
  status: WordStatus;
  lastSeenAt: Date;
  seenCount: number;
}

export class MemoryUserWordStateRepository implements UserWordStateRepository {
  private states: Map<string, UserWordState> = new Map();

  private getKey(userId: UserId, wordId: WordId): string {
    return `${userId}:${wordId}`;
  }

  async markKnown(userId: UserId, wordId: WordId): Promise<void> {
    const key = this.getKey(userId, wordId);
    const existing = this.states.get(key);
    
    this.states.set(key, {
      userId,
      wordId,
      status: 'known',
      lastSeenAt: new Date(),
      seenCount: (existing?.seenCount || 0) + 1,
    });
  }

  async markUnknown(userId: UserId, wordId: WordId): Promise<void> {
    const key = this.getKey(userId, wordId);
    const existing = this.states.get(key);
    
    this.states.set(key, {
      userId,
      wordId,
      status: 'unknown',
      lastSeenAt: new Date(),
      seenCount: (existing?.seenCount || 0) + 1,
    });
  }

  async getStats(userId: UserId): Promise<UserWordStats> {
    const userStates = Array.from(this.states.values())
      .filter(state => state.userId === userId);

    const totalSeen = userStates.length;
    const known = userStates.filter(s => s.status === 'known').length;
    const unknown = userStates.filter(s => s.status === 'unknown').length;
    const learning = userStates.filter(s => s.status === 'learning').length;
    
    const knowledgePercentage = totalSeen > 0 ? Math.round((known / totalSeen) * 100) : 0;

    return {
      totalSeen,
      known,
      unknown,
      learning,
      knowledgePercentage,
    };
  }

  async getStatus(userId: UserId, wordId: WordId): Promise<WordStatus | null> {
    const key = this.getKey(userId, wordId);
    const state = this.states.get(key);
    return state?.status || null;
  }

  async resetProgress(userId: UserId): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, state] of this.states.entries()) {
      if (state.userId === userId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.states.delete(key));
  }

  async getWordIdsByStatus(userId: UserId, status: WordStatus): Promise<WordId[]> {
    return Array.from(this.states.values())
      .filter(state => state.userId === userId && state.status === status)
      .map(state => state.wordId);
  }

  // Additional methods for testing
  clear(): void {
    this.states.clear();
  }

  getUserStates(userId: UserId): UserWordState[] {
    return Array.from(this.states.values())
      .filter(state => state.userId === userId);
  }
}