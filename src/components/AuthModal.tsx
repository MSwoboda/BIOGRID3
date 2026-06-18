// src/components/AuthModal.tsx
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import TermsModal from './TermsModal';

interface Props {
  open: boolean;
  onClose?: () => void;
  /** Google sign-in */
  onSignInGoogle: () => Promise<void>;
  /** Email sign-in */
  onSignInEmail: (email: string, password: string) => Promise<void>;
  /** Email sign-up */
  onSignUpEmail: (email: string, password: string) => Promise<void>;
  /** Password reset */
  onResetPassword: (email: string) => Promise<void>;
  authError: string | null;
  clearError: () => void;
}

type Screen = 'choose' | 'signin' | 'signup' | 'reset';

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthModal({
  open, onClose, onSignInGoogle, onSignInEmail, onSignUpEmail, onResetPassword, authError, clearError,
}: Props) {
  const [screen, setScreen]       = useState<Screen>('choose');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [localError, setLocalError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  if (!open) return null;

  const error = localError || authError || '';

  const go = (s: Screen) => { setLocalError(''); clearError(); setResetSent(false); setScreen(s); };

  const handleGoogle = async () => {
    setLoading(true); clearError(); setLocalError('');
    await onSignInGoogle();
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setLocalError('Please fill in all fields.'); return; }
    setLoading(true); setLocalError(''); clearError();
    await onSignInEmail(email, password);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirm) { setLocalError('Please fill in all fields.'); return; }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }
    if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    setLoading(true); setLocalError(''); clearError();
    await onSignUpEmail(email, password);
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setLocalError('Please enter your email address.'); return; }
    setLoading(true); setLocalError(''); clearError();
    try {
      await onResetPassword(email);
      setResetSent(true);
    } catch {
      // error already set by hook
    }
    setLoading(false);
  };

  return (
    <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

          {/* Ambient gradient */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-violet-600/10 blur-2xl pointer-events-none" />

          <div className="relative p-8">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                <span className="text-black font-black text-sm">B</span>
              </div>
              <span className="font-black text-zinc-100 tracking-[0.15em] text-xs uppercase">BIOGRID</span>
            </div>

            {/* ── CHOOSE SCREEN ── */}
            {screen === 'choose' && (
              <div>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Welcome</h2>
                <p className="text-zinc-500 text-sm mb-7">Sign in or create an account to continue</p>

                {error && (
                  <div className="flex items-start gap-2 mb-5 p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl text-sm font-semibold text-zinc-200 transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-xs text-zinc-600 font-medium">or</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  <button
                    onClick={() => go('signin')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all"
                  >
                    <Mail className="w-4 h-4" />
                    Sign in with Email
                  </button>

                  <button
                    onClick={() => go('signup')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl text-sm font-semibold text-zinc-300 transition-all"
                  >
                    Create an Account
                  </button>
                </div>

                <p className="text-center text-[11px] text-zinc-600 mt-6">
                  By continuing you agree to our{' '}
                  <button onClick={() => setShowTerms(true)} className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                    Terms of Use
                  </button>
                </p>
              </div>
            )}

            {/* ── SIGN IN SCREEN ── */}
            {screen === 'signin' && (
              <form onSubmit={handleSignIn} noValidate>
                <button type="button" onClick={() => go('choose')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-6 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Sign In</h2>
                <p className="text-zinc-500 text-sm mb-6">Welcome back</p>

                {error && (
                  <div className="flex items-start gap-2 mb-4 p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com" autoComplete="email"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-400">Password</label>
                      <button type="button" onClick={() => go('reset')} className="text-[11px] text-blue-500 hover:text-blue-400 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" autoComplete="current-password"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      />
                      <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In
                </button>

                <p className="text-center text-xs text-zinc-600 mt-4">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => go('signup')} className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">
                    Create one
                  </button>
                </p>
              </form>
            )}

            {/* ── SIGN UP SCREEN ── */}
            {screen === 'signup' && (
              <form onSubmit={handleSignUp} noValidate>
                <button type="button" onClick={() => go('choose')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-6 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Create Account</h2>
                <p className="text-zinc-500 text-sm mb-6">Free · Synced across all devices</p>

                {error && (
                  <div className="flex items-start gap-2 mb-4 p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div className="space-y-3 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com" autoComplete="email"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="At least 6 characters" autoComplete="new-password"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                      />
                      <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                        placeholder="Repeat password" autoComplete="new-password"
                        className={cn(
                          "w-full bg-zinc-800 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-all",
                          confirm && confirm !== password
                            ? "border-red-600 focus:border-red-500 focus:ring-red-500/20"
                            : "border-zinc-700 focus:border-blue-500 focus:ring-blue-500/30"
                        )}
                      />
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-[11px] text-red-400 mt-1 ml-1">Passwords do not match</p>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Account
                </button>

                <p className="text-center text-[11px] text-zinc-600 mt-4">
                  By creating an account you agree to our{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                    Terms of Use
                  </button>
                </p>

                <p className="text-center text-xs text-zinc-600 mt-2">
                  Already have an account?{' '}
                  <button type="button" onClick={() => go('signin')} className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* ── PASSWORD RESET SCREEN ── */}
            {screen === 'reset' && (
              <form onSubmit={handleReset} noValidate>
                <button type="button" onClick={() => go('signin')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-6 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Reset Password</h2>
                <p className="text-zinc-500 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

                {resetSent ? (
                  <div className="p-4 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-sm text-emerald-300 text-center">
                    ✉️ Check your inbox — a reset link has been sent to <strong>{email}</strong>
                  </div>
                ) : (
                  <>
                    {error && (
                      <div className="flex items-start gap-2 mb-4 p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-sm text-red-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {error}
                      </div>
                    )}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="email" value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com" autoComplete="email"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send Reset Link
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
