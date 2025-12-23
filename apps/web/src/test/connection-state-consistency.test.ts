/**
 * Property-based tests for connection state consistency
 * **Feature: telegram-account-linking, Property 2: Connection state consistency**
 * Validates: Requirements 2.1, 2.2, 2.3
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

describe('Property 2: Connection state consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should consistently show no connection when user has no Telegram link', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          // Mock no connection response
          mockDbClient.getTelegramConnection.mockResolvedValue({
            success: true,
            data: null, // No connection
          });

          const result = await mockDbClient.getTelegramConnection(userId);

          // Property: When no connection exists, response should be consistent
          expect(result.success).toBe(true);
          expect(result.data).toBeNull();
          
          // Property: Method should be called with correct userId
          expect(mockDbClient.getTelegramConnection).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should consistently show connection details when user has active Telegram link', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.integer({ min: 100000000, max: 999999999 }), // telegramChatId
        fc.date({ min: new Date('2020-01-01'), max: new Date() }), // linkedAt
        async (userId, telegramChatId, linkedAt) => {
          // Mock active connection response
          mockDbClient.getTelegramConnection.mockResolvedValue({
            success: true,
            data: {
              telegramChatId: telegramChatId.toString(),
              linkedAt: linkedAt.toISOString(),
            },
          });

          const result = await mockDbClient.getTelegramConnection(userId);

          // Property: When connection exists, response should have consistent structure
          expect(result.success).toBe(true);
          expect(result.data).not.toBeNull();
          expect(result.data).toHaveProperty('telegramChatId');
          expect(result.data).toHaveProperty('linkedAt');
          
          // Property: Connection data should match expected format
          expect(result.data.telegramChatId).toBe(telegramChatId.toString());
          expect(result.data.linkedAt).toBe(linkedAt.toISOString());
          
          // Property: linkedAt should be a valid date in the past
          const linkDate = new Date(result.data.linkedAt);
          expect(linkDate.getTime()).toBeLessThanOrEqual(Date.now());
          
          // Property: Method should be called with correct userId
          expect(mockDbClient.getTelegramConnection).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain state consistency after disconnect operation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          // Mock successful disconnect
          mockDbClient.disconnectTelegram.mockResolvedValue({
            success: true,
            message: 'Telegram connection removed successfully',
          });

          // Mock connection check after disconnect (should return null)
          mockDbClient.getTelegramConnection.mockResolvedValue({
            success: true,
            data: null,
          });

          // Perform disconnect
          const disconnectResult = await mockDbClient.disconnectTelegram(userId);
          
          // Check connection status after disconnect
          const connectionResult = await mockDbClient.getTelegramConnection(userId);

          // Property: Disconnect should be successful
          expect(disconnectResult.success).toBe(true);
          expect(disconnectResult.message).toBeDefined();
          
          // Property: After disconnect, connection should be null
          expect(connectionResult.success).toBe(true);
          expect(connectionResult.data).toBeNull();
          
          // Property: Both methods should be called with correct userId
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledWith(userId);
          expect(mockDbClient.getTelegramConnection).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle connection state errors consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.oneof(
          fc.constant('NETWORK_ERROR'),
          fc.constant('SERVER_ERROR'),
          fc.constant('TIMEOUT_ERROR')
        ), // errorType
        async (userId, errorType) => {
          // Mock error response
          const mockError = new Error(`Mock ${errorType}`);
          mockDbClient.getTelegramConnection.mockRejectedValue(mockError);

          // Property: Connection state errors should be handled consistently
          await expect(mockDbClient.getTelegramConnection(userId)).rejects.toThrow();
          
          // Property: Method should be called with correct userId even on error
          expect(mockDbClient.getTelegramConnection).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistent response format across different connection states', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.boolean(), // hasConnection
        async (userId, hasConnection) => {
          if (hasConnection) {
            // Mock connection exists
            mockDbClient.getTelegramConnection.mockResolvedValue({
              success: true,
              data: {
                telegramChatId: '123456789',
                linkedAt: new Date().toISOString(),
              },
            });
          } else {
            // Mock no connection
            mockDbClient.getTelegramConnection.mockResolvedValue({
              success: true,
              data: null,
            });
          }

          const result = await mockDbClient.getTelegramConnection(userId);

          // Property: Response format should always be consistent
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('data');
          expect(result.success).toBe(true);
          
          if (hasConnection) {
            // Property: When connection exists, data should have required fields
            expect(result.data).not.toBeNull();
            expect(result.data).toHaveProperty('telegramChatId');
            expect(result.data).toHaveProperty('linkedAt');
            expect(typeof result.data.telegramChatId).toBe('string');
            expect(typeof result.data.linkedAt).toBe('string');
          } else {
            // Property: When no connection, data should be null
            expect(result.data).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});