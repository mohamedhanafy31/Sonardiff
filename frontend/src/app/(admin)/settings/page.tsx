'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

type Config = Record<string, string>;

const FLAG_KEYS = ['dom_picker_enabled', 'discovery_enabled', 'registration_open', 'manual_check_enabled', 'maintenance_mode'] as const;
const FLAG_LABELS: Record<typeof FLAG_KEYS[number], { label: string; desc: string }> = {
  dom_picker_enabled: { label: 'DOM Picker', desc: 'If off, Pro users see "temporarily disabled" on the DOM picker page.' },
  discovery_enabled: { label: 'Site Discovery', desc: 'If off, the site discovery crawl endpoint returns 503.' },
  registration_open: { label: 'Registration Open', desc: 'If off, new user registration returns 503 with a maintenance message.' },
  manual_check_enabled: { label: 'Manual Checks', desc: 'If off, the "Check Now" button is disabled for all users.' },
  maintenance_mode: { label: 'Maintenance Mode', desc: 'Disables registration + manual checks and shows a banner to all users.' },
};

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<Config>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [freeLimitInput, setFreeLimitInput] = useState('');
  const [proLimitInput, setProLimitInput] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const c = await adminApi.get<Config>('/config');
      setConfig(c);
      setFreeLimitInput(c.free_plan_limit ?? '150');
      setProLimitInput(c.pro_plan_limit ?? '36000');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleFlag = async (key: string, value: boolean) => {
    try {
      const updated = await adminApi.patch<Config>('/config', { [key]: String(value) });
      setConfig(updated);
      if (key === 'maintenance_mode' && value) {
        // Also set registration_open and manual_check_enabled to false
        const mm = await adminApi.patch<Config>('/config', { registration_open: 'false', manual_check_enabled: 'false' });
        setConfig(mm);
      }
      setMsg('Settings saved');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const savePlanLimits = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.patch<Config>('/config', {
        free_plan_limit: freeLimitInput,
        pro_plan_limit: proLimitInput,
      });
      setConfig(updated);
      setMsg('Plan limits saved');
      setTimeout(() => setMsg(''), 3000);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Settings</h1>
          <p className="text-ink-4 text-[13.5px] mt-1">Feature flags and plan configuration</p>
        </div>
        {msg && <span className="text-[12.5px] text-green">{msg}</span>}
      </div>

      {/* Feature flags */}
      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h3 className="font-semibold text-[14px]">Feature Flags</h3>
          <p className="text-ink-4 text-[12.5px] mt-0.5">Changes take effect immediately without server restart.</p>
        </div>
        <div className="divide-y divide-line">
          {FLAG_KEYS.map(key => {
            const isOn = config[key] !== 'false';
            const meta = FLAG_LABELS[key];
            const isMaintenance = key === 'maintenance_mode';
            return (
              <div key={key} className={cn('px-5 py-4 flex items-center justify-between', isMaintenance && 'bg-red/5')}>
                <div>
                  <div className={cn('font-medium text-[13.5px]', isMaintenance && 'text-red')}>{meta.label}</div>
                  <div className="text-ink-4 text-[12.5px] mt-0.5">{meta.desc}</div>
                </div>
                <button
                  onClick={() => toggleFlag(key, !isOn)}
                  className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200',
                    isOn ? (isMaintenance ? 'bg-red border-red' : 'bg-accent border-accent') : 'bg-line border-transparent')}
                >
                  <span className={cn('pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200',
                    isOn ? 'translate-x-5' : 'translate-x-0')} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan limits */}
      <div className="bg-bg-card border border-line rounded-[14px] p-6">
        <h3 className="font-semibold text-[14px] mb-1">Plan Check Limits</h3>
        <p className="text-ink-4 text-[12.5px] mb-5">Applies to new registrations and plan changes only. Does not retroactively update existing users.</p>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-[12.5px] font-medium text-ink-3 mb-1.5">Free plan (checks/month)</label>
            <input type="number" value={freeLimitInput} onChange={e => setFreeLimitInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-soft border border-line text-[13.5px] text-foreground focus:outline-none focus:border-accent/40" />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ink-3 mb-1.5">Pro plan (checks/month)</label>
            <input type="number" value={proLimitInput} onChange={e => setProLimitInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-bg-soft border border-line text-[13.5px] text-foreground focus:outline-none focus:border-accent/40" />
          </div>
        </div>
        <button onClick={savePlanLimits} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Plan Limits
        </button>
      </div>

      {/* Maintenance mode detail */}
      {config.maintenance_mode === 'true' && (
        <div className="bg-red/10 border border-red/30 rounded-[14px] p-5">
          <h3 className="font-semibold text-red text-[14px] mb-2">Maintenance Mode Active</h3>
          <p className="text-red/80 text-[13px]">Registration and manual checks are disabled. A maintenance banner is shown on the user dashboard.</p>
          <button onClick={() => toggleFlag('maintenance_mode', false)} className="mt-3 px-4 py-1.5 rounded-lg bg-red/20 border border-red/30 text-red text-[13px] font-medium hover:bg-red/25 transition-colors">
            Disable Maintenance Mode
          </button>
        </div>
      )}
    </div>
  );
}
