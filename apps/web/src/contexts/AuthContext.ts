import { createContext } from 'react';

export interface AuthContextType {
  userId: string | null;
  loading: boolean;
  signInAnonymously: () => void;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);