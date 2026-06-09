import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email: string, password: string): Promise<void> =>
    signInWithEmailAndPassword(auth, email, password).then(() => {});

  const signup = (email: string, password: string): Promise<void> =>
    createUserWithEmailAndPassword(auth, email, password).then(() => {});

  const logout = (): Promise<void> => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
