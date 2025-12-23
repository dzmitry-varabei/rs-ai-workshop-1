import { useState, useEffect, useCallback } from 'react';
import { createDatabaseClient } from '../lib/database';
import type { LinkCodeResponse, TelegramConnectionResponse } from '@english-learning/data-layer-client';
import './AccountLinkingPanel.css';

interface AccountLinkingPanelProps {
  userId: string;
  onConnectionChange?: (connected: boolean) => void;
}

interface RetryState {
  count: number;
  lastAttempt: Date | null;
}

export function AccountLinkingPanel({ userId, onConnectionChange }: AccountLinkingPanelProps) {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkCodeExpiry, setLinkCodeExpiry] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<TelegramConnectionResponse>({
    isConnected: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryState, setRetryState] = useState<RetryState>({ count: 0, lastAttempt: null });
  const [isRetrying, setIsRetrying] = useState(false);

  const dbClient = createDatabaseClient();

  // Enhanced error handling with specific error types
  const handleApiError = (err: unknown, operation: string): string => {
    console.error(`Failed to ${operation}:`, err);
    
    if (err instanceof Error) {
      if (err.message.includes('timeout') || err.message.includes('Request timeout')) {
        return `Request timed out while trying to ${operation}. Please check your internet connection and try again.`;
      }
      if (err.message.includes('Network Error') || err.message.includes('fetch')) {
        return `Network error occurred while trying to ${operation}. Please check your internet connection.`;
      }
      if (err.message.includes('404')) {
        return `Service not found. Please contact support if this issue persists.`;
      }
      if (err.message.includes('500')) {
        return `Server error occurred while trying to ${operation}. Please try again in a few moments.`;
      }
      if (err.message.includes('API Error:')) {
        return err.message.replace('API Error: ', '');
      }
      return `Failed to ${operation}: ${err.message}`;
    }
    
    return `An unexpected error occurred while trying to ${operation}. Please try again.`;
  };

  // Retry mechanism with exponential backoff
  const shouldAllowRetry = (): boolean => {
    if (retryState.count >= 3) return false;
    if (!retryState.lastAttempt) return true;
    
    const timeSinceLastAttempt = Date.now() - retryState.lastAttempt.getTime();
    const minWaitTime = Math.pow(2, retryState.count) * 1000; // Exponential backoff: 1s, 2s, 4s
    
    return timeSinceLastAttempt >= minWaitTime;
  };

  const updateRetryState = () => {
    setRetryState(prev => ({
      count: prev.count + 1,
      lastAttempt: new Date(),
    }));
  };

  const resetRetryState = () => {
    setRetryState({ count: 0, lastAttempt: null });
  };

  // Load connection status on mount with retry logic
  const loadConnectionStatus = useCallback(async (isRetry = false) => {
    if (isRetry && !shouldAllowRetry()) {
      setError('Too many retry attempts. Please wait a moment before trying again.');
      return;
    }

    try {
      setError(null);
      if (isRetry) {
        setIsRetrying(true);
        updateRetryState();
      }
      
      const status = await dbClient.getTelegramConnection(userId);
      setConnectionStatus(status);
      onConnectionChange?.(status.isConnected);
      
      if (isRetry) {
        resetRetryState(); // Reset on successful retry
      }
    } catch (err) {
      const errorMessage = handleApiError(err, 'load connection status');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [userId, dbClient, onConnectionChange, retryState.count, retryState.lastAttempt]);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // Generate new link code with enhanced error handling
  const generateLinkCode = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response: LinkCodeResponse = await dbClient.generateLinkCode(userId);
      setLinkCode(response.code);
      setLinkCodeExpiry(new Date(response.expiresAt));
      resetRetryState(); // Reset retry state on success
    } catch (err) {
      const errorMessage = handleApiError(err, 'generate link code');
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Enhanced clipboard functionality with better error handling
  const copyToClipboard = async () => {
    if (!linkCode) return;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(linkCode);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = linkCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (!successful) {
          throw new Error('Copy command failed');
        }
      }

      // Show success feedback
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError(`Failed to copy code to clipboard. Please copy it manually: ${linkCode}`);
    }
  };

  // Disconnect with enhanced error handling
  const disconnectTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account? You will no longer receive spaced repetition reviews.')) {
      return;
    }

    try {
      setError(null);
      await dbClient.disconnectTelegram(userId);
      await loadConnectionStatus(); // Refresh status
      setLinkCode(null); // Clear any existing link code
      setLinkCodeExpiry(null);
      resetRetryState(); // Reset retry state on success
    } catch (err) {
      const errorMessage = handleApiError(err, 'disconnect Telegram account');
      setError(errorMessage);
    }
  };

  // Check if link code is expired
  const isLinkCodeExpired = () => {
    if (!linkCodeExpiry) return false;
    return new Date() > linkCodeExpiry;
  };

  // Format expiry time with better handling
  const formatExpiryTime = () => {
    if (!linkCodeExpiry) return '';
    const now = new Date();
    const diff = linkCodeExpiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Auto-refresh expiry countdown
  useEffect(() => {
    if (!linkCodeExpiry || isLinkCodeExpired()) return;

    const interval = setInterval(() => {
      // Force re-render to update countdown
      setLinkCodeExpiry(prev => prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [linkCodeExpiry]);

  if (isLoading) {
    return (
      <div className="account-linking-panel">
        <div className="loading">Loading connection status...</div>
      </div>
    );
  }

  return (
    <div className="account-linking-panel" role="region" aria-labelledby="telegram-connection-heading">
      <h2 id="telegram-connection-heading">Telegram Bot Connection</h2>
      
      {error && (
        <div className="error-message" role="alert" aria-live="polite">
          <div className="error-text">{error}</div>
          <div className="error-actions">
            {shouldAllowRetry() ? (
              <button 
                className="retry-button" 
                onClick={() => {
                  setError(null);
                  loadConnectionStatus(true);
                }}
                disabled={isRetrying}
                aria-describedby="retry-help"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            ) : (
              <button 
                className="retry-button disabled" 
                disabled
                title={`Please wait ${Math.ceil((Math.pow(2, retryState.count) * 1000 - (Date.now() - (retryState.lastAttempt?.getTime() || 0))) / 1000)} seconds before retrying`}
                aria-describedby="retry-cooldown-help"
              >
                Wait to retry
              </button>
            )}
            <button 
              className="dismiss-button" 
              onClick={() => setError(null)}
              aria-label="Dismiss error message"
            >
              Dismiss
            </button>
          </div>
          <div id="retry-help" className="sr-only">
            Click to retry the failed operation
          </div>
          <div id="retry-cooldown-help" className="sr-only">
            Retry is temporarily disabled due to multiple failed attempts
          </div>
        </div>
      )}

      {connectionStatus.isConnected ? (
        <div className="connected-state">
          <div className="connection-status connected" role="status" aria-live="polite">
            <span className="status-icon" aria-hidden="true">✓</span>
            <span>Connected to Telegram</span>
          </div>
          {connectionStatus.linkedAt && (
            <p className="connection-info">
              Connected on {new Date(connectionStatus.linkedAt).toLocaleDateString()}
            </p>
          )}
          <p className="connection-description">
            You'll receive spaced repetition reviews for unknown words via the Telegram bot.
          </p>
          <button 
            className="disconnect-button"
            onClick={disconnectTelegram}
            aria-describedby="disconnect-help"
          >
            Disconnect
          </button>
          <div id="disconnect-help" className="sr-only">
            This will stop Telegram bot notifications for spaced repetition reviews
          </div>
        </div>
      ) : (
        <div className="disconnected-state">
          <div className="connection-status disconnected" role="status" aria-live="polite">
            <span className="status-icon" aria-hidden="true">○</span>
            <span>Not connected</span>
          </div>
          <p className="connection-description">
            Connect your account to receive spaced repetition reviews for unknown words via Telegram.
          </p>
          
          {!linkCode ? (
            <button 
              className="generate-button"
              onClick={generateLinkCode}
              disabled={isGenerating}
              aria-describedby="generate-help"
            >
              {isGenerating ? 'Generating...' : 'Connect Telegram Bot'}
            </button>
          ) : (
            <div className="link-code-section">
              <div className="instructions">
                <h3>Link your account:</h3>
                <ol>
                  <li>Open the Telegram bot</li>
                  <li>Copy the code below</li>
                  <li>Send the code to the bot using /link</li>
                </ol>
              </div>
              
              <div className="link-code-display">
                <div 
                  className={`link-code ${isLinkCodeExpired() ? 'expired' : ''}`}
                  onClick={copyToClipboard}
                  title="Click to copy"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      copyToClipboard();
                    }
                  }}
                  aria-label={`Link code: ${linkCode}. Click to copy to clipboard.`}
                  aria-describedby="link-code-help"
                >
                  {linkCode}
                </div>
                {copyFeedback && (
                  <div className="copy-feedback" role="status" aria-live="polite">
                    Copied!
                  </div>
                )}
              </div>
              
              <div className="expiry-info" aria-live="polite">
                {isLinkCodeExpired() ? (
                  <span className="expired-text">Code expired</span>
                ) : (
                  <span>Expires in: {formatExpiryTime()}</span>
                )}
              </div>
              
              <div className="code-actions">
                <button 
                  className="copy-button"
                  onClick={copyToClipboard}
                  disabled={isLinkCodeExpired()}
                  aria-describedby="copy-help"
                >
                  Copy Code
                </button>
                <button 
                  className="generate-new-button"
                  onClick={generateLinkCode}
                  disabled={isGenerating}
                  aria-describedby="generate-new-help"
                >
                  {isGenerating ? 'Generating...' : 'Generate New Code'}
                </button>
              </div>
              
              <div id="link-code-help" className="sr-only">
                This is your unique linking code. It expires in 15 minutes.
              </div>
              <div id="copy-help" className="sr-only">
                Copy the link code to your clipboard
              </div>
              <div id="generate-new-help" className="sr-only">
                Generate a new link code if the current one has expired
              </div>
            </div>
          )}
          <div id="generate-help" className="sr-only">
            Generate a link code to connect your account with the Telegram bot
          </div>
        </div>
      )}
    </div>
  );
}