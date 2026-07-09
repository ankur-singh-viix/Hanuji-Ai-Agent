import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, MessageSquare, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { analyticsApi } from '../api';

export default function Analytics() {
  const [summary, setSummary] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.getSummary(), analyticsApi.getDaily()])
      .then(([s, d]) => {
        setSummary(s.data);
        setDaily(d.data.map((row: any) => ({
          date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          messages: parseInt(row.messages),
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Syne'] font-black text-2xl text-white flex items-center gap-2">
          <BarChart2 size={20} className="text-brand" />
          Analytics
        </h1>
        <p className="text-gray-400 text-sm mt-1">Your AI agent usage insights</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Messages', value: summary?.messages?.total, icon: MessageSquare, color: 'text-brand' },
          { label: 'Today',          value: summary?.messages?.today, icon: TrendingUp,    color: 'text-green-400' },
          { label: 'Memories',       value: summary?.memories?.total, icon: BarChart2,     color: 'text-purple-400' },
          { label: 'Tools Used', value: summary?.topTools?.reduce((a: number, t: any) => a + Number(t.count || 0), 0), icon: Zap, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</span>
              <Icon size={13} className={color} />
            </div>
            <div className="font-['Syne'] font-black text-3xl text-white">
              {loading ? <span className="text-gray-700">—</span> : (value || 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message volume chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-['Syne'] font-bold text-sm mb-4 text-white flex items-center gap-2">
            <TrendingUp size={13} className="text-brand" />
            Messages — Last 30 Days
          </h3>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#666' }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#18181f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#ff6b35' }}
                  labelStyle={{ color: '#888' }}
                />
                <Bar dataKey="messages" fill="#ff6b35" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              No data yet — start chatting!
            </div>
          )}
        </div>

        {/* Top tools */}
        <div className="card">
          <h3 className="font-['Syne'] font-bold text-sm mb-4 text-white flex items-center gap-2">
            <Zap size={13} className="text-yellow-400" />
            Top Tools
          </h3>
          <div className="space-y-3">
            {(summary?.topTools || []).map((t: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-mono truncate">{t.tool_used}</span>
                  <span className="text-gray-500 ml-2 shrink-0">{t.count}x</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min((t.count / (summary?.topTools?.[0]?.count || 1)) * 100, 100)}%`,
                      background: `hsl(${30 + i * 40}, 80%, 60%)`,
                    }}
                  />
                </div>
              </div>
            ))}
            {(!summary?.topTools || summary.topTools.length === 0) && !loading && (
              <p className="text-xs text-gray-600 text-center py-4">No tool usage yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
