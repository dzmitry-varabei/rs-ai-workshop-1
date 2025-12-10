import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, loading, signInAnonymously } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>English Learning Quiz</h1>
        <p>Welcome! Please sign in to start the quiz.</p>
        <button onClick={signInAnonymously}>Sign In Anonymously</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>English Learning Quiz</h1>
      <p>Welcome! You are signed in.</p>
      <p>Quiz functionality coming soon...</p>
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

