import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Zap } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../store';
// import { v4 as uuid } from 'crypto';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolUsed?: string;
  intent?: string;
  loading?: boolean;
}

export default function Chat() {
  const {
    profile,
    messages,
    setMessages,
    isTyping,
    setIsTyping,
  } = useStore();
  const [input, setInput] = useState('');
  // const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const typingMsg: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('hanuji_token');
      const res = await axios.post(
        `http://localhost:3000/api/chat`,
        {
          // userId: profile?.user_id || 'web_user',
          // channel: 'web',
          message: userMsg.content,
        },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 180000 }
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.reply
          || 'Sorry, I had trouble generating a response. Please try again.',
        timestamp: new Date(),
        toolUsed: res.data.toolUsed,
        intent: res.data.intent,
      };
      console.log("API RESPONSE:", res.data);

      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(assistantMsg));
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ I had trouble connecting. Make sure the agent service is running on port 3001.',
        timestamp: new Date(),
      };
      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(errMsg));
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    "What's on my calendar today?",
    "Schedule a meeting tomorrow at 3pm",
    "What did we talk about last time?",
    "Remind me about the 5pm call",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center text-base">
          🐒
        </div>
        <div>
          <p className="font-['Syne'] font-bold text-sm text-white">Hanu Ji</p>
          <p className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
            Active
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm border ${
              msg.role === 'assistant'
                ? 'bg-brand/20 border-brand/30'
                : 'bg-purple-500/20 border-purple-500/30'
            }`}>
              {msg.role === 'assistant' ? '🐒' : <User size={12} className="text-purple-300" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {msg.loading ? (
                <div className="bg-surface-2 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-brand text-white rounded-tr-sm'
                      : 'bg-surface-2 border border-white/5 text-gray-200 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.toolUsed && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Zap size={10} className="text-yellow-500" />
                      <span className="font-mono">{msg.toolUsed}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (show when only welcome message) */}
      {messages.length === 1 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs text-gray-400 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand/30 px-3 py-1.5 rounded-full transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 bg-surface-2 border border-white/10 rounded-xl p-2 focus-within:border-brand/40 transition-colors">
          <textarea
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-gray-600 focus:outline-none px-2 py-1 max-h-32"
            placeholder="Message Hanu Ji..."
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 bg-brand hover:bg-brand-dark disabled:opacity-30 rounded-lg flex items-center justify-center self-end transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-center text-xs text-gray-700 mt-2">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
