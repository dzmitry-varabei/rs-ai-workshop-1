import { useState, useEffect, useCallback } from 'react';
import { createDatabaseClient } from '../lib/database';
import type { LinkCodeResponse, TelegramConnectionResponse } from '@english-learning/data-layer-client';
import './AccountLinkingPanel.css';

interface AccountLinkingPanelProps {
  userId: string;
  onConnectionChange?: (connected: boolean) => void;
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

  const dbClient = createDatabaseClient();

  // Load connection status on mount
  const loadConnectionStatus = useCallback(async () => {
    try {
      setError(null);
      const status = await dbClient.getTelegramConnection(userId);
      setConnectionStatus(status);
      onConnectionChange?.(status.isConnected);
    } catch (err) {
      console.error('Failed to load connection status:', err);
      setError('Failed to load connection status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, dbClient, onConnectionChange]);

  useEffect(() => {
    loadConnectionStatus();
  }, [loadConnectionStatus]);

  // Generate new link code
  const generateLinkCode = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response: LinkCodeResponse = await dbClient.generateLinkCode(userId);
      setLinkCode(response.code);
      setLinkCodeExpiry(new Date(response.expiresAt));
    } catch (err) {
      console.error('Failed to generate link code:', err);
      setError('Failed to generate link code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy link code to clipboard
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
        document.execCommand('copy');
        textArea.remove();
      }

      // Show feedback
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy code. Please copy it manually.');
    }
  };

  // Disconnect Telegram account
  const disconnectTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account?')) {
      return;
    }

    try {
      setError(null);
      await dbClient.disconnectTelegram(userId);
      await loadConnectionStatus(); // Refresh status
      setLinkCode(null); // Clear any existing link code
      setLinkCodeExpiry(null);
    } catch (err) {
      console.error('Failed to disconnect Telegram:', err);
      setError('Failed to disconnect Telegram account. Please try again.');
    }
  };

  // Check if link code is expired
  const isLinkCodeExpired = () => {
    if (!linkCodeExpiry) return false;
    return new Date() > linkCodeExpiry;
  };

  // Format expiry time
  const formatExpiryTime = () => {
    if (!linkCodeExpiry) return '';
    const now = new Date();
    const diff = linkCodeExpiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (diff <= 0) return 'Expired';
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="account-linking-panel">
        <div className="loading">Loading connection status...</div>
      </div>
    );
  }

  return (
    <div className="account-linking-panel">
      <h2>Telegram Bot Connection</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button 
            className="retry-button" 
            onClick={() => {
              setError(null);
              loadConnectionStatus();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {connectionStatus.isConnected ? (
        <div className="connected-state">
          <div className="connection-status connected">
            <span className="status-icon">✓</span>
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
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="disconnected-state">
          <div className="connection-status disconnected">
            <span className="status-icon">○</span>
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
                >
                  {linkCode}
                </div>
                {copyFeedback && (
                  <div className="copy-feedback">Copied!</div>
                )}
              </div>
              
              <div className="expiry-info">
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
                >
                  Copy Code
                </button>
                <button 
                  className="generate-new-button"
                  onClick={generateLinkCode}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate New Code'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}