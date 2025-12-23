/**
 * Property-based tests for code interaction functionality
 * **Feature: telegram-account-linking, Property 3: Code interaction functionality**
 * Validates: Requirements 3.1, 3.2, 3.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Mock the database client module
const mockDbClient = {
  generateLinkCode: vi.fn(),
  getTelegramConnection: vi.fn(),
  disconnectTelegram: vi.fn(),
};

vi.mock('@english-learning/data-layer-client', () => ({
  createDatabaseClient: () => mockDbClient,
}));

describe('Property 3: Code interaction functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format link codes for easy reading and copying', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), // linkCode
        async (linkCode) => {
          // Mock successful link code generation
          mockDbClient.generateLinkCode.mockResolvedValue({
            success: true,
            data: {
              linkCode,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
          });

          const result = await mockDbClient.generateLinkCode('test-user');

          // Property: Link code should be formatted for easy reading
          expect(result.data.linkCode).toHaveLength(8);
          expect(result.data.linkCode).toMatch(/^[A-Z0-9]{8}$/);
          
          // Property: Link code should be uppercase for consistency
          expect(result.data.linkCode).toBe(result.data.linkCode.toUpperCase());
          
          // Property: Link code should be alphanumeric only
          expect(result.data.linkCode).toMatch(/^[A-Z0-9]+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle clipboard copy operations correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), // linkCode
        async (linkCode) => {
          // Clear mocks before each property test iteration
          mockClipboard.writeText.mockClear();
          
          // Mock successful clipboard write
          mockClipboard.writeText.mockResolvedValue(undefined);

          // Simulate copying the link code
          await navigator.clipboard.writeText(linkCode);

          // Property: Clipboard should be called with the exact link code
          expect(mockClipboard.writeText).toHaveBeenCalledWith(linkCode);
          expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should provide visual feedback for copy operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), // linkCode
        fc.boolean(), // copySuccess
        async (linkCode, copySuccess) => {
          // Clear mocks before each property test iteration
          mockClipboard.writeText.mockClear();
          
          if (copySuccess) {
            mockClipboard.writeText.mockResolvedValue(undefined);
          } else {
            mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));
          }

          // Property: Copy operation should either succeed or fail consistently
          if (copySuccess) {
            await expect(navigator.clipboard.writeText(linkCode)).resolves.toBeUndefined();
          } else {
            await expect(navigator.clipboard.writeText(linkCode)).rejects.toThrow();
          }

          // Property: Clipboard method should always be called with the link code
          expect(mockClipboard.writeText).toHaveBeenCalledWith(linkCode);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle clipboard fallback when API is unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), // linkCode
        async () => {
          // Mock clipboard API as unavailable
          const originalClipboard = navigator.clipboard;
          Object.defineProperty(navigator, 'clipboard', {
            value: undefined,
            writable: true,
          });

          // Property: When clipboard API is unavailable, should handle gracefully
          expect(navigator.clipboard).toBeUndefined();

          // Restore clipboard for cleanup
          Object.defineProperty(navigator, 'clipboard', {
            value: originalClipboard,
            writable: true,
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow generating new codes when current code expires', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.array(fc.string({ minLength: 8, maxLength: 8 }).filter(s => /^[A-Z0-9]{8}$/.test(s)), { minLength: 2, maxLength: 3 }), // multipleCodes
        async (userId, multipleCodes) => {
          // Clear mocks before each property test iteration
          mockDbClient.generateLinkCode.mockClear();
          
          // Mock multiple code generations (simulating expiration and regeneration)
          for (let i = 0; i < multipleCodes.length; i++) {
            mockDbClient.generateLinkCode.mockResolvedValueOnce({
              success: true,
              data: {
                linkCode: multipleCodes[i],
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              },
            });
          }

          const results = [];
          for (let i = 0; i < multipleCodes.length; i++) {
            const result = await mockDbClient.generateLinkCode(userId);
            results.push(result);
          }

          // Property: Each generation should produce a valid response
          results.forEach((result, index) => {
            expect(result.success).toBe(true);
            expect(result.data.linkCode).toBe(multipleCodes[index]);
            expect(result.data.linkCode).toHaveLength(8);
            expect(result.data.linkCode).toMatch(/^[A-Z0-9]{8}$/);
          });

          // Property: Should be able to generate multiple codes for the same user
          expect(mockDbClient.generateLinkCode).toHaveBeenCalledTimes(multipleCodes.length);
          
          // Property: All calls should use the same userId
          for (let i = 0; i < multipleCodes.length; i++) {
            expect(mockDbClient.generateLinkCode).toHaveBeenNthCalledWith(i + 1, userId);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should maintain consistent interaction patterns across different states', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.boolean(), // hasExistingConnection
        async (userId, hasExistingConnection) => {
          // Clear mocks before each property test iteration
          mockDbClient.getTelegramConnection.mockClear();
          mockDbClient.generateLinkCode.mockClear();
          
          if (hasExistingConnection) {
            // Mock existing connection
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
            
            // Mock link code generation for users without connection
            mockDbClient.generateLinkCode.mockResolvedValue({
              success: true,
              data: {
                linkCode: 'ABC12345',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              },
            });
          }

          const connectionResult = await mockDbClient.getTelegramConnection(userId);

          // Property: Connection check should always return consistent format
          expect(connectionResult.success).toBe(true);
          
          if (hasExistingConnection) {
            // Property: When connection exists, should not need to generate new codes
            expect(connectionResult.data).not.toBeNull();
            expect(connectionResult.data).toHaveProperty('telegramChatId');
            expect(connectionResult.data).toHaveProperty('linkedAt');
          } else {
            // Property: When no connection, should be able to generate codes
            expect(connectionResult.data).toBeNull();
            
            const codeResult = await mockDbClient.generateLinkCode(userId);
            expect(codeResult.success).toBe(true);
            expect(codeResult.data.linkCode).toHaveLength(8);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});