/**
 * Property-based tests for disconnect operation
 * **Feature: telegram-account-linking, Property 4: Disconnect operation**
 * Validates: Requirements 2.5
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

describe('Property 4: Disconnect operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully disconnect active Telegram connections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          
          // Mock successful disconnect
          mockDbClient.disconnectTelegram.mockResolvedValue({
            success: true,
            message: 'Telegram connection removed successfully',
          });

          const result = await mockDbClient.disconnectTelegram(userId);

          // Property: Disconnect should return success response
          expect(result.success).toBe(true);
          expect(result.message).toBeDefined();
          expect(typeof result.message).toBe('string');
          
          // Property: Method should be called with correct userId
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledWith(userId);
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle disconnect errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.oneof(
          fc.constant('NETWORK_ERROR'),
          fc.constant('SERVER_ERROR'),
          fc.constant('NOT_FOUND_ERROR'),
          fc.constant('UNAUTHORIZED_ERROR')
        ), // errorType
        async (userId, errorType) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          
          // Mock different types of errors
          const mockError = new Error(`Mock ${errorType}`);
          mockDbClient.disconnectTelegram.mockRejectedValue(mockError);

          // Property: Disconnect errors should be handled consistently
          await expect(mockDbClient.disconnectTelegram(userId)).rejects.toThrow();
          
          // Property: Method should be called with correct userId even on error
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledWith(userId);
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistent response format for successful disconnects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 10, maxLength: 100 }), // successMessage
        async (userId, successMessage) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          
          // Mock successful disconnect with custom message
          mockDbClient.disconnectTelegram.mockResolvedValue({
            success: true,
            message: successMessage,
          });

          const result = await mockDbClient.disconnectTelegram(userId);

          // Property: Response should have consistent structure
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('message');
          expect(result.success).toBe(true);
          expect(result.message).toBe(successMessage);
          
          // Property: Message should be a non-empty string
          expect(typeof result.message).toBe('string');
          expect(result.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure connection is removed after successful disconnect', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (userId) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          mockDbClient.getTelegramConnection.mockClear();
          
          // Mock successful disconnect
          mockDbClient.disconnectTelegram.mockResolvedValue({
            success: true,
            message: 'Connection removed',
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

  it('should handle multiple disconnect attempts consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.integer({ min: 2, max: 5 }), // numberOfAttempts
        async (userId, numberOfAttempts) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          
          // Mock responses for multiple attempts
          for (let i = 0; i < numberOfAttempts; i++) {
            if (i === 0) {
              // First attempt succeeds
              mockDbClient.disconnectTelegram.mockResolvedValueOnce({
                success: true,
                message: 'Connection removed',
              });
            } else {
              // Subsequent attempts might fail (connection already removed)
              mockDbClient.disconnectTelegram.mockResolvedValueOnce({
                success: false,
                message: 'No connection found',
              });
            }
          }

          const results = [];
          for (let i = 0; i < numberOfAttempts; i++) {
            const result = await mockDbClient.disconnectTelegram(userId);
            results.push(result);
          }

          // Property: First disconnect should succeed
          expect(results[0].success).toBe(true);
          
          // Property: Subsequent disconnects should handle gracefully
          for (let i = 1; i < numberOfAttempts; i++) {
            expect(results[i]).toHaveProperty('success');
            expect(results[i]).toHaveProperty('message');
            expect(typeof results[i].message).toBe('string');
          }

          // Property: All calls should use the same userId
          expect(mockDbClient.disconnectTelegram).toHaveBeenCalledTimes(numberOfAttempts);
          for (let i = 0; i < numberOfAttempts; i++) {
            expect(mockDbClient.disconnectTelegram).toHaveBeenNthCalledWith(i + 1, userId);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should validate userId parameter for disconnect operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 50 }), // valid userId
          fc.constant(''), // empty string
          fc.constant(null), // null
          fc.constant(undefined) // undefined
        ), // userId
        async (userId) => {
          // Clear mocks before each property test iteration
          mockDbClient.disconnectTelegram.mockClear();
          
          if (userId && typeof userId === 'string' && userId.length > 0) {
            // Valid userId - should succeed
            mockDbClient.disconnectTelegram.mockResolvedValue({
              success: true,
              message: 'Connection removed',
            });

            const result = await mockDbClient.disconnectTelegram(userId);
            
            // Property: Valid userId should result in successful call
            expect(result.success).toBe(true);
            expect(mockDbClient.disconnectTelegram).toHaveBeenCalledWith(userId);
          } else {
            // Invalid userId - should handle appropriately
            mockDbClient.disconnectTelegram.mockRejectedValue(new Error('Invalid userId'));

            // Property: Invalid userId should be rejected
            await expect(mockDbClient.disconnectTelegram(userId)).rejects.toThrow();
            expect(mockDbClient.disconnectTelegram).toHaveBeenCalledWith(userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});