import React, { useEffect, useState, useMemo } from 'react';
import {
  Users, TrendingUp, BookmarkCheck, Search, RefreshCw,
  ShieldCheck, Mail, Building2, Briefcase, Calendar,
  ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle,
  Copy, Check, X, Trash2, Play, Pause, Clock, Lock, Unlock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  listAllUsers,
  AdminUserRecord,
  setUserSuspension,
  getUserLoginHistory,
  getUserSearchHistory,
  getUserSavedReports,
  purgeUserData
} from '../lib/adminFirestore';
import { cn } from '../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortField = 'name' | 'email' | 'company' | 'role' | 'createdAt';
type SortDir   = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ms: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtTime(ms: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getMonthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent = false }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col gap-3 p-5 rounded-2xl border',
      accent
        ? 'bg-zinc-100 border-zinc-200 text-zinc-900'
        : 'bg-zinc-900/60 border-zinc-800 text-zinc-100',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-bold uppercase tracking-widest', accent ? 'text-zinc-500' : 'text-zinc-500')}>
          {label}
        </span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
          accent ? 'bg-zinc-200' : 'bg-zinc-800')}>
          <Icon className={cn('w-4 h-4', accent ? 'text-zinc-700' : 'text-zinc-400')} />
        </div>
      </div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-500 truncate">{sub}</p>}
    </div>
  );
}

// ── Sortable Header ───────────────────────────────────────────────────────────

function Th({ label, field, sort, dir, onSort }: {
  label: string; field: SortField;
  sort: SortField; dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sort === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-widest cursor-pointer select-none hover:text-zinc-300 transition-colors whitespace-nowrap"
    >
      <span className="flex items-center gap-1.5">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp className="w-3 h-3 text-zinc-300" /> : <ChevronDown className="w-3 h-3 text-zinc-300" />)
          : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}

// ── Copy cell ─────────────────────────────────────────────────────────────────

function CopyCell({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}
      className="group flex items-center gap-1.5 text-left"
      title="Copy"
    >
      <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors truncate max-w-[180px]">{text || '—'}</span>
      {text && (copied
        ? <Check className="w-3 h-3 text-emerald-400 shrink-0" />
        : <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
      )}
    </button>
  );
}

// ── Role pill ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  researcher:      'bg-blue-950 border-blue-800 text-blue-300',
  clinician:       'bg-violet-950 border-violet-800 text-violet-300',
  pharmacovigilance: 'bg-indigo-950 border-indigo-800 text-indigo-300',
  regulatory:      'bg-amber-950 border-amber-800 text-amber-300',
  industry:        'bg-emerald-950 border-emerald-800 text-emerald-300',
  student:         'bg-zinc-900 border-zinc-700 text-zinc-400',
};

function RolePill({ role }: { role: string }) {
  const cls = ROLE_COLORS[role?.toLowerCase()] ?? 'bg-zinc-900 border-zinc-700 text-zinc-400';
  return (
    <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize', cls)}>
      {role || '—'}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [users, setUsers]       = useState<AdminUserRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);

  // Table controls
  const [search, setSearch]     = useState('');
  const [sort, setSort]         = useState<SortField>('createdAt');
  const [dir, setDir]           = useState<SortDir>('desc');
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 20;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await listAllUsers();
      setUsers(data);
      if (selectedUser) {
        const updated = data.find(u => u.uid === selectedUser.uid);
        if (updated) setSelectedUser(updated);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users. Check that the admins/{uid} document exists in Firestore.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalUsers  = users.length;
  const newest      = users.length ? fmtDate(Math.max(...users.map(u => u.createdAt))) : '—';
  const latestUser  = users.length ? users.reduce((a, b) => a.createdAt > b.createdAt ? a : b) : null;

  // ── Growth chart ──────────────────────────────────────────────────────────

  const growthData = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      if (!u.createdAt) return;
      const k = getMonthKey(u.createdAt);
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({ month: getMonthLabel(k), users: v }));
  }, [users]);

  // ── Filtered + sorted users ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? users.filter(u =>
          [u.firstName, u.lastName, u.email, u.company, u.role]
            .some(f => f?.toLowerCase().includes(q))
        )
      : [...users];

    list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sort) {
        case 'name':      av = `${a.firstName} ${a.lastName}`; bv = `${b.firstName} ${b.lastName}`; break;
        case 'email':     av = a.email;      bv = b.email;     break;
        case 'company':   av = a.company;    bv = b.company;   break;
        case 'role':      av = a.role;       bv = b.role;      break;
        case 'createdAt': av = a.createdAt;  bv = b.createdAt; break;
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  }, [users, search, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (f: SortField) => {
    if (sort === f) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(f); setDir('asc'); }
    setPage(1);
  };

  // ── Roles breakdown ────────────────────────────────────────────────────────

  const roleBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { if (u.role) counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([role, count]) => ({ role, count }));
  }, [users]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-4 h-4 text-zinc-900" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-zinc-100">Admin Dashboard</h2>
            <p className="text-[11px] text-zinc-600">michswo@gmail.com · biogrid-app</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="flex-1 px-8 py-6 space-y-8">

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-800/60 bg-amber-950/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300 mb-1">Failed to load data</p>
              <p className="text-xs text-amber-600/80">{error}</p>
              <p className="text-xs text-amber-700/60 mt-2">
                Make sure you've run <code className="bg-amber-950/50 px-1 rounded text-amber-400 text-[10px]">node scripts/bootstrap-admin.mjs</code> to create your admin record.
              </p>
            </div>
          </div>
        )}

        {/* Stat cards */}
        {!loading && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={Users}        label="Total Users"   value={totalUsers}  sub="registered accounts"       accent />
            <StatCard icon={TrendingUp}   label="New This Month" value={growthData.at(-1)?.users ?? 0}  sub={`of ${totalUsers} total`} />
            <StatCard icon={Calendar}     label="Latest Signup" value={newest}      sub={latestUser ? `${latestUser.firstName} ${latestUser.lastName}` : ''} />
            <StatCard icon={Building2}    label="Companies"     value={new Set(users.map(u => u.company).filter(Boolean)).size} sub="unique organisations" />
          </div>
        )}

        {/* Growth chart */}
        {!loading && growthData.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200">User Growth</h3>
              <span className="text-[11px] text-zinc-600">Last 12 months</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={growthData} barCategoryGap="40%">
                <CartesianGrid vertical={false} stroke="#27272a" />
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e4e4e7' }}
                  itemStyle={{ color: '#a1a1aa' }}
                />
                <Bar dataKey="users" fill="#e4e4e7" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Role breakdown */}
        {!loading && roleBreakdown.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-bold text-zinc-200 mb-4">Roles</h3>
            <div className="flex flex-wrap gap-2">
              {roleBreakdown.map(({ role, count }) => (
                <div key={role} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900">
                  <RolePill role={role} />
                  <span className="text-xs font-bold text-zinc-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {/* Table header + search */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-200">
              Registered Users
              {filtered.length !== totalUsers && (
                <span className="ml-2 text-xs font-normal text-zinc-600">({filtered.length} of {totalUsers})</span>
              )}
            </h3>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users…"
              className="w-48 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
                <p className="text-sm text-zinc-600">Loading users…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-600">No users found</p>
              {!error && (
                <p className="text-xs text-zinc-700 mt-1">
                  Run <code className="text-zinc-600 text-[10px] bg-zinc-900 px-1 rounded">node scripts/bootstrap-admin.mjs</code> to backfill existing users
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-800">
                    <tr>
                      <Th label="Name"     field="name"      sort={sort} dir={dir} onSort={handleSort} />
                      <Th label="Email"    field="email"     sort={sort} dir={dir} onSort={handleSort} />
                      <Th label="Company"  field="company"   sort={sort} dir={dir} onSort={handleSort} />
                      <Th label="Role"     field="role"      sort={sort} dir={dir} onSort={handleSort} />
                      <Th label="Joined"   field="createdAt" sort={sort} dir={dir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {paginated.map((u, i) => (
                      <tr
                        key={u.uid}
                        onClick={() => setSelectedUser(u)}
                        className={cn(
                          'hover:bg-zinc-800/30 transition-colors cursor-pointer',
                          i % 2 === 0 ? '' : 'bg-zinc-900/20',
                          selectedUser?.uid === u.uid && 'bg-zinc-800/40 border-l-2 border-zinc-400'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-300 shrink-0">
                              {(u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '') || '?'}
                            </div>
                            <span className="text-zinc-200 font-medium truncate max-w-[120px] flex items-center gap-1.5">
                              {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                              {u.paused && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-950/60 border border-red-900/80 text-red-400 uppercase tracking-wider">
                                  Suspended
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CopyCell text={u.email} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-zinc-400 truncate max-w-[140px] block">{u.company || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <RolePill role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-zinc-500 text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 text-xs text-zinc-500">
                  <span>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition-colors"
                    >←</button>
                    <span className="px-3 py-1">{page} / {totalPages}</span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 disabled:opacity-40 transition-colors"
                    >→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Security notice */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            This dashboard is secured by two independent layers: your email address must be{' '}
            <code className="text-zinc-500 text-[10px] bg-zinc-900 px-1 rounded">michswo@gmail.com</code>, and your UID must exist in the{' '}
            <code className="text-zinc-500 text-[10px] bg-zinc-900 px-1 rounded">admins</code> Firestore collection.
            That collection is write-protected by server-side Firestore rules — it can only be modified via Firebase Console or Admin SDK.
          </p>
        </div>

      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusChanged={() => load(true)}
        />
      )}
    </div>
  );
}

// ── User Detail Modal ─────────────────────────────────────────────────────────

interface UserDetailModalProps {
  user: AdminUserRecord;
  onClose: () => void;
  onStatusChanged: () => void;
}

function UserDetailModal({ user, onClose, onStatusChanged }: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'searches' | 'saved' | 'logins'>('overview');
  const [logins, setLogins]       = useState<any[]>([]);
  const [searches, setSearches]   = useState<any[]>([]);
  const [saved, setSaved]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const [lData, sData, rData] = await Promise.all([
        getUserLoginHistory(user.uid),
        getUserSearchHistory(user.uid),
        getUserSavedReports(user.uid),
      ]);
      setLogins(lData);
      setSearches(sData);
      setSaved(rData);
    } catch (e) {
      console.error('Failed to load user audits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
    setShowDeleteConfirm(false);
    setDeleteInput('');
  }, [user.uid]);

  const handleTogglePause = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await setUserSuspension(user.uid, !user.paused);
      onStatusChanged();
    } catch (e) {
      alert('Error updating user status. Ensure you have network connectivity.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteInput !== 'DELETE' || actionLoading) return;
    setActionLoading(true);
    try {
      await purgeUserData(user.uid);
      onStatusChanged();
      onClose();
    } catch (e) {
      alert('Error deleting user data. Check rules permissions.');
      setActionLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-zinc-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[90vh] flex flex-col border border-zinc-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-650 to-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-black text-zinc-100 shadow-inner">
              {(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '') || '?'}
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 leading-snug flex items-center gap-2">
                {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'User Record'}
                {user.paused && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-950/80 border border-red-800 text-red-400 uppercase tracking-wider">
                    Suspended
                  </span>
                )}
              </h3>
              <span className="text-xs text-zinc-500 block truncate max-w-[280px]">{user.email}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950 sticky top-0 z-10 shrink-0 text-xs">
          {(['overview', 'searches', 'saved', 'logins'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 font-semibold border-b-2 capitalize transition-all -mb-px',
                activeTab === tab
                  ? 'border-zinc-100 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {tab === 'searches' ? 'Search History' : tab === 'saved' ? 'Saved Reports' : tab === 'logins' ? 'Login History' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-5 h-5 text-zinc-700 animate-spin" />
              <p className="text-xs text-zinc-500">Loading audit records…</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left part: Profile details */}
                    <div className="md:col-span-2 space-y-4">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Profile Information</h4>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-zinc-900/30 border border-zinc-800 rounded-xl p-5">
                        <div className="col-span-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-0.5">User ID (UID)</span>
                          <span className="text-xs font-mono text-zinc-300 select-all block break-all">{user.uid}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-0.5">Company / Affiliation</span>
                          <span className="text-sm font-semibold text-zinc-200">{user.company || 'Not Specified'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-0.5">Professional Role</span>
                          <span className="block mt-1"><RolePill role={user.role} /></span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-0.5">Joined Date</span>
                          <span className="text-xs text-zinc-400">{fmtTime(user.createdAt)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-0.5">Account Status</span>
                          <span className="flex items-center gap-1.5 mt-1">
                            <span className={cn('w-2 h-2 rounded-full', user.paused ? 'bg-red-500 animate-pulse' : 'bg-emerald-500')} />
                            <span className={cn('text-xs font-bold uppercase tracking-wider', user.paused ? 'text-red-400' : 'text-emerald-400')}>
                              {user.paused ? 'Suspended' : 'Active'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right part: Usage & Stats */}
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Usage Summary</h4>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Sessions</p>
                              <p className="text-xs text-zinc-400">Logins logged</p>
                            </div>
                          </div>
                          <span className="text-xl font-black text-zinc-200">{logins.length}</span>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                              <Search className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Searches</p>
                              <p className="text-xs text-zinc-400">FDA queries</p>
                            </div>
                          </div>
                          <span className="text-xl font-black text-zinc-200">{searches.length}</span>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
                              <BookmarkCheck className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Saved Reports</p>
                              <p className="text-xs text-zinc-400">In private folders</p>
                            </div>
                          </div>
                          <span className="text-xl font-black text-zinc-200">{saved.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Last Active details */}
                  {logins.length > 0 && (
                    <div className="border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between text-xs bg-zinc-900/20">
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div>
                          <span className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] block">Last Activity Logged</span>
                          <span className="text-zinc-300 font-semibold">{fmtTime(logins[0].timestamp)}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full font-mono">
                        {logins[0].browser} ({logins[0].os})
                      </span>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="border border-zinc-800 bg-zinc-900/20 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Moderation Controls</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Pause/Suspend Action */}
                      <button
                        onClick={handleTogglePause}
                        disabled={actionLoading}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-50',
                          user.paused
                            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-950/60'
                            : 'bg-red-950/40 border-red-800/80 text-red-400 hover:bg-red-950/60'
                        )}
                      >
                        {user.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        {user.paused ? 'Reactivate User Account' : 'Suspend / Pause Account'}
                      </button>

                      {/* Purge/Delete Action */}
                      {!showDeleteConfirm ? (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-900 bg-red-950/20 text-red-500 hover:bg-red-950/40 text-xs font-bold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge User Database
                        </button>
                      ) : (
                        <div className="flex-1 border border-red-900/60 bg-red-950/10 rounded-lg p-3 space-y-3">
                          <p className="text-[10px] text-red-400 leading-normal font-semibold">
                            ⚠️ WARNING: Permanently delete all profile, searches, and saved reports. This is irreversible.
                          </p>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={deleteInput}
                              onChange={e => setDeleteInput(e.target.value)}
                              placeholder="Type DELETE"
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-red-400 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-900 transition"
                            />
                            <button
                              onClick={handleDeleteUser}
                              disabled={deleteInput !== 'DELETE' || actionLoading}
                              className="py-1.5 px-3 rounded bg-red-700 hover:bg-red-650 text-white font-bold text-[10px] disabled:opacity-40 transition-all uppercase"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                              className="px-2 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold text-[10px] transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SEARCH HISTORY TAB */}
              {activeTab === 'searches' && (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {searches.length === 0 ? (
                    <p className="text-center text-xs text-zinc-600 py-10 italic">No search history recorded</p>
                  ) : (
                    searches.map(item => (
                      <div key={item.id} className="p-3 border border-zinc-900 rounded-xl bg-zinc-900/20 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider',
                            item.category === 'device' ? 'bg-amber-950 border-amber-800 text-amber-300' :
                            item.category === 'drug' ? 'bg-blue-950 border-blue-800 text-blue-300' :
                            item.category === 'food' ? 'bg-red-950 border-red-800 text-red-300' :
                            'bg-zinc-900 border-zinc-700 text-zinc-400'
                          )}>
                            {item.category}
                          </span>
                          <span className="text-[10px] text-zinc-500">{fmtTime(item.timestamp)}</span>
                        </div>
                        <p className="text-zinc-200 font-bold break-all bg-zinc-900/60 px-2 py-1 rounded font-mono text-[10.5px]">
                          {item.query || '—'}
                        </p>
                        {item.filters && Object.keys(item.filters).some(k => item.filters[k]) && (
                          <div className="mt-2 text-[10px] text-zinc-500 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-850 pt-1.5">
                            {item.filters.searchField && <span>Field: {item.filters.searchField}</span>}
                            {item.filters.startDate && <span>Since: {item.filters.startDate}</span>}
                            {item.filters.endDate && <span>Until: {item.filters.endDate}</span>}
                            {item.filters.limit && <span>Limit: {item.filters.limit}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SAVED REPORTS TAB */}
              {activeTab === 'saved' && (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {saved.length === 0 ? (
                    <p className="text-center text-xs text-zinc-600 py-10 italic">No saved reports found</p>
                  ) : (
                    saved.map(report => (
                      <div key={report.id} className="p-4 border border-zinc-900 rounded-xl bg-zinc-900/20 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-300 truncate max-w-[480px]">
                            {report.title}
                          </span>
                          <span className="text-[9px] text-zinc-500">{fmtDate(report.savedAt)}</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] line-clamp-2">{report.summary}</p>
                        {report.notes && (
                          <div className="bg-zinc-950/60 border border-zinc-850 rounded p-2 text-[10.5px] italic text-zinc-500">
                            {report.notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* LOGIN HISTORY TAB */}
              {activeTab === 'logins' && (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {logins.length === 0 ? (
                    <p className="text-center text-xs text-zinc-600 py-10 italic">No login history recorded</p>
                  ) : (
                    logins.map(login => (
                      <div key={login.id} className="p-3 border border-zinc-900 rounded-xl bg-zinc-900/20 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-zinc-300">{fmtTime(login.timestamp)}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[400px]" title={login.userAgent}>
                            {login.userAgent}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-zinc-400 text-[10px] font-bold uppercase shrink-0 text-center">
                          {login.browser}
                          <span className="block text-[8px] font-medium text-zinc-600 normal-case">{login.os}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
