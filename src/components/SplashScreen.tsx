// src/components/SplashScreen.tsx
import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface Props {
  onShowAuth: () => void;
  loading?: boolean;
  authError?: string | null;
}

// ── Static data ───────────────────────────────────────────────────────────────

const DATASETS = [
  {
    icon: '💊',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    accent: 'text-blue-400',
    dot: 'bg-blue-400',
    label: 'Drugs',
    count: '18M+',
    desc: 'FAERS adverse event reports — reactions, outcomes, demographics',
    tags: ['MedDRA Reactions', 'Seriousness', 'Patient Sex/Age', 'Country'],
  },
  {
    icon: '🔬',
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    accent: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'Devices',
    count: '10M+',
    desc: 'MAUDE device malfunction & injury reports with full narrative text',
    tags: ['Device Problems', 'Patient Problems', 'Manufacturer', 'UDI / MDR'],
  },
  {
    icon: '🥗',
    color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    accent: 'text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Foods',
    count: '100K+',
    desc: 'CAERS food & supplement adverse event reports with outcome grading',
    tags: ['Outcomes', 'Industry Category', 'Reactions', 'Consumer Age'],
  },
  {
    icon: '🚬',
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
    accent: 'text-rose-400',
    dot: 'bg-rose-400',
    label: 'Tobacco',
    count: '220K+',
    desc: 'Tobacco product health problem reports including non-user exposure',
    tags: ['Product Types', 'Health Problems', 'Non-user Affected'],
  },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Multi-term Search',
    desc: 'Add multiple search pills, combine queries, and paginate up to 2,000 results per search across all four FDA datasets.',
  },
  {
    icon: '🔍',
    title: 'Smart Field Detection',
    desc: 'Automatically detects NDC codes, UDIs, MDR numbers, product codes, and falls back to parallel field probing.',
  },
  {
    icon: '🎛️',
    title: 'Deep Filtering',
    desc: 'Include/exclude any dimension — manufacturer, reaction, outcome, country, seriousness, sex, and more.',
  },
  {
    icon: '📊',
    title: 'Visual Analytics',
    desc: 'Recharts-powered bar charts, time series trends, problem mind-maps, and recall distribution plots.',
  },
  {
    icon: '🗂️',
    title: 'Report Management',
    desc: 'Save any report to named folders, add private notes, and sync everything to Firestore across devices.',
  },
  {
    icon: '🔔',
    title: 'Recall Tracking',
    desc: 'For device searches, automatically surfaces related FDA recalls using a precision-tiered identifier strategy.',
  },
];

const STAT_ITEMS = [
  { value: '28M+', label: 'FDA Reports', sub: 'across all 4 datasets' },
  { value: '4', label: 'Datasets', sub: 'Drug · Device · Food · Tobacco' },
  { value: '<1s', label: 'Search Speed', sub: 'live API, no cache lag' },
  { value: '100%', label: 'Free', sub: 'powered by openFDA' },
];

// Animated counter
function Counter({ target, suffix = '' }: { target: string; suffix?: string }) {
  return <span>{target}{suffix}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SplashScreen({ onShowAuth, loading, authError }: Props) {
  const [heroImg, setHeroImg] = useState<'search' | 'analytics'>('search');

  // Cycle hero image every 4s
  useEffect(() => {
    const t = setInterval(() => setHeroImg(h => h === 'search' ? 'analytics' : 'search'), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-x-hidden font-sans">

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[900px] h-[900px] rounded-full bg-blue-600/8 blur-[140px]" />
        <div className="absolute top-1/2 -right-60 w-[700px] h-[700px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/6 blur-[100px]" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-zinc-800/60 backdrop-blur-sm bg-zinc-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
            <span className="text-black font-black text-sm">B</span>
          </div>
          <span className="font-black text-zinc-100 tracking-[0.15em] text-sm uppercase">BIOGRID</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-zinc-500">Powered by openFDA</span>
          <button
            onClick={onShowAuth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-60"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-12">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold mb-8 shadow-lg shadow-blue-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live FDA Open Data · 28M+ reports across 4 datasets
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6 max-w-4xl">
          FDA safety data,{' '}
          <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            finally searchable
          </span>
        </h1>

        <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Search millions of adverse event reports across Drugs, Devices, Food, and Tobacco.
          Filter, visualise, and save findings — all powered by the openFDA API.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <button
            onClick={onShowAuth}
            disabled={loading}
            className={cn(
              'group relative flex items-center gap-3 px-7 py-4 rounded-xl font-bold text-base transition-all shadow-2xl shadow-blue-500/20',
              'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {loading ? 'Loading…' : 'Get Started Free →'}
            <span className="absolute inset-0 rounded-xl ring-2 ring-white/10 group-hover:ring-white/20 transition-all" />
          </button>
          <p className="text-zinc-600 text-xs">Free · No credit card · Synced across devices</p>
        </div>

        {authError && (
          <div className="mb-8 max-w-lg w-full bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 text-left">
            <span className="font-bold">⚠ Sign-in error: </span>{authError}
          </div>
        )}

        {/* ── HERO APP SCREENSHOT ─────────────────────────────────────────── */}
        <div className="w-full max-w-5xl mx-auto mt-8 relative">
          {/* Top fade */}
          <div className="absolute inset-x-0 -top-8 h-16 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-10" />

          {/* Tab switcher */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {(['Search', 'Analytics'] as const).map((label, i) => (
              <button
                key={label}
                onClick={() => setHeroImg(i === 0 ? 'search' : 'analytics')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  (heroImg === 'search') === (i === 0)
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Browser chrome wrapper */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.15)] ring-1 ring-white/8 border border-zinc-700/60">
            {/* Chrome bar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/90">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <div className="ml-3 flex-1 bg-zinc-800 rounded-md h-5 max-w-xs flex items-center px-2.5">
                <span className="text-zinc-400 text-[10px] font-mono">biogrid-app.web.app</span>
              </div>
            </div>
            {/* Screenshot images */}
            <div className="relative bg-zinc-950">
              <img
                src="/hero-search.png"
                alt="BioGrid3 search interface"
                className={cn(
                  'w-full object-cover object-top transition-opacity duration-700',
                  heroImg === 'search' ? 'opacity-100' : 'opacity-0 absolute inset-0'
                )}
              />
              <img
                src="/hero-analytics.png"
                alt="BioGrid3 analytics dashboard"
                className={cn(
                  'w-full object-cover object-top transition-opacity duration-700',
                  heroImg === 'analytics' ? 'opacity-100' : 'opacity-0 absolute inset-0'
                )}
              />
            </div>
          </div>

          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_ITEMS.map(s => (
            <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-center hover:border-zinc-700 transition-colors">
              <div className="text-3xl font-black text-zinc-100 mb-0.5">{s.value}</div>
              <div className="text-xs font-bold text-zinc-300">{s.label}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DATASETS SECTION ──────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700 text-zinc-400 text-xs font-semibold mb-4">
            4 FDA Datasets
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 mb-3">Everything FDA publishes, in one search</h2>
          <p className="text-zinc-500 max-w-xl mx-auto">Switch between datasets with one click. Each has tailored search fields, filters, and analytics.</p>
        </div>

        {/* 2×2 dataset card grid — all visible at once */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DATASETS.map((d) => (
            <div
              key={d.label}
              className={cn(
                'bg-gradient-to-br border rounded-2xl p-6 hover:scale-[1.01] transition-transform duration-200',
                d.color
              )}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl shrink-0 mt-0.5">{d.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black text-zinc-100">{d.label}</h3>
                    <span className={cn('text-xl font-black', d.accent)}>{d.count}</span>
                    <span className="text-xs text-zinc-500">reports</span>
                  </div>
                  <p className="text-zinc-400 mb-4 leading-relaxed">{d.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {d.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-full bg-zinc-950/50 border border-zinc-700 text-xs font-semibold text-zinc-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700 text-zinc-400 text-xs font-semibold mb-4">
            How It Works
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 mb-3">From query to insight in seconds</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[
            {
              step: '1',
              title: 'Search',
              desc: 'Type a drug name, device brand, food product, or report ID. Add multiple search terms as pills. The app auto-detects NDC codes, UDIs, MDR numbers.',
              color: 'from-blue-500 to-blue-600',
            },
            {
              step: '2',
              title: 'Filter & Explore',
              desc: 'Use the QuickFilter bar to include/exclude reactions, manufacturers, outcomes, and countries. Open the full modal for 10+ filter dimensions with 3-state chips.',
              color: 'from-violet-500 to-violet-600',
            },
            {
              step: '3',
              title: 'Analyse & Save',
              desc: 'Switch to Analytics for charts and trends, or Problems for mind-maps. Save any report to a folder with private notes. Syncs to your account instantly.',
              color: 'from-indigo-500 to-indigo-600',
            },
          ].map(s => (
            <div key={s.step} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
              <div className={cn(
                'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-black text-sm mb-4',
                s.color
              )}>
                {s.step}
              </div>
              <h3 className="text-base font-bold text-zinc-100 mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="flex gap-3 bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all"
            >
              <span className="text-xl mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <h4 className="text-sm font-bold text-zinc-200 mb-1">{f.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCREENSHOT PAIR: Search + Analytics ──────────────────────────── */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-zinc-100 mb-3">Every view you need</h2>
          <p className="text-zinc-500 max-w-lg mx-auto text-sm">Switch between List, Analytics, Problems, and Recalls views without re-running your search.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { src: '/hero-search.png', caption: '📋 List view — results with severity badges, quick-filter chips', label: 'Search & Filter' },
            { src: '/hero-analytics.png', caption: '📊 Analytics — top reactions, time trends, patient demographics', label: 'Analytics' },
          ].map(img => (
            <div key={img.label} className="group">
              <div className="rounded-xl overflow-hidden border border-zinc-700/50 shadow-xl ring-1 ring-white/5 mb-3 group-hover:border-zinc-600 transition-colors">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                  <span className="ml-2 text-[10px] text-zinc-500 font-semibold">{img.label}</span>
                </div>
                <img src={img.src} alt={img.caption} className="w-full object-cover object-top" />
              </div>
              <p className="text-xs text-zinc-500 text-center">{img.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            100% Free · openFDA API · No rate limits on your end
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-zinc-100 mb-4">
            Start searching FDA data now
          </h2>
          <p className="text-zinc-500 mb-10 max-w-lg mx-auto">
            Sign in with Google to save reports, create folders, add notes, and sync across all your devices.
          </p>
          <button
            onClick={onShowAuth}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all shadow-2xl shadow-blue-500/20',
              'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {loading ? 'Loading…' : "Sign In — it's free"}
          </button>
          <p className="text-zinc-700 text-xs mt-4">No emails · Data stays yours</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/60 px-6 py-6 text-center text-xs text-zinc-700">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center">
            <span className="text-black font-black text-[9px]">B</span>
          </div>
          <span className="font-black text-zinc-600 tracking-[0.1em] text-xs uppercase">BIOGRID</span>
        </div>
        Data sourced from the <a href="https://open.fda.gov" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-400 transition-colors">openFDA API</a>.
        Not affiliated with the FDA. For research purposes only.
      </footer>
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
