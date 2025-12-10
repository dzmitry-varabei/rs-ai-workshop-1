import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WordCard } from './components/WordCard';
import { createRepositories } from './lib/repositories';
import type { Word, WordId } from '@english-learning/domain';
import './App.css';

function AppContent() {
  const { user, loading, signInAnonymously, userId } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingWords, setLoadingWords] = useState(false);

  useEffect(() => {
    if (userId) {
      loadWords();
    }
  }, [userId]);

  const loadWords = async () => {
    if (!userId) return;
    setLoadingWords(true);
    try {
      const repos = createRepositories();
      const batch = await repos.wordRepository.getRandomBatch(userId, 20);
      setWords(batch);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load words:', error);
    } finally {
      setLoadingWords(false);
    }
  };

  const handleSwipeLeft = async () => {
    if (!userId || !words[currentIndex]) return;
    const wordId = words[currentIndex].id;
    try {
      const repos = createRepositories();
      await repos.userWordStateRepository.markUnknown(userId, wordId);
      // Optionally create SRS item for unknown word
      await repos.srsRepository.createOrGet(userId, wordId, new Date());
      nextWord();
    } catch (error) {
      console.error('Failed to mark word as unknown:', error);
    }
  };

  const handleSwipeRight = async () => {
    if (!userId || !words[currentIndex]) return;
    const wordId = words[currentIndex].id;
    try {
      const repos = createRepositories();
      await repos.userWordStateRepository.markKnown(userId, wordId);
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

  if (loading || loadingWords) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container">
        <div className="auth-screen">
          <h1>English Learning Quiz</h1>
          <p>Welcome! Please sign in to start the quiz.</p>
          <button onClick={signInAnonymously} className="sign-in-button">
            Sign In Anonymously
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
        <div className="progress-info">
          Word {currentIndex + 1} of {words.length}
        </div>
      </div>
      <div className="quiz-area">
        {currentWord && (
          <WordCard
            word={currentWord}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
          />
        )}
      </div>
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

