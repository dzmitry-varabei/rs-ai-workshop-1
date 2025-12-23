# Design Document

## Overview

The Telegram Account Linking feature enables web app users to connect their accounts with the Telegram bot for spaced repetition learning. The feature provides a user-friendly interface for generating 8-character link codes, displaying clear instructions, and managing connection status. The implementation integrates with the existing Database Service API and follows the established patterns in the web application.

## Architecture

The feature follows a client-server architecture where:

1. **Web App (Client)**: Provides the user interface for account linking
2. **Database Service (Server)**: Manages link codes, user profiles, and validation
3. **Telegram Bot**: Consumes link codes to establish connections (existing)

The web app communicates with the Database Service via HTTP API calls using the existing DatabaseClient. New endpoints will be added to handle link code operations.

## Components and Interfaces

### Web App Components

#### AccountLinkingPanel Component
- **Purpose**: Main UI component for account linking functionality
- **Location**: `apps/web/src/components/AccountLinkingPanel.tsx`
- **Props**:
  - `userId: string` - Current user ID
  - `onConnectionChange?: (connected: boolean) => void` - Callback for connection status changes
- **State**:
  - `linkCode: string | null` - Current active link code
  - `isGenerating: boolean` - Loading state for code generation
  - `connectionStatus: ConnectionStatus` - Current connection state
  - `error: string | null` - Error message display
  - `copyFeedback: boolean` - Visual feedback for copy action

#### ConnectionStatus Type
```typescript
interface ConnectionStatus {
  isConnected: boolean;
  linkedAt?: Date;
  telegramChatId?: string;
}
```

### Database Service Extensions

#### Link Code Endpoints
- `POST /api/link-codes/generate` - Generate new link code for user
- `GET /api/users/:userId/telegram-connection` - Get connection status
- `DELETE /api/users/:userId/telegram-connection` - Disconnect Telegram account

#### DatabaseClient Extensions
```typescript
// New methods to add to DatabaseClient
async generateLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }>;
async getTelegramConnection(userId: string): Promise<ConnectionStatus>;
async disconnectTelegram(userId: string): Promise<void>;
```

## Data Models

### LinkCode (Existing)
```typescript
interface LinkCode {
  code: string; // 8-character alphanumeric
  userId: UserId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
```

### LinkCodeResponse
```typescript
interface LinkCodeResponse {
  code: string;
  expiresAt: Date;
}
```

### TelegramConnectionResponse
```typescript
interface TelegramConnectionResponse {
  isConnected: boolean;
  linkedAt?: string; // ISO date string
  telegramChatId?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, several properties can be consolidated to eliminate redundancy:

- Properties 2.1, 2.2, and 2.4 can be combined into a single comprehensive connection state property
- Properties 3.1, 3.2, and 3.3 can be combined into a comprehensive code interaction property  
- Properties 4.1, 4.2, and 4.3 can be combined into a comprehensive error handling property

### Core Properties

**Property 1: Link code generation and display**
*For any* user action that triggers link code generation, the system should generate a valid 8-character alphanumeric code and display it prominently with expiration information
**Validates: Requirements 1.2, 1.3, 1.5**

**Property 2: Connection state consistency**
*For any* user connection state (connected or disconnected), the UI should display the appropriate interface elements and connection information
**Validates: Requirements 2.1, 2.2, 2.3**

**Property 3: Code interaction functionality**
*For any* displayed link code, clicking on it should copy the code to clipboard and provide visual feedback
**Validates: Requirements 3.1, 3.2, 3.3**

**Property 4: Disconnect operation**
*For any* connected user who triggers disconnect, the system should remove the Telegram chat ID from their profile and update the UI state
**Validates: Requirements 2.5**

**Property 5: Code expiration handling**
*For any* expired link code, the system should allow generating a new code to replace it
**Validates: Requirements 3.4**

**Property 6: Comprehensive error handling**
*For any* error condition (API failure, network error, service unavailability), the system should display appropriate error messages with actionable next steps
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

<function_calls>
<invoke name="prework">
<parameter name="featureName">telegram-account-linking

## Error Handling

### Client-Side Error Handling
- **Network Errors**: Display retry button with exponential backoff
- **API Errors**: Show specific error messages based on error codes
- **Validation Errors**: Provide inline feedback for invalid states
- **Timeout Errors**: Allow manual retry with clear messaging

### Error Recovery Strategies
- **Link Code Generation Failure**: Allow immediate retry with different code
- **Connection Status Check Failure**: Graceful degradation with cached state
- **Disconnect Operation Failure**: Retry mechanism with user confirmation
- **Clipboard API Failure**: Fallback to manual copy instructions

### User Experience During Errors
- Clear, actionable error messages
- Consistent error styling and placement
- Non-blocking error states where possible
- Progress indicators during retry operations

## Testing Strategy

### Unit Testing Approach
The implementation will use **Vitest** as the testing framework, following the existing patterns in the web application.

**Unit tests will cover:**
- Component rendering with different props and states
- Event handlers and user interactions
- API integration with mocked responses
- Error boundary behavior and recovery
- Clipboard functionality with fallbacks

**Unit tests will focus on:**
- Specific examples that demonstrate correct behavior
- Integration points between components and services
- Edge cases like expired codes and network failures
- User interaction flows and state transitions

### Property-Based Testing Approach
Property-based tests will use **fast-check** library to verify universal properties across all valid inputs.

**Property-based testing requirements:**
- Each property-based test will run a minimum of 100 iterations
- Tests will be tagged with comments referencing design document properties
- Tag format: `**Feature: telegram-account-linking, Property {number}: {property_text}**`
- Each correctness property will be implemented by a single property-based test

**Property tests will verify:**
- Link code generation produces valid 8-character alphanumeric codes
- UI state consistency across different connection states
- Error handling behavior across various failure scenarios
- Code interaction functionality with different code formats
- Expiration handling with various time scenarios

**Dual testing approach benefits:**
- Unit tests catch concrete bugs and verify specific examples
- Property tests verify general correctness across all inputs
- Together they provide comprehensive coverage of functionality and edge cases

### Test Data Generation
- **Link codes**: Generate valid 8-character alphanumeric strings
- **Connection states**: Generate various connection status combinations
- **Error scenarios**: Generate different API error responses
- **Time scenarios**: Generate various expiration and linking timestamps
- **User interactions**: Generate different user action sequences