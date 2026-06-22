// src/components/SplashScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  Pill, MonitorSmartphone, Salad, Cigarette,
  Zap, SlidersHorizontal, BarChart3, FolderOpen, Bell, Search,
  ArrowRight, CheckCircle2, Database, Clock, Shield, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onShowAuth: () => void;
  loading?: boolean;
  authError?: string | null;
}

const DATASETS = [
  {
    Icon: Pill,
    label: 'Drug Safety (FAERS)',
    count: '18M+',
    desc: 'The FDA Adverse Event Reporting System (FAERS) contains spontaneous reports of suspected adverse drug reactions submitted by healthcare professionals, manufacturers, and patients. Search by drug name, active ingredient, NDC code, pharmacologic class, or reporter qualification. Reactions are coded to MedDRA terminology, enabling consistent cross-drug comparisons.',
    tags: ['MedDRA Reactions', 'Seriousness Flags', 'Patient Demographics', 'Reporter Type', 'Drug Role', 'Outcomes'],
  },
  {
    Icon: MonitorSmartphone,
    label: 'Medical Devices (MAUDE)',
    count: '10M+',
    desc: 'The Manufacturer and User Facility Device Experience (MAUDE) database holds malfunction, injury, and death reports for marketed medical devices. Each record includes full narrative text, device problem codes, patient impact, manufacturer details, and unique device identifiers (UDI). Complemented by automatic recall surfacing via a precision-tiered identifier strategy.',
    tags: ['Device Problems', 'Patient Problems', 'Manufacturer', 'UDI / MDR Number', 'Event Type', 'Related Recalls'],
  },
  {
    Icon: Salad,
    label: 'Food & Supplements (CAERS)',
    count: '100K+',
    desc: 'The CFSAN Adverse Event Reporting System (CAERS) covers adverse event and product complaint reports for foods, dietary supplements, and cosmetics. Outcomes are graded from "Visited a Healthcare Provider" through "Life Threatening" and "Death." Industry classification codes allow filtering by product category — from infant formula to herbal supplements.',
    tags: ['Outcome Severity', 'Industry Category', 'MedDRA Reactions', 'Consumer Age', 'Product Role'],
  },
  {
    Icon: Cigarette,
    label: 'Tobacco Products',
    count: '220K+',
    desc: 'Tobacco product problem reports submitted to the FDA include cigarettes, e-cigarettes, smokeless tobacco, cigars, and pipe tobacco. Each report documents the health problems experienced, the specific product types involved, whether non-users were affected (secondhand exposure), and the number of products used. Useful for post-market surveillance of novel nicotine delivery systems.',
    tags: ['Product Type', 'Health Problems', 'Non-user Exposure', 'ENDS / E-cigarettes'],
  },
];

const FEATURES = [
  {
    Icon: Search,
    title: 'Multi-term Search',
    desc: 'Build complex queries by adding multiple search pills. Each term is searched independently and results are intersected, letting you isolate signal at the intersection of two conditions — for example, a drug combined with a specific adverse reaction.',
  },
  {
    Icon: Zap,
    title: 'Automatic Field Detection',
    desc: 'Paste an NDC code, UDI barcode, MDR report number, or product code and BIOGRID automatically routes to the correct search field. For free-text queries, parallel field probing finds the broadest match across names, ingredients, and descriptions.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Granular Filtering',
    desc: 'Include or exclude any dimension — manufacturer, reaction, outcome, country, seriousness level, patient sex, age group, and more. Filters use a three-state chip system (neutral to include to exclude) so you can build targeted cohorts in seconds.',
  },
  {
    Icon: BarChart3,
    title: 'Built-in Analytics',
    desc: 'Switch to the Analytics view to see top reactions ranked by frequency, time-series trends by year, patient demographic breakdowns, and problem distribution bar charts — all generated from your current filtered result set without re-querying.',
  },
  {
    Icon: FolderOpen,
    title: 'Report Management',
    desc: 'Save any report to a named folder, attach private research notes, and mark reports for follow-up. Everything syncs to your Firestore account in real time, so your saved work is available on any device.',
  },
  {
    Icon: Bell,
    title: 'Recall Intelligence',
    desc: 'For device searches, BIOGRID automatically surfaces related FDA recall records using a precision-tiered matching strategy — starting from exact UDI matches, falling back to product codes, then manufacturer names. Recall status and classification are shown inline.',
  },
];

const STATS = [
  { value: '28M+', label: 'Total Reports', sub: 'across all 4 FDA datasets' },
  { value: '4', label: 'Live Datasets', sub: 'Drug · Device · Food · Tobacco' },
  { value: '<1s', label: 'Query Speed', sub: 'direct openFDA API, no caching' },
  { value: '100%', label: 'No Cost', sub: 'free to use, always' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Search',
    desc: 'Enter a drug name, device brand, food product, active ingredient, or paste a report ID. Combine multiple search terms into pills for intersection queries. BIOGRID detects identifiers like NDC codes and UDIs automatically and routes to the optimal search field.',
  },
  {
    step: '02',
    title: 'Filter & Refine',
    desc: 'Narrow results using the QuickFilter bar below the search field. Include or exclude specific reactions, manufacturers, outcomes, and countries. For deeper analysis, open the full Filters panel for 10+ dimensions including seriousness flags, patient demographics, and date ranges.',
  },
  {
    step: '03',
    title: 'Analyse & Save',
    desc: 'Switch between List, Analytics, Problems, and Recalls views without re-running your query. Save individual reports to labelled folders with private notes. Export results to CSV for offline analysis. All saved data syncs instantly to your account.',
  },
];

export default function SplashScreen({ onShowAuth, loading, authError }: Props) {
  const [heroImg, setHeroImg] = useState<'search' | 'analytics'>('search');

  useEffect(() => {
    const t = setInterval(() => setHeroImg(h => h === 'search' ? 'analytics' : 'search'), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-x-hidden font-sans">

      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '240px 240px',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
            <span className="text-black font-black text-sm">B</span>
          </div>
          <span className="font-black text-zinc-100 tracking-[0.15em] text-sm uppercase">BIOGRID</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-zinc-600 font-medium">Powered by openFDA</span>
          <button
            onClick={onShowAuth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 transition-all disabled:opacity-60"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs font-semibold mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          Live · 28M+ FDA reports · Updated daily
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6 max-w-4xl text-white">
          FDA safety data,{' '}
          <span className="text-zinc-400">finally searchable</span>
        </h1>

        <p className="text-zinc-500 text-lg sm:text-xl max-w-2xl mb-4 leading-relaxed">
          BIOGRID gives researchers, regulatory professionals, and safety teams direct access to the FDA's open adverse event databases — with structured search, analytics, and report management built in.
        </p>
        <p className="text-zinc-600 text-sm max-w-xl mb-10 leading-relaxed">
          Search across Drug (FAERS), Device (MAUDE), Food (CAERS), and Tobacco datasets. No API keys, no rate limits on your end, no cost.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <button
            onClick={onShowAuth}
            disabled={loading}
            className={cn(
              'group flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-sm transition-all',
              'bg-white text-black hover:bg-zinc-100',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {loading ? 'Loading…' : 'Get Started — Free'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={onShowAuth}
            disabled={loading}
            className="flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-sm border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-all disabled:opacity-60"
          >
            Sign in
          </button>
        </div>
        <p className="text-zinc-700 text-xs">No credit card required · Free for all users</p>

        {authError && (
          <div className="mt-6 max-w-lg w-full bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 text-left">
            <span className="font-bold">Sign-in error: </span>{authError}
          </div>
        )}

        {/* Hero screenshot */}
        <div className="w-full max-w-5xl mx-auto mt-14 relative">
          <div className="flex items-center justify-center border-b border-zinc-800 mb-0">
            {([
              { label: 'Search View', key: 'search' as const },
              { label: 'Analytics View', key: 'analytics' as const },
            ]).map(({ label, key }) => (
              <button
                key={key}
                onClick={() => setHeroImg(key)}
                className={cn(
                  'px-8 py-4 text-sm font-semibold transition-all border-b-2 -mb-px',
                  heroImg === key
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 border border-zinc-800">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="ml-3 flex-1 bg-zinc-800 rounded-md h-5 max-w-xs flex items-center px-2.5">
                <span className="text-zinc-500 text-[10px] font-mono">biogrid.app</span>
              </div>
            </div>
            <div className="relative bg-zinc-950">
              <img
                src="/hero-search.png"
                alt="BIOGRID search interface"
                className={cn('w-full object-cover object-top transition-opacity duration-700', heroImg === 'search' ? 'opacity-100' : 'opacity-0 absolute inset-0')}
              />
              <img
                src="/hero-analytics.png"
                alt="BIOGRID analytics dashboard"
                className={cn('w-full object-cover object-top transition-opacity duration-700', heroImg === 'analytics' ? 'opacity-100' : 'opacity-0 absolute inset-0')}
              />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 border-y border-zinc-800/60">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-800">
          {STATS.map(s => (
            <div key={s.label} className="bg-zinc-950 p-8 text-center">
              <div className="text-3xl font-black text-white mb-1">{s.value}</div>
              <div className="text-sm font-bold text-zinc-300 mb-0.5">{s.label}</div>
              <div className="text-xs text-zinc-600">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Datasets */}
      <section className="relative z-10 px-6 py-20 max-w-6xl mx-auto w-full">
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-zinc-800 text-zinc-500 text-xs font-semibold mb-5">
            <Database className="w-3 h-3" />
            4 FDA Datasets
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 max-w-2xl leading-tight">
            The complete picture of FDA post-market surveillance
          </h2>
          <p className="text-zinc-500 max-w-2xl leading-relaxed">
            BIOGRID connects to four distinct FDA open data streams — each with its own schema, search fields, and analytics. Select a dataset from the sidebar and BIOGRID automatically configures the right filters, field detectors, and chart types for that data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DATASETS.map(({ Icon, label, count, desc, tags }) => (
            <div
              key={label}
              className="group border border-zinc-800 rounded-xl p-7 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all"
            >
              <div className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0 group-hover:border-zinc-600 transition-colors">
                  <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-base font-bold text-zinc-100">{label}</h3>
                    <span className="text-sm font-black text-white">{count}</span>
                    <span className="text-xs text-zinc-600">reports</span>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed mb-4">{desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded-md border border-zinc-800 text-[11px] font-medium text-zinc-500 bg-zinc-950/50">
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

      {/* How It Works */}
      <section className="relative z-10 px-6 py-20 border-t border-zinc-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-zinc-800 text-zinc-500 text-xs font-semibold mb-5">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              From query to insight in seconds
            </h2>
            <p className="text-zinc-500 max-w-xl leading-relaxed">
              BIOGRID is designed for speed. Most searches return results in under a second, with analytics rendering from the same result set immediately — no second query required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="border border-zinc-800 rounded-xl p-7 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all">
                <div className="text-4xl font-black text-zinc-800 mb-4 leading-none">{s.step}</div>
                <h3 className="text-base font-bold text-zinc-100 mb-3">{s.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all"
              >
                <div className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200 mb-1.5">{title}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="relative z-10 px-6 py-20 border-t border-zinc-800/60 max-w-6xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-3xl font-black text-white mb-4">Every view you need</h2>
          <p className="text-zinc-500 max-w-lg leading-relaxed text-sm">
            Switch between Search, Analytics, Problems, and Recalls without re-running your query. Each view reads from the same filtered result set, updated in real time as you adjust filters.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { src: '/hero-search.png', caption: 'Search & Filter — results with severity indicators, quick-filter chips, and multi-term pills', label: 'Search View' },
            { src: '/hero-analytics.png', caption: 'Analytics — reaction frequency, time-series trends, and patient demographic breakdowns', label: 'Analytics View' },
          ].map(img => (
            <div key={img.label} className="group">
              <div className="rounded-xl overflow-hidden border border-zinc-800 shadow-xl mb-3 group-hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-900 border-b border-zinc-800">
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  <span className="ml-2 text-[10px] text-zinc-600 font-semibold uppercase tracking-wide">{img.label}</span>
                </div>
                <img src={img.src} alt={img.caption} className="w-full object-cover object-top" />
              </div>
              <p className="text-xs text-zinc-600 text-center leading-relaxed">{img.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Signals */}
      <section className="relative z-10 px-6 py-16 border-t border-zinc-800/60">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { Icon: Shield, title: 'Built on Official Data', body: 'All data is sourced exclusively from the openFDA API — a public service maintained by the U.S. Department of Health and Human Services. BIOGRID does not modify or supplement the underlying records.' },
            { Icon: Database, title: 'Research Use Only', body: 'BIOGRID is a research and informational tool. It does not constitute medical advice, diagnosis, or clinical guidance. Results reflect voluntary adverse event reports and may be incomplete or unverified.' },
            { Icon: Clock, title: 'Current & Up-to-Date', body: 'All queries run live against the openFDA API with no caching on your end. You always see the most recently available data without needing to refresh exports or request new datasets.' },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3">
              <div className="w-8 h-8 rounded-lg border border-zinc-800 flex items-center justify-center">
                <Icon className="w-4 h-4 text-zinc-500" />
              </div>
              <h4 className="text-sm font-bold text-zinc-300">{title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 px-6 py-28 text-center border-t border-zinc-800/60">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            {['Free account', 'No credit card', 'Data stays yours'].map(item => (
              <span key={item} className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-700" />
                {item}
              </span>
            ))}
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 leading-tight">
            Start searching FDA data today
          </h2>
          <p className="text-zinc-500 mb-10 max-w-lg mx-auto leading-relaxed text-sm">
            Create a free account to save reports, organise findings into folders, attach private research notes, and sync your work across all devices. Sign in with Google or use email and password.
          </p>
          <button
            onClick={onShowAuth}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-sm transition-all',
              'bg-white text-black hover:bg-zinc-100',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {loading ? 'Loading…' : 'Create Free Account'}
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-zinc-700 text-xs mt-5">No emails without consent · openFDA API · Not affiliated with the FDA</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/60 px-6 sm:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center shrink-0">
              <span className="text-black font-black text-[9px]">B</span>
            </div>
            <span className="font-black text-zinc-600 tracking-[0.12em] uppercase text-xs">BIOGRID</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-zinc-700">
            <span>Data from the <a href="https://open.fda.gov" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2">openFDA API</a></span>
            <span>Not affiliated with the FDA</span>
            <span>For research purposes only</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
