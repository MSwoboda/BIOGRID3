// src/components/ProfileModal.tsx
import React, { useState, useEffect } from 'react';
import { X, User, Shield, AlertTriangle, LogOut, Loader2, Check, Eye, EyeOff, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../lib/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import GlyphAvatar from './GlyphAvatar';

const ROLES = [
  'Researcher / Scientist',
  'Clinician / Healthcare Provider',
  'Regulator / Government',
  'Industry / Pharma / MedTech',
  'Student',
  'Journalist / Media',
  'Legal / Compliance',
  'Other',
];

interface Props {
  open: boolean;
  onClose: () => void;
  user: FirebaseUser;
  profile: UserProfile | null;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onDeleteAccount: (currentPassword?: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

type Tab = 'profile' | 'security' | 'account';

export default function ProfileModal({
  open, onClose, user, profile, onSaveProfile, onChangePassword, onResetPassword, onDeleteAccount, onSignOut,
}: Props) {
  const [tab, setTab]           = useState<Tab>('profile');
  const [saving, setSaving]     = useState(false);
  const [saveOk, setSaveOk]     = useState(false);
  const [error, setError]       = useState('');
  const [confirm, setConfirm]   = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [delPw, setDelPw]       = useState('');

  // Profile fields
  const [firstName, setFirst]   = useState(profile?.firstName ?? '');
  const [lastName, setLast]     = useState(profile?.lastName  ?? '');
  const [company, setCompany]   = useState(profile?.company   ?? '');
  const [role, setRole]         = useState(profile?.role      ?? '');
  const [marketing, setMkt]     = useState(profile?.marketingConsent ?? false);
  const [avatarSeed, setAvatarSeed] = useState(profile?.avatarSeed ?? '');

  // Password fields
  const [curPw, setCurPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confPw, setConfPw]     = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [pwOk, setPwOk]         = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Sync profile data when it loads/changes
  useEffect(() => {
    if (profile) {
      setFirst(profile.firstName);
      setLast(profile.lastName);
      setCompany(profile.company ?? '');
      setRole(profile.role ?? '');
      setMkt(profile.marketingConsent ?? false);
      setAvatarSeed(profile.avatarSeed ?? '');
    }
  }, [profile]);

  if (!open) return null;

  const isEmailUser = user.providerData.some(p => p.providerId === 'password');
  const initials = profile
    ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()
    : (user.email?.[0] ?? 'U').toUpperCase();
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : (user.displayName ?? user.email ?? 'User');

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required'); return; }
    setSaving(true); setError(''); setSaveOk(false);
    try {
      await onSaveProfile({
        uid: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim(),
        role,
        agreedToTerms: profile?.agreedToTerms ?? true,
        termsAgreedAt: profile?.termsAgreedAt ?? Date.now(),
        marketingConsent: marketing,
        createdAt: profile?.createdAt ?? Date.now(),
        avatarSeed: avatarSeed || '',
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setError('');
    if (!curPw || !newPw || !confPw) { setError('Please fill in all password fields'); return; }
    if (newPw !== confPw) { setError('New passwords do not match'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      await onChangePassword(curPw, newPw);
      setPwOk(true);
      setCurPw(''); setNewPw(''); setConfPw('');
      setTimeout(() => setPwOk(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Failed to change password. Make sure your current password is correct.');
    }
    setPwLoading(false);
  };

  const handleDeleteAccount = async () => {
    setDelLoading(true); setError('');
    try {
      await onDeleteAccount(isEmailUser ? delPw : undefined);
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete account');
      setDelLoading(false);
    }
  };

  const TAB_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile',  label: 'Profile',  icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'account',  label: 'Account',  icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="w-10 h-10 rounded-full ring-2 ring-zinc-700" />
            ) : (
              <GlyphAvatar seed={avatarSeed || user.uid || user.email || 'user'} size={40} className="ring-2 ring-zinc-700" />
            )}
            <div>
              <p className="text-sm font-bold text-zinc-100">{displayName}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-zinc-800 shrink-0 px-2 pt-2">
          {TAB_ITEMS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setSaveOk(false); setPwOk(false); }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px',
                tab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <div className="space-y-4">
              {/* Avatar section — only when no profile photo */}
              {!user.photoURL && (
                <div className="flex items-center gap-4 p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl">
                  <GlyphAvatar seed={avatarSeed || user.uid || user.email || 'user'} size={56} className="ring-2 ring-zinc-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-300 mb-1">Avatar</p>
                    <p className="text-[11px] text-zinc-500 mb-2.5">Your unique geometric sigil. Regenerate for a new one.</p>
                    <button
                      type="button"
                      onClick={() => setAvatarSeed(`${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-500 text-[11px] font-semibold transition-all active:scale-95"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">First Name</label>
                  <input value={firstName} onChange={e => setFirst(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Last Name</label>
                  <input value={lastName} onChange={e => setLast(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Organization <span className="text-zinc-600">(optional)</span></label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your organization"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all">
                  <option value="">Select your role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-700 bg-zinc-800/40 cursor-pointer hover:border-zinc-600 transition-all">
                <input type="checkbox" checked={marketing} onChange={e => setMkt(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 accent-blue-600" />
                <span className="text-xs text-zinc-400">Receive product updates and research tips</span>
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {saveOk && (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Check className="w-4 h-4" /> Profile saved
                </div>
              )}

              <button onClick={handleSaveProfile} disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && (
            <div className="space-y-5">
              <div className="p-3 bg-zinc-800/50 border border-zinc-700/60 rounded-xl text-xs text-zinc-400">
                <p className="font-semibold text-zinc-300 mb-0.5">Email address</p>
                <p className="text-zinc-500">{user.email}</p>
              </div>

              {isEmailUser ? (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200 mb-4">Change Password</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Current Password', value: curPw, set: setCurPw, complete: 'current-password' },
                        { label: 'New Password',     value: newPw, set: setNewPw, complete: 'new-password' },
                        { label: 'Confirm New Password', value: confPw, set: setConfPw, complete: 'new-password' },
                      ].map(f => (
                        <div key={f.label}>
                          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">{f.label}</label>
                          <div className="relative">
                            <input
                              type={showPw ? 'text' : 'password'} value={f.value}
                              onChange={e => f.set(e.target.value)} autoComplete={f.complete}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 pr-10 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                            />
                            <button type="button" onClick={() => setShowPw(p => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
                    {pwOk && (
                      <div className="flex items-center gap-2 text-sm text-emerald-400 mt-3">
                        <Check className="w-4 h-4" /> Password changed
                      </div>
                    )}

                    <button onClick={handleChangePassword} disabled={pwLoading}
                      className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                      {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Update Password
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-zinc-800/40 border border-zinc-700/60 rounded-xl text-sm text-zinc-400">
                  <p className="font-semibold text-zinc-300 mb-1">Google account</p>
                  <p>Your account uses Google Sign-In. Password management is handled through your Google account.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNT TAB ── */}
          {tab === 'account' && (
            <div className="space-y-5">
              {/* Sign out */}
              <div>
                <h3 className="text-sm font-bold text-zinc-200 mb-3">Session</h3>
                <button onClick={onSignOut}
                  className="flex items-center gap-2 w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-semibold text-zinc-300 transition-all">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                  <ChevronRight className="w-4 h-4 ml-auto text-zinc-600" />
                </button>
              </div>

              {/* Profile info */}
              {profile && (
                <div className="p-3 bg-zinc-800/50 border border-zinc-700/60 rounded-xl text-xs text-zinc-500 space-y-1">
                  <p>Account created: <span className="text-zinc-400">{new Date(profile.createdAt).toLocaleDateString()}</span></p>
                  {profile.termsAgreedAt && (
                    <p>Terms accepted: <span className="text-zinc-400">{new Date(profile.termsAgreedAt).toLocaleDateString()}</span></p>
                  )}
                </div>
              )}

              {/* Danger zone */}
              <div className="border border-red-900/60 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-red-950/40 border-b border-red-900/60">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</p>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-zinc-500">Deleting your account permanently removes all your saved searches, saved reports, and profile data. This cannot be undone.</p>

                  {!confirm ? (
                    <button onClick={() => setConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-red-950/60 border border-zinc-700 hover:border-red-800 rounded-xl text-sm font-semibold text-zinc-400 hover:text-red-400 transition-all">
                      <AlertTriangle className="w-4 h-4" />
                      Delete Account
                    </button>
                  ) : (
                    <div className="space-y-3 p-3 bg-red-950/30 border border-red-900/40 rounded-xl">
                      <p className="text-xs font-semibold text-red-300">Are you absolutely sure? This is permanent.</p>
                      {isEmailUser && (
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1.5">Enter your password to confirm</label>
                          <input
                            type="password" value={delPw} onChange={e => setDelPw(e.target.value)}
                            placeholder="Current password" autoComplete="current-password"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-red-500 transition-all"
                          />
                        </div>
                      )}
                      {error && <p className="text-sm text-red-400">{error}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => { setConfirm(false); setDelPw(''); setError(''); }}
                          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-zinc-400 transition-all">
                          Cancel
                        </button>
                        <button onClick={handleDeleteAccount} disabled={delLoading || (isEmailUser && !delPw)}
                          className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-60 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5">
                          {delLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Delete Forever
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
