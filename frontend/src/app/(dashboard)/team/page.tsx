'use client';

import { useAuthStore } from '@/lib/store';

const roleMatrix = [
  { cap: 'View monitors & snapshots', owner: true, admin: true, viewer: true },
  { cap: 'Create / edit monitors', owner: true, admin: true, viewer: false },
  { cap: 'Manage exclusion rules & cadence', owner: true, admin: true, viewer: false },
  { cap: 'Invite & remove members', owner: true, admin: true, viewer: false },
  { cap: 'Change billing & plan', owner: true, admin: false, viewer: false },
  { cap: 'Delete workspace', owner: true, admin: false, viewer: false },
];

export default function TeamPage() {
  const { user } = useAuthStore();

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-5 mb-7">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Team</h1>
          <div className="text-ink-3 text-[14.5px] mt-1">Manage seats, roles and invites for your workspace.</div>
        </div>
        <button className="btn accent">+ Invite member</button>
      </div>

      {/* Seat summary */}
      <div className="bg-bg-card border border-line rounded-[14px] p-5 mb-5">
        <div className="flex gap-6 items-center flex-wrap">
          <div className="pr-6 border-r border-line">
            <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Seats used</div>
            <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none">
              1<span className="text-[14px] text-ink-4 font-medium font-sans tracking-normal"> / {user?.plan === 'pro' ? '5' : '1'}</span>
            </div>
          </div>
          <div className="pr-6 border-r border-line">
            <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Pending invites</div>
            <div className="font-display text-[28px] font-semibold tracking-tight mt-1 leading-none">0</div>
          </div>
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold">Roles</div>
            <div className="font-display text-[18px] font-semibold tracking-tight mt-1 leading-none">
              1<span className="text-[14px] text-ink-4 font-medium font-sans tracking-normal"> owner</span>
            </div>
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-bg-card border border-line rounded-[14px] overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-[14px] font-semibold">Members</h3>
          <span className="text-xs text-ink-4">1 active</span>
        </div>

        <div className="bg-bg-soft text-ink-4 text-[11.5px] uppercase tracking-[0.08em] font-semibold grid grid-cols-[1fr_130px_140px_130px] gap-3.5 px-5 py-2.5">
          <div>Member</div>
          <div>Role</div>
          <div>Last active</div>
          <div>2FA</div>
        </div>

        <div className="grid grid-cols-[1fr_130px_140px_130px] gap-3.5 px-5 py-3.5 items-center border-t border-line-soft">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-cyan-300 text-[#042F36] font-semibold text-[13px] flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-medium">
                {user?.name} <span className="text-[11px] text-ink-5 font-normal">(you)</span>
              </div>
              <div className="text-[12.5px] text-ink-4 font-mono truncate">{user?.email}</div>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-accent/10 border border-accent/30 text-accent-2">
              Owner
            </span>
          </div>
          <div className="text-[12.5px] text-ink-4 font-mono">Online now</div>
          <div>
            <span className="pill live text-[11px]"><span className="dot" />Enabled</span>
          </div>
        </div>
      </div>

      {/* Role matrix */}
      <div className="bg-bg-card border border-line rounded-[14px] p-5">
        <h3 className="text-[14px] font-semibold mb-4">What each role can do</h3>
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3.5 text-[11.5px] uppercase tracking-[0.08em] text-ink-4 font-semibold pb-2">
          <div>Capability</div>
          <div>Owner</div>
          <div>Admin</div>
          <div>Viewer</div>
        </div>
        {roleMatrix.map((row) => (
          <div key={row.cap} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3.5 py-2.5 border-t border-line-soft text-[13.5px] items-center">
            <div className="text-ink-3">{row.cap}</div>
            <div className={row.owner ? 'text-green-ink' : 'text-ink-5'}>{row.owner ? '✓' : '—'}</div>
            <div className={row.admin ? 'text-green-ink' : 'text-ink-5'}>{row.admin ? '✓' : '—'}</div>
            <div className={row.viewer ? 'text-green-ink' : 'text-ink-5'}>{row.viewer ? '✓' : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
