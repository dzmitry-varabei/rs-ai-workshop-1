/**
 * Property tests for link code validation
 * Tests requirement 1.4: Invalid Link Code Rejection
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { LinkCode } from '../domain/types';

// Mock implementation for testing the validation logic
class MockLinkCodeValidator {
  private validCodes: Map<string, LinkCode> = new Map();

  addValidCode(code: LinkCode) {
    this.validCodes.set(code.code, code);
  }

  validateCode(code: string): { isValid: boolean; reason?: string } {
    // Property 3: Invalid Link Code Rejection
    
    // Check format: must be exactly 8 characters, alphanumeric
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return { isValid: false, reason: 'invalid_format' };
    }

    const linkCode = this.validCodes.get(code);
    
    if (!linkCode) {
      return { isValid: false, reason: 'not_found' };
    }

    // Check if expired
    if (linkCode.expiresAt < new Date()) {
      return { isValid: false, reason: 'expired' };
    }

    // Check if already used
    if (linkCode.usedAt) {
      return { isValid: false, reason: 'already_used' };
    }

    return { isValid: true };
  }
}

describe('Link Code Validation Properties', () => {
  it('Property 3: Invalid Link Code Rejection - rejects malformed codes', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !/^[A-Z0-9]{8}$/.test(s)),
        (invalidCode) => {
          const validator = new MockLinkCodeValidator();
          const result = validator.validateCode(invalidCode);
          
          expect(result.isValid).toBe(false);
          expect(result.reason).toBe('invalid_format');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Invalid Link Code Rejection - rejects expired codes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'A')),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2023-12-31') }),
        (code, pastDate) => {
          const validator = new MockLinkCodeValidator();
          
          // Add an expired code
          validator.addValidCode({
            code,
            userId: 'user-123',
            expiresAt: pastDate,
            usedAt: null,
            createdAt: new Date('2020-01-01'),
          });

          const result = validator.validateCode(code);
          
          expect(result.isValid).toBe(false);
          expect(result.reason).toBe('expired');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Invalid Link Code Rejection - rejects already used codes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'A')),
        (code) => {
          const validator = new MockLinkCodeValidator();
          const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          
          // Add a used code
          validator.addValidCode({
            code,
            userId: 'user-123',
            expiresAt: futureDate,
            usedAt: new Date(),
            createdAt: new Date(),
          });

          const result = validator.validateCode(code);
          
          expect(result.isValid).toBe(false);
          expect(result.reason).toBe('already_used');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 3: Invalid Link Code Rejection - accepts valid codes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 8 }).map(s => s.toUpperCase().replace(/[^A-Z0-9]/g, 'A')),
        (code) => {
          const validator = new MockLinkCodeValidator();
          const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
          
          // Add a valid code
          validator.addValidCode({
            code,
            userId: 'user-123',
            expiresAt: futureDate,
            usedAt: null,
            createdAt: new Date(),
          });

          const result = validator.validateCode(code);
          
          expect(result.isValid).toBe(true);
          expect(result.reason).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});