import { create } from 'zustand';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro';
  planLimit: number;
  checksUsedThisPeriod: number;
  manualChecksUsedThisPeriod: number;
  periodResetAt?: string;
  preferences?: { emailNotifications: boolean };
  apiToken?: string | null;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  checkAuth: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => {
    // After login/register, clear loading: initial isLoading is true and /login does not
    // run checkAuth, so the dashboard would otherwise stay on the spinner until /auth/me returns.
    set({
      user,
      isAuthenticated: !!user,
      ...(user ? { isLoading: false } : {}),
    });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      set({ user: null, isAuthenticated: false });
    }
  }
}));
