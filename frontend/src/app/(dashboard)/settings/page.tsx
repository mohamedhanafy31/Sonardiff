'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Check, Copy, RefreshCw, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PasswordInput } from '@/components/PasswordInput';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, checkAuth, setUser, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (user) {
      reset({ name: user.name, email: user.email });
      // Only set from user when we don't have a locally-generated token yet
      if (!apiToken && user.apiToken) {
        setApiToken(user.apiToken);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reset]);

  const onUpdateProfile = async (data: ProfileForm) => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const payload: any = { name: data.name, email: data.email };
      if (data.password) payload.password = data.password;
      await api.patch('/auth/me', payload);
      // Optimistic update so sidebar reflects new name immediately
      if (user) setUser({ ...user, name: data.name, email: data.email });
      await checkAuth();
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    setIsGeneratingToken(true);
    try {
      const { data } = await api.post('/auth/api-token');
      setApiToken(data.apiToken);
      await checkAuth();
    } catch {
      console.error('Failed to generate token');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const copyToken = () => {
    if (!apiToken) return;
    navigator.clipboard.writeText(apiToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await api.delete('/auth/me');
      logout();
      window.location.href = '/login';
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Settings</h1>
        <div className="text-ink-3 text-[14.5px] mt-1">Manage your account, security, and API access.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <section className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">Profile information</h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmit(onUpdateProfile)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <label htmlFor="settings-name" className="text-[13px] font-medium text-ink-2">Full name</label>
                    <input
                      {...register('name')}
                      id="settings-name"
                      type="text"
                      className="h-10 px-3 border border-line rounded-[10px] bg-bg-card text-[14px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                    />
                    {errors.name && <p className="text-red-ink text-xs">{errors.name.message}</p>}
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="settings-email" className="text-[13px] font-medium text-ink-2">Email</label>
                    <input
                      {...register('email')}
                      id="settings-email"
                      type="email"
                      className="h-10 px-3 border border-line rounded-[10px] bg-bg-card text-[14px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                    />
                    {errors.email && <p className="text-red-ink text-xs">{errors.email.message}</p>}
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="settings-password" className="text-[13px] font-medium text-ink-2">
                    New password
                    <span className="text-ink-4 font-normal ml-1">(leave blank to keep current)</span>
                  </label>
                  <PasswordInput
                    {...register('password')}
                    id="settings-password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-10 px-3 border border-line rounded-[10px] bg-bg-card text-[14px] text-foreground focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/18 transition-all"
                  />
                  {errors.password && <p className="text-red-ink text-xs">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    {success && (
                      <div className="text-green-ink text-[13px] flex items-center gap-1.5">
                        <Check className="w-4 h-4 shrink-0" /> {success}
                      </div>
                    )}
                    {error && <div className="text-red-ink text-[13px]">{error}</div>}
                  </div>
                  <button type="submit" disabled={loading} className="btn accent sm disabled:opacity-50 flex items-center gap-2">
                    {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* API Access */}
          <section className="bg-bg-card border border-line rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold">API access</h3>
            </div>
            <div className="p-5">
              <p className="text-[13px] text-ink-3 mb-4">
                Use your API token to programmatically trigger checks or fetch diff results.
              </p>

              <div className="bg-bg-muted border border-line rounded-[10px] p-3.5 flex items-center justify-between font-mono text-[13px] mb-4">
                <div className="truncate flex-1 text-[#CBD5E1] mr-3">
                  {apiToken || <span className="text-[#64748B]">No token generated yet</span>}
                </div>
                {apiToken && (
                  <button onClick={copyToken} className="p-1.5 text-[#64748B] hover:text-white rounded transition-colors shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5 text-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <button
                onClick={generateToken}
                disabled={isGeneratingToken}
                className="flex items-center gap-2 btn ghost sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate / Rotate Token"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isGeneratingToken && "animate-spin")} />
                {apiToken ? 'Rotate token' : 'Generate token'}
              </button>

              <div className="mt-4 bg-bg-soft border border-line rounded-[10px] p-3.5 text-xs">
                <div className="text-ink-4 font-semibold uppercase tracking-[0.08em] mb-2">Example usage</div>
                <code className="block text-accent-2 bg-bg-muted text-[12px] p-2.5 rounded-lg overflow-x-auto whitespace-pre font-mono">
                  {`curl -X POST /api/monitors/:id/check \\
  -H "Authorization: Bearer ${apiToken || 'YOUR_TOKEN'}"`}
                </code>
              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Plan card */}
          <div className="bg-bg-card border border-line rounded-[14px] p-5">
            <h4 className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold mb-3">Your plan</h4>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-display text-[28px] font-semibold tracking-tight capitalize">{user?.plan}</span>
            </div>
            <p className="text-[13px] text-ink-3 mb-4">
              <span className="font-medium text-foreground">{user?.planLimit?.toLocaleString()}</span> checks per month
            </p>
            {user?.plan === 'free' && (
              <button className="btn accent w-full">Upgrade to Pro</button>
            )}
          </div>

          {/* Danger zone */}
          <div className="bg-red-bg/50 border border-red/10 rounded-[14px] p-5">
            <h4 className="text-[13px] font-semibold text-red-ink mb-1.5">Danger zone</h4>
            <p className="text-xs text-ink-4 mb-4">Once you delete your account, there is no going back.</p>

            {showDeleteConfirm ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-ink text-xs bg-red-bg p-2.5 rounded-[10px] border border-red/20">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Type &quot;DELETE&quot; to confirm
                </div>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmValue}
                  onChange={(e) => setDeleteConfirmValue(e.target.value)}
                  className="w-full h-9 px-3 border border-red/20 rounded-lg bg-bg-card text-[13px] text-foreground focus:outline-none focus:border-red"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmValue !== 'DELETE'}
                    className="flex-1 h-8 bg-red hover:bg-red/90 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete permanently'}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmValue(''); }}
                    className="flex-1 btn ghost sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 h-9 border border-red/20 hover:bg-red-bg text-red-ink text-[13px] font-medium rounded-[10px] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
