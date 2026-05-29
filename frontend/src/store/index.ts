import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  intent?: string;
}

interface HanuJiStore {
  token: string | null;
  userId: string | null;
  profile: any;
  messages: Message[];
  analytics: any;
  memories: any[];
  setToken: (token: string) => void;
  setProfile: (profile: any) => void;
  addMessage: (msg: Message) => void;
  setAnalytics: (data: any) => void;
  setMemories: (data: any[]) => void;
  logout: () => void;
}

export const useStore = create<HanuJiStore>((set) => ({
  token:     null,
  userId:    null,
  profile:   null,
  messages:  [],
  analytics: null,
  memories:  [],

  setToken: (token) => {
    localStorage.setItem('hanuji_token', token);
    set({ token });
  },

  setProfile: (profile) => set({ profile, userId: profile?.user_id }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setAnalytics: (data) => set({ analytics: data }),

  setMemories: (data) => set({ memories: data }),

  logout: () => {
    localStorage.removeItem('hanuji_token');
    set({ token: null, userId: null, profile: null, messages: [] });
  },
}));
