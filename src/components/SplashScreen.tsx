// src/components/SplashScreen.tsx
import React from 'react';
import { cn } from '../lib/utils';

interface Props {
  onSignIn: () => void;
  loading?: boolean;
  authError?: string | null;
}

const FEATURES = [
  {
    icon: '🔬',
    title: 'Device Adverse Events',
    desc: 'Search 10M+ FDA MDR reports. Filter by manufacturer, device type, problem codes.',
  },
  {
    icon: '💊',
    title: 'Drug Safety Data',
    desc: 'Explore drug adverse event reports, outcomes, and patient demographics.',
  },
  {
    icon: '📊',
    title: 'Visual Analytics',
    desc: 'Interactive charts, problem mind-maps, and patient outcome analytics.',
  },
  {
    icon: '📁',
    title: 'Saved & Organised',
    desc: 'Save reports to folders, add notes, and sync everything across devices.',
  },
];

export default function SplashScreen({ onSignIn, loading, authError }: Props) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-x-hidden">

      {/* ── Background gradient mesh ─────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-500/8 blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-black text-sm">B</span>
          </div>
          <span className="font-bold text-zinc-100 tracking-tight text-lg">BioGrid<span className="text-blue-400">3</span></span>
        </div>
        <button
          onClick={onSignIn}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition-all"
        >
          <GoogleIcon />
          Sign in
        </button>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold mb-8 shadow-lg shadow-blue-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          FDA Open Data Explorer — 10M+ reports
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-6 max-w-4xl">
          Understand{' '}
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            medical device
          </span>
          {' '}safety at scale
        </h1>

        {/* Subheadline */}
        <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Search millions of FDA adverse event reports, visualise patient outcomes,
          and save findings — all in one place. Powered by openFDA.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onSignIn}
            disabled={loading}
            className={cn(
              'group relative flex items-center gap-3 px-7 py-4 rounded-xl font-bold text-base transition-all shadow-2xl shadow-blue-500/25',
              'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            <GoogleIcon className="w-5 h-5" />
            {loading ? 'Signing in…' : 'Continue with Google'}
            <span className="absolute inset-0 rounded-xl ring-2 ring-white/10 group-hover:ring-white/20 transition-all" />
          </button>
          <p className="text-zinc-600 text-xs">Free · No credit card · Your data stays yours</p>
        </div>

        {/* Auth error alert */}
        {authError && (
          <div className="mt-4 max-w-lg w-full bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 text-left">
            <span className="font-bold">⚠ Sign-in error: </span>{authError}
          </div>
        )}

        {/* Floating screenshot placeholder ── glassy card preview */}
        <div className="mt-20 w-full max-w-5xl mx-auto relative">
          <div className="absolute inset-x-0 -top-10 h-20 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-10" />
          <div className="relative bg-zinc-900/60 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm ring-1 ring-white/5">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/80">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <div className="ml-3 flex-1 bg-zinc-800 rounded-md h-5 max-w-xs flex items-center px-2">
                <span className="text-zinc-500 text-[10px] font-mono">biogrid3.app/search</span>
              </div>
            </div>
            {/* Fake UI */}
            <div className="p-4 space-y-3">
              {/* Search bar mock */}
              <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-lg px-4 py-3">
                <div className="w-4 h-4 rounded bg-zinc-600" />
                <div className="flex-1 h-3 bg-zinc-700 rounded-full" />
                <div className="w-16 h-6 rounded-md bg-blue-600/60" />
              </div>
              {/* Result cards mock */}
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2.5 bg-zinc-600 rounded-full" />
                      <div className="w-8 h-2 bg-zinc-700 rounded-full ml-auto" />
                    </div>
                    <div className="h-2.5 bg-zinc-700 rounded-full w-3/4" />
                    <div className="h-2 bg-zinc-700/60 rounded-full" />
                    <div className="h-2 bg-zinc-700/60 rounded-full w-5/6" />
                    <div className="flex gap-1 pt-1">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className={cn('h-4 rounded-full', j === 0 ? 'w-14 bg-amber-800/60' : j === 1 ? 'w-10 bg-blue-800/60' : 'w-12 bg-zinc-700')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Analytics mock */}
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3">
                <div className="flex items-end gap-1 h-12">
                  {[40, 70, 55, 90, 65, 45, 80, 60, 75, 50].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        background: `hsl(${220 + i * 8}, 70%, ${45 + i * 2}%)`,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
        </div>
      </main>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-bold text-zinc-100 mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <button
            onClick={onSignIn}
            disabled={loading}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-all shadow-xl shadow-white/10 disabled:opacity-60"
          >
            <GoogleIcon className="w-4 h-4" />
            Get started for free
          </button>
          <p className="text-zinc-700 text-xs mt-3">
            Sign in with your Google account to access all features.
          </p>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
