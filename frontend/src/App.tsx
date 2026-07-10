import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Memory from './pages/Memory';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useStore } from './store';

type Page = 'dashboard' | 'chat' | 'memory' | 'analytics' | 'settings';

export default function App() {
  const { token, setToken, userId, addMessage } = useStore();
  const [page, setPage] = useState<Page>('dashboard');

  // Auto-login for demo (remove in production — require real auth)
  useEffect(() => {
    if (!token) {
      const saved = localStorage.getItem('hanuji_token');
      if (saved) setToken(saved);
    }
  }, []);

  // Live reminders: connect once we know who's logged in, and push any
  // reminder that arrives straight into the chat as an assistant message.
  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`ws://localhost:3000/ws?userId=${userId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'reminder') {
          addMessage({
            id: data.id || Date.now().toString(),
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
          });
        }
      } catch (err) {
        console.error('Failed to parse reminder message', err);
      }
    };

    ws.onerror = (err) => {
      console.error('Reminder WebSocket error', err);
    };

    return () => ws.close();
  }, [userId]);

  if (!token) return <Login />;

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard />,
    chat:      <Chat />,
    memory:    <Memory />,
    analytics: <Analytics />,
    settings:  <Settings />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      <Sidebar currentPage={page} onNavigate={(p) => setPage(p as Page)} />
      <main className="flex-1 overflow-auto">
        {pages[page]}
      </main>
    </div>
  );
}