/**
 * Database Service HTTP Client
 * 
 * Provides typed HTTP client for interacting with Database Service API.
 */

import type {
  DatabaseClientConfig,
  WordResponse,
  UserStatsResponse,
  SrsItemResponse,
  SrsStatsResponse,
  LinkCodeResponse,
  TelegramConnectionResponse,
  ApiErrorResponse,
} from './types.js';

export class DatabaseClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: DatabaseClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error: ApiErrorResponse = await response.json() as ApiErrorResponse;
        throw new Error(`API Error: ${error.message}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  // Words API
  async getRandomWords(userId: string, limit: number = 10): Promise<WordResponse[]> {
    return this.request<WordResponse[]>(
      `/api/words/random?userId=${userId}&limit=${limit}`
    );
  }

  async getWordById(wordId: string): Promise<WordResponse> {
    return this.request<WordResponse>(`/api/words/${wordId}`);
  }

  async getTotalWordCount(): Promise<number> {
    const result = await this.request<{ count: number }>('/api/words/count');
    return result.count;
  }

  // User Progress API
  async markWordKnown(userId: string, wordId: string): Promise<void> {
    await this.request('/api/user-progress/mark-known', {
      method: 'POST',
      body: JSON.stringify({ userId, wordId }),
    });
  }

  async markWordUnknown(userId: string, wordId: string): Promise<void> {
    await this.request('/api/user-progress/mark-unknown', {
      method: 'POST',
      body: JSON.stringify({ userId, wordId }),
    });
  }

  async getUserStats(userId: string): Promise<UserStatsResponse> {
    return this.request<UserStatsResponse>(
      `/api/user-progress/stats?userId=${userId}`
    );
  }

  async getWordStatus(userId: string, wordId: string): Promise<string | null> {
    const result = await this.request<{ status: string | null }>(
      `/api/user-progress/word-status?userId=${userId}&wordId=${wordId}`
    );
    return result.status;
  }

  async resetUserProgress(userId: string): Promise<void> {
    await this.request('/api/user-progress/reset', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  // SRS API
  async getDueWords(userId: string, limit: number = 10): Promise<SrsItemResponse[]> {
    return this.request<SrsItemResponse[]>(
      `/api/srs/due-words?userId=${userId}&limit=${limit}`
    );
  }

  async recordReview(
    userId: string,
    wordId: string,
    difficulty: 'easy' | 'medium' | 'hard' | 'very_hard'
  ): Promise<void> {
    await this.request('/api/srs/record-review', {
      method: 'POST',
      body: JSON.stringify({ userId, wordId, difficulty }),
    });
  }

  async getSrsStats(userId: string): Promise<SrsStatsResponse> {
    return this.request<SrsStatsResponse>(
      `/api/srs/stats?userId=${userId}`
    );
  }

  async createSrsItem(userId: string, wordId: string): Promise<void> {
    await this.request('/api/srs/create-item', {
      method: 'POST',
      body: JSON.stringify({ userId, wordId }),
    });
  }

  async deactivateSrsItem(userId: string, wordId: string): Promise<void> {
    await this.request('/api/srs/deactivate-item', {
      method: 'POST',
      body: JSON.stringify({ userId, wordId }),
    });
  }

  // User Profile API
  async getUserProfile(userId: string): Promise<any> {
    return this.request(`/api/user-profiles/${userId}`);
  }

  async updateUserProfile(userId: string, profileData: any): Promise<any> {
    return this.request(`/api/user-profiles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async checkDeliveryWindow(userId: string, currentTime?: string): Promise<any> {
    const query = currentTime ? `?currentTime=${encodeURIComponent(currentTime)}` : '';
    return this.request(`/api/user-profiles/${userId}/delivery-window${query}`);
  }

  async checkDailyLimit(userId: string, date?: string): Promise<any> {
    const query = date ? `?date=${date}` : '';
    return this.request(`/api/user-profiles/${userId}/daily-limit${query}`);
  }

  // Advanced SRS API
  async getGlobalDueReviews(limit: number = 10, offset: number = 0): Promise<any> {
    return this.request(`/api/srs/due-reviews?limit=${limit}&offset=${offset}`);
  }

  async claimReviews(limit: number = 10): Promise<any> {
    return this.request('/api/srs/claim-reviews', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  }

  async markReviewSent(userId: string, wordId: string, messageId: string, sentAt: string): Promise<void> {
    await this.request(`/api/srs/items/${userId}/${wordId}/mark-sent`, {
      method: 'PUT',
      body: JSON.stringify({ messageId, sentAt }),
    });
  }

  async resetReviewToDue(userId: string, wordId: string): Promise<void> {
    await this.request(`/api/srs/items/${userId}/${wordId}/reset-to-due`, {
      method: 'PUT',
    });
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<{ processedCount: number }> {
    return this.request('/api/srs/process-timeouts', {
      method: 'POST',
      body: JSON.stringify({ timeoutMinutes }),
    });
  }

  async getProcessingStats(): Promise<any> {
    return this.request('/api/srs/processing-stats');
  }

  // Link Code API
  async generateLinkCode(userId: string): Promise<LinkCodeResponse> {
    return this.request<LinkCodeResponse>('/api/link-codes/generate', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getTelegramConnection(userId: string): Promise<TelegramConnectionResponse> {
    return this.request<TelegramConnectionResponse>(
      `/api/link-codes/connection/${userId}`
    );
  }

  async disconnectTelegram(userId: string): Promise<void> {
    await this.request(`/api/link-codes/connection/${userId}`, {
      method: 'DELETE',
    });
  }

  // Stats API
  async getDetailedUserStats(userId: string): Promise<{
    totalItems: number;
    dueToday: number;
    successRate: number;
    learningStreak: number;
  }> {
    return this.request(`/api/stats/${userId}`);
  }

  async checkUserDailyLimit(userId: string): Promise<{
    hasReachedLimit: boolean;
    reviewsToday: number;
    dailyLimit: number;
  }> {
    return this.request(`/api/stats/${userId}/daily-limit`);
  }

  async checkUserDeliveryWindow(userId: string): Promise<{
    withinWindow: boolean;
    windowStart: string;
    windowEnd: string;
    userTimezone: string;
  }> {
    return this.request(`/api/stats/${userId}/delivery-window`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }
}