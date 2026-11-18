import { create } from 'zustand';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  firebaseUser: any | null; // Keeping type for compatibility with Firebase User
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: any | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null, // Will store Firebase Auth user here
  isLoading: true,
  setUser: (user) => set({ user }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setLoading: (isLoading) => set({ isLoading }),
}));

