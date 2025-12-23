import { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { WordCard } from './components/WordCard';
import { StatsPanel } from './components/StatsPanel';
import { ResetModal } from './components/ResetModal';
import { AccountLinkingPanel } from './components/AccountLinkingPanel';
import { createDatabaseClient } from './lib/database';
import { exportToPDF } from './lib/pdfExport';
import type { WordResponse, UserStatsResponse } from '@english-learning/data-layer-client';
import './App.css';

function AppContent() {
  const { userId, loading, signInAnonymously } = useAuth();
  const [words, setWords] = useState<WordResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingWords, setLoadingWords] = useState(false);
  const [stats, setStats] = useState<UserStatsResponse>({
    totalSeen: 0,
    known: 0,
    unknown: 0,
    learning: 0,
    knowledgePercentage: 0,
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadWords = useCallback(async () => {
    if (!userId) return;
    setLoadingWords(true);
    try {
      const dbClient = createDatabaseClient();
      // Load words from Database Service
      const batch = await dbClient.getRandomWords(userId, 20);
      console.debug('loadWords: batch size', batch.length);
      
      setWords(batch);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load words:', error);
    } finally {
      setLoadingWords(false);
    }
  }, [userId]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const dbClient = createDatabaseClient();
      const userStats = await dbClient.getUserStats(userId);
      setStats(userStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadWords();
      loadStats();
    }
  }, [userId, loadWords, loadStats]);

  useEffect(() => {
    // Refresh stats after each word action
    if (userId && words.length > 0) {
      loadStats();
    }
  }, [currentIndex, userId, words.length, loadStats]);

  const handleSwipeLeft = async () => {
    if (!userId || !words[currentIndex]) return;
    const wordId = words[currentIndex].id;
    try {
      const dbClient = createDatabaseClient();
      await dbClient.markWordUnknown(userId, wordId);
      // Create SRS item for unknown word
      await dbClient.createSrsItem(userId, wordId);
      await loadStats(); // Refresh stats after marking
      nextWord();
    } catch (error) {
      console.error('Failed to mark word as unknown:', error);
    }
  };

  const handleSwipeRight = async () => {
    if (!userId || !words[currentIndex]) return;
    const wordId = words[currentIndex].id;
    try {
      const dbClient = createDatabaseClient();
      await dbClient.markWordKnown(userId, wordId);
      await loadStats(); // Refresh stats after marking
      nextWord();
    } catch (error) {
      console.error('Failed to mark word as known:', error);
    }
  };

  const nextWord = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Load more words when reaching the end
      loadWords();
    }
  };

  const handleResetProgress = async () => {
    if (!userId) return;
    setResetting(true);
    try {
      const dbClient = createDatabaseClient();
      await dbClient.resetUserProgress(userId);
      // Reset local state
      setWords([]);
      setCurrentIndex(0);
      await loadStats();
      await loadWords();
      setShowResetModal(false);
    } catch (error) {
      console.error('Failed to reset progress:', error);
      alert('Failed to reset progress. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!userId) return;
    try {
      const dbClient = createDatabaseClient();
      
      // For now, we'll export current stats and words
      // In a full implementation, we'd need additional API endpoints
      // to get words by status
      const freshStats = await dbClient.getUserStats(userId);
      
      // Export to PDF with available data
      await exportToPDF({
        knownWords: [], // TODO: Add API endpoint to get words by status
        unknownWords: [], // TODO: Add API endpoint to get words by status
        stats: freshStats,
        exportDate: new Date(),
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  if (loading || loadingWords) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="app-container">
        <div className="auth-screen">
          <h1>English Learning Quiz</h1>
          <p>Welcome! Please sign in to start the quiz.</p>
          <button onClick={signInAnonymously} className="sign-in-button">
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="app-container">
        <div className="empty-state">
          <h2>No words available</h2>
          <button onClick={loadWords}>Load Words</button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className="app-container">
      <div className="quiz-header">
        <h1>English Learning Quiz</h1>
        <div className="header-actions">
          <button
            className="export-button"
            onClick={handleExportPDF}
            disabled={stats.totalSeen === 0}
          >
            Export PDF
          </button>
          <button
            className="reset-button"
            onClick={() => setShowResetModal(true)}
            disabled={resetting || stats.totalSeen === 0}
          >
            Reset Progress
          </button>
        </div>
      </div>
      <StatsPanel
        stats={stats}
        currentProgress={currentIndex + 1}
        totalInBatch={words.length}
      />
      <AccountLinkingPanel
        userId={userId}
        onConnectionChange={(connected) => {
          // Could be used for future features like showing different UI based on connection status
          console.log('Telegram connection status:', connected);
        }}
      />
      <div className="quiz-area">
        {currentWord && (
          <WordCard
            word={currentWord}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        )}
      </div>
      <ResetModal
        isOpen={showResetModal}
        onConfirm={handleResetProgress}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

