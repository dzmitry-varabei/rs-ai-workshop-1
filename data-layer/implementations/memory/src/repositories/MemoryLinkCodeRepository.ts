/**
 * In-memory implementation of LinkCodeRepository
 * 
 * Useful for testing and development without external dependencies.
 */

import type { LinkCodeRepository, UserId, LinkCode } from '@english-learning/data-layer-domain';

export class MemoryLinkCodeRepository implements LinkCodeRepository {
  private linkCodes: Map<string, LinkCode> = new Map();

  async generateLinkCode(userId: UserId): Promise<LinkCode> {
    // Generate 8-character alphanumeric code
    const code = this.generateRandomCode();
    
    // Set expiration to 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    const now = new Date();

    const linkCode: LinkCode = {
      code,
      userId,
      expiresAt,
      createdAt: now,
    };

    this.linkCodes.set(code, linkCode);
    return linkCode;
  }

  async getLinkCode(code: string): Promise<LinkCode | null> {
    return this.linkCodes.get(code) || null;
  }

  async markUsed(code: string, usedAt: Date = new Date()): Promise<void> {
    const linkCode = this.linkCodes.get(code);
    if (linkCode) {
      linkCode.usedAt = usedAt;
    }
  }

  async cleanupExpired(before: Date = new Date()): Promise<number> {
    let cleanedCount = 0;
    
    for (const [code, linkCode] of this.linkCodes.entries()) {
      if (linkCode.expiresAt < before) {
        this.linkCodes.delete(code);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Generate a random 8-character alphanumeric code
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Additional methods for testing
  clear(): void {
    this.linkCodes.clear();
  }

  getAllLinkCodes(): LinkCode[] {
    return Array.from(this.linkCodes.values());
  }
}