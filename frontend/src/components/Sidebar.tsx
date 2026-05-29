import { LayoutDashboard, MessageSquare, Brain, BarChart2, Settings, LogOut, Bot } from 'lucide-react';
import { useStore } from '../store';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'chat',      label: 'Chat',       icon: MessageSquare },
  { id: 'memory',    label: 'Memory',     icon: Brain },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2 },
  { id: 'settings',  label: 'Settings',   icon: Settings },
];

export default function Sidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: string;
  onNavigate: (page: string) => void;
}) {
  const { profile, logout } = useStore();

  return (
    <aside className="w-60 flex-shrink-0 bg-surface border-r border-white/5 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/20 border border-brand/30 flex items-center justify-center text-xl">
            🐒
          </div>
          <div>
            <p className="font-['Syne'] font-bold text-white text-base leading-none">Hanu Ji</p>
            <p className="text-xs text-gray-500 mt-0.5">Personal AI Agent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              currentPage === id
                ? 'bg-brand/15 text-brand border border-brand/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={16} />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent2/20 border border-accent2/30 flex items-center justify-center">
            <Bot size={14} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {profile?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">{profile?.timezone || 'Asia/Kolkata'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 px-2 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
