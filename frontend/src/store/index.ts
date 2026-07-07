import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  intent?: string;
  loading?: boolean;
}

interface HanuJiStore {
  token: string | null;
  userId: string | null;
  profile: any;

  messages: Message[];
  analytics: any;
  memories: any[];

  isTyping: boolean;

  setToken: (token: string) => void;
  setProfile: (profile: any) => void;

  setMessages: (
    messages: Message[] | ((prev: Message[]) => Message[])
  ) => void;

  addMessage: (msg: Message) => void;

  setIsTyping: (value: boolean) => void;

  setAnalytics: (data: any) => void;
  setMemories: (data: any[]) => void;

  logout: () => void;
}

const welcomeMessage: Message = {
  id: "0",
  role: "assistant",
  content:
`Namaste! I'm Hanu Ji, your personal AI assistant 🐒

I can help you:
• Schedule and manage calendar events
• Answer questions
• Remember important things about you

Try saying:
"What's on my calendar today?"
or
"Schedule a meeting tomorrow at 3pm"`,
  timestamp: new Date(),
};

export const useStore = create<HanuJiStore>((set) => ({
  token: null,
  userId: null,
  profile: null,

  messages: [welcomeMessage],

  analytics: null,

  memories: [],

  isTyping: false,

  setToken: (token) => {
    localStorage.setItem("hanuji_token", token);
    set({ token });
  },

  setProfile: (profile) =>
    set({
      profile,
      userId: profile?.user_id,
    }),

  setMessages: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function"
          ? messages(state.messages)
          : messages,
    })),

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  setIsTyping: (value) =>
    set({
      isTyping: value,
    }),

  setAnalytics: (data) =>
    set({
      analytics: data,
    }),

  setMemories: (data) =>
    set({
      memories: data,
    }),

  logout: () => {
    localStorage.removeItem("hanuji_token");

    set({
      token: null,
      userId: null,
      profile: null,
      messages: [welcomeMessage],
      isTyping: false,
    });
  },
}));