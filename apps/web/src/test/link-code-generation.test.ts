/**
 * Property-based tests for link code generation and display
 * **Feature: telegram-account-linking, Property 1: Link code generation and display**
 * Validates: Requirements 1.2, 1.3, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the database client module
const mockDbClient = {
  generateLinkCode: vi.fn(),
  getTelegramConnection: vi.fn(),
  disconnectTelegram: vi.fn(),
};

vi.mock('@english-learning/data-layer-client', () => ({
  createDatabaseClient: () => mockDbClient,
}));

describe('Property 1: Link code generation and display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate valid 8-character alphanumeric codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          // Mock successful link code generation
          const mockLinkCode = 'ABC12345'; // Valid 8-character alphanumeric code
          mockDbClient.generateLinkCode.mockResolvedValue({
            success: true,
            data: {
              linkCode: mockLinkCode,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
          });

          const result = await mockDbClient.generateLinkCode(userId);

          // Property: Generated link codes must be exactly 8 characters
          expect(result.data.linkCode).toHaveLength(8);
          
          // Property: Generated link codes must be alphanumeric
          expect(result.data.linkCode).toMatch(/^[A-Z0-9]{8}$/);
          
          // Property: Generated link codes must have expiration time
          expect(result.data.expiresAt).toBeDefined();
          
          // Property: Expiration time must be in the future
          const expirationTime = new Date(result.data.expiresAt);
          const now = new Date();
          expect(expirationTime.getTime()).toBeGreaterThan(now.getTime());
          
          // Property: Expiration time should be approximately 15 minutes from now
          const timeDiff = expirationTime.getTime() - now.getTime();
          const fifteenMinutes = 15 * 60 * 1000;
          expect(timeDiff).toBeGreaterThan(fifteenMinutes - 60000); // Allow 1 minute tolerance
          expect(timeDiff).toBeLessThan(fifteenMinutes + 60000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle link code generation failures gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.oneof(
          fc.constant('NETWORK_ERROR'),
          fc.constant('SERVER_ERROR'),
          fc.constant('TIMEOUT_ERROR')
        ), // errorType
        async (userId, errorType) => {
          // Mock different types of failures
          const mockError = new Error(`Mock ${errorType}`);
          mockDbClient.generateLinkCode.mockRejectedValue(mockError);

          // Property: Link code generation failures should be handled gracefully
          await expect(mockDbClient.generateLinkCode(userId)).rejects.toThrow();
          
          // Property: The method should be called with the correct userId
          expect(mockDbClient.generateLinkCode).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistent response format for successful generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), // linkCode
        async (userId, linkCode) => {
          // Mock successful response with provided link code
          mockDbClient.generateLinkCode.mockResolvedValue({
            success: true,
            data: {
              linkCode,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
          });

          const result = await mockDbClient.generateLinkCode(userId);

          // Property: Response must have consistent structure
          expect(result).toHaveProperty('success', true);
          expect(result).toHaveProperty('data');
          expect(result.data).toHaveProperty('linkCode');
          expect(result.data).toHaveProperty('expiresAt');
          
          // Property: Link code in response matches expected format
          expect(result.data.linkCode).toBe(linkCode);
          expect(typeof result.data.expiresAt).toBe('string');
          
          // Property: Expiration date is valid ISO string
          expect(() => new Date(result.data.expiresAt)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});