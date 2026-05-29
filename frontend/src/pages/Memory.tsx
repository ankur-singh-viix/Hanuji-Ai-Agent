import { useEffect, useState } from 'react';
import { Brain, Trash2, Tag, RefreshCw } from 'lucide-react';
import { memoryApi } from '../api';

const CATEGORY_COLORS: Record<string, string> = {
  preference: 'border-brand/30 text-brand bg-brand/10',
  contact:    'border-blue-500/30 text-blue-400 bg-blue-500/10',
  constraint: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  goal:       'border-green-500/30 text-green-400 bg-green-500/10',
  fact:       'border-purple-500/30 text-purple-400 bg-purple-500/10',
};

export default function Memory() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    memoryApi.getAll()
      .then(res => setMemories(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await memoryApi.delete(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const categories = ['all', ...Array.from(new Set(memories.map(m => m.category)))];
  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Syne'] font-black text-2xl text-white flex items-center gap-2">
            <Brain size={20} className="text-purple-400" />
            Long-Term Memory
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Facts Hanu Ji has learned about you — {memories.length} total
          </p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`badge capitalize transition-all cursor-pointer ${
              filter === cat
                ? 'border-brand/50 text-brand bg-brand/15'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memory cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse h-20 bg-surface-2" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Brain size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No memories yet.</p>
          <p className="text-gray-600 text-sm">Hanu Ji will learn from your conversations automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((mem) => (
            <div key={mem.id} className="card group hover:border-white/10 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge text-xs ${CATEGORY_COLORS[mem.category] || 'border-gray-500/30 text-gray-400'}`}>
                      <Tag size={9} className="inline mr-1" />
                      {mem.category}
                    </span>
                    <span className="text-xs text-gray-600">
                      {Math.round((mem.confidence || 1) * 100)}% confident
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{mem.content}</p>
                  <p className="text-xs text-gray-600 mt-2 font-mono">
                    {new Date(mem.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
