import { useEffect, useState, ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { USER_ID_STORAGE_KEY } from '../constants/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user ID exists in localStorage
    const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
    }
    setLoading(false);
  }, []);

  const signInAnonymously = () => {
    // Generate a simple UUID for demo purposes
    const newUserId = crypto.randomUUID();
    localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
    setUserId(newUserId);
  };

  const signOut = () => {
    localStorage.removeItem(USER_ID_STORAGE_KEY);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ userId, loading, signInAnonymously, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

