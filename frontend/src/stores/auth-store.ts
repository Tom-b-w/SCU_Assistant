import { create } from "zustand";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setUser: (user, token) => {
    set({ user, accessToken: token, isAuthenticated: true });
  },
  setAccessToken: (token) => {
    set({ accessToken: token });
  },
  logout: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
