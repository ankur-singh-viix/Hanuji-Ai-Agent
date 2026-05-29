import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle } from 'lucide-react';
import { userApi } from '../api';
import { useStore } from '../store';

const TIMEZONES = ['Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Singapore', 'Asia/Dubai'];

export default function Settings() {
  const { profile, setProfile } = useStore();
  const [form, setForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    language: 'en',
    work_start: '09:00',
    work_end: '18:00',
    phone: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name:       profile.name || '',
        timezone:   profile.timezone || 'Asia/Kolkata',
        language:   profile.language || 'en',
        work_start: profile.work_start || '09:00',
        work_end:   profile.work_end || '18:00',
        phone:      profile.phone || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await userApi.updateProfile(form);
      setProfile(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Syne'] font-black text-2xl text-white flex items-center gap-2">
          <SettingsIcon size={20} className="text-gray-400" />
          Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Configure your AI agent preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="card space-y-4">
          <h2 className="font-['Syne'] font-bold text-sm text-white border-b border-white/5 pb-3">Profile</h2>

          <Field label="Your Name">
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
            />
          </Field>

          <Field label="Phone (WhatsApp)">
            <input
              className="input"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91XXXXXXXXXX (with country code)"
            />
          </Field>
        </div>

        {/* Schedule */}
        <div className="card space-y-4">
          <h2 className="font-['Syne'] font-bold text-sm text-white border-b border-white/5 pb-3">Schedule & Timezone</h2>

          <Field label="Timezone">
            <select
              className="input"
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work Start">
              <input
                type="time"
                className="input"
                value={form.work_start}
                onChange={e => setForm(f => ({ ...f, work_start: e.target.value }))}
              />
            </Field>
            <Field label="Work End">
              <input
                type="time"
                className="input"
                value={form.work_end}
                onChange={e => setForm(f => ({ ...f, work_end: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        {/* API Keys Info */}
        <div className="card space-y-3">
          <h2 className="font-['Syne'] font-bold text-sm text-white border-b border-white/5 pb-3">API Configuration</h2>
          <p className="text-xs text-gray-500">API keys are configured via the <code className="text-brand font-mono">.env</code> file in your project root. See <code className="font-mono text-gray-300">.env.example</code> for all required variables.</p>
          <div className="space-y-2">
            {[
              { key: 'ANTHROPIC_API_KEY', desc: 'Claude AI — required for agent brain' },
              { key: 'TELEGRAM_BOT_TOKEN', desc: 'Telegram — get from @BotFather' },
              { key: 'WA_TOKEN', desc: 'WhatsApp — from Meta Developer Console' },
              { key: 'GOOGLE_CLIENT_ID', desc: 'Google Calendar integration' },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-start gap-3 py-2 border-t border-white/5">
                <code className="text-xs font-mono text-brand shrink-0 mt-0.5">{key}</code>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              saved
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'btn-primary'
            }`}
          >
            {saved ? (
              <><CheckCircle size={14} /> Saved!</>
            ) : loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><Save size={14} /> Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
