import { useEffect, useState } from 'react';
import { MessageSquare, Brain, Zap, Calendar, TrendingUp, Wifi, CheckSquare } from 'lucide-react';
import { analyticsApi, userApi, tasksApi } from '../api';
import { useStore } from '../store';

export default function Dashboard() {
  const { setProfile, setAnalytics, analytics, profile } = useStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.getSummary(),
      userApi.getProfile(),
      userApi.getConversations(10),
      tasksApi.getPending(),
    ]).then(([analyticsRes, profileRes, convoRes, tasksRes]) => {
      setAnalytics(analyticsRes.data);
      setProfile(profileRes.data);
      setConversations(convoRes.data || []);
      setTasks(tasksRes.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completeTask = async (id: string) => {
    try {
      await tasksApi.complete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const stats = [
    { label: 'Total Messages', value: analytics?.messages?.total || 0,  icon: MessageSquare, color: 'text-brand' },
    { label: 'Today',          value: analytics?.messages?.today || 0,  icon: TrendingUp,    color: 'text-green-400' },
    { label: 'Memories',       value: analytics?.memories?.total || 0,  icon: Brain,         color: 'text-purple-400' },
    { label: 'Tools Used', value: analytics?.topTools?.reduce((sum: number, tool: any) => sum + Number(tool.count || 0), 0) || 0, icon: Zap, color: 'text-yellow-400' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-['Syne'] font-black text-3xl text-white">
          Good {getGreeting()}, {profile?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Here's what's happening with your AI agent
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <div className="font-['Syne'] font-black text-3xl text-white">
              {loading ? <span className="animate-pulse text-gray-700">—</span> : value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Tasks */}
        <div className="card">
          <h2 className="font-['Syne'] font-bold text-base mb-4 flex items-center gap-2">
            <CheckSquare size={14} className="text-brand" />
            Pending Tasks
          </h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {tasks.map((t) => {
              const isOverdue = t.due_at && new Date(t.due_at) < new Date();
              return (
                <div key={t.id} className="flex gap-3 items-start">
                  <button
                    onClick={() => completeTask(t.id)}
                    className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors ${
                      isOverdue
                        ? 'border-red-500/50 hover:border-red-400 hover:bg-red-500/10'
                        : 'border-white/20 hover:border-brand hover:bg-brand/10'
                    }`}
                    title="Mark as done"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-300 truncate">{t.title}</p>
                      {isOverdue && (
                        <span className="badge text-xs shrink-0 border-red-500/30 text-red-400 bg-red-500/10">
                          Overdue
                        </span>
                      )}
                    </div>
                    {t.due_at && (
                      <p className={`text-xs ${isOverdue ? 'text-red-400/80' : 'text-gray-600'}`}>
                        Due {new Date(t.due_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && !loading && (
              <p className="text-sm text-gray-600 text-center py-6">No pending tasks — you're all caught up!</p>
            )}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="card">
          <h2 className="font-['Syne'] font-bold text-base mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-brand" />
            Recent Conversations
          </h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {conversations.filter(c => c.role === 'user').slice(0, 8).map((c, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className={`badge text-xs shrink-0 ${
                  c.channel === 'telegram' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                  c.channel === 'whatsapp' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                  'border-purple-500/30 text-purple-400 bg-purple-500/10'
                }`}>
                  {c.channel || 'web'}
                </span>
                <p className="text-sm text-gray-300 truncate flex-1">{c.content}</p>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {conversations.length === 0 && !loading && (
              <p className="text-sm text-gray-600 text-center py-6">No conversations yet — say hi to Hanu Ji!</p>
            )}
          </div>
        </div>

        {/* Top Tools */}
        <div className="card">
          <h2 className="font-['Syne'] font-bold text-base mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            Top Tools Used
          </h2>
          <div className="space-y-3">
            {(analytics?.topTools || []).map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-white font-mono">{t.tool_used}</span>
                    <span className="text-xs text-gray-500">{t.count}x</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full"
                      style={{ width: `${Math.min((t.count / (analytics?.topTools?.[0]?.count || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {(!analytics?.topTools || analytics.topTools.length === 0) && !loading && (
              <p className="text-sm text-gray-600 text-center py-6">No tool usage yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="mt-6 card flex items-center gap-4">
        <Wifi size={14} className="text-green-400" />
        <div className="flex gap-6 flex-wrap">
          {[
            { label: 'Telegram', hint: `@${profile?.preferences?.telegram_username || 'Set in Settings'}` },
            { label: 'WhatsApp', hint: profile?.phone || 'Set in Settings' },
            { label: 'Google Calendar', hint: profile?.google_tokens ? '✅ Connected' : 'Not connected' },
          ].map(({ label, hint }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 font-mono">{label}</p>
              <p className="text-xs text-white">{hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}