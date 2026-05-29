import { useState } from 'react';
import { authApi, userApi } from '../api';
import { useStore } from '../store';

export default function Login() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setToken, setProfile } = useStore();

  const handleLogin = async () => {
    if (!name.trim()) return setError('Please enter your name');
    setLoading(true);
    setError('');
    try {
      // Create a userId from name for demo — in production use proper auth
      const userId = `web_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString(36)}`;
      const res = await authApi.login(userId, name);
      setToken(res.data.token);

      // Fetch profile
      const profile = await userApi.getProfile();
      setProfile(profile.data || res.data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🐒</div>
          <h1 className="font-['Syne'] font-black text-4xl text-white mb-2">Hanu Ji</h1>
          <p className="text-gray-400 text-sm">Your personal AI agent</p>
        </div>

        {/* Form */}
        <div className="card space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-mono uppercase tracking-wider">
              Your Name
            </label>
            <input
              className="input"
              placeholder="Enter your name to get started"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-mono">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              '→ Start chatting with Hanu Ji'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Connect via Telegram or WhatsApp for full experience
        </p>
      </div>
    </div>
  );
}
