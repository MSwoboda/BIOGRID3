// src/components/GuideScreen.tsx
import React, { useState } from 'react';
import {
  Search, SlidersHorizontal, BarChart3, FolderOpen, History,
  Pill, MonitorSmartphone, Salad, Cigarette, ChevronDown, ChevronRight,
  Zap, BookOpen, Bell, Filter, List, Brain, RotateCcw, Save,
  KeyRound, UserCog, Download, X, Tag, AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

// ── Guide content ──────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: BookOpen,
    title: 'What is BIOGRID?',
    content: (
      <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
        <p>
          BIOGRID is a research interface for the <strong className="text-zinc-200">FDA's open adverse event databases</strong>. It
          lets you search, filter, visualise, and save findings from four live FDA datasets — all powered by the public openFDA API.
        </p>
        <p>
          It is designed for regulatory professionals, researchers, pharmacovigilance teams, and anyone who needs to explore
          post-market safety data quickly without writing API queries by hand.
        </p>
        <div className="grid grid-cols-1 gap-2 mt-4">
          {[
            { icon: Pill, label: 'Drug Safety (FAERS)', desc: '18M+ adverse drug reaction reports. Reactions coded to MedDRA, includes seriousness flags, patient demographics, reporter type.' },
            { icon: MonitorSmartphone, label: 'Medical Devices (MAUDE)', desc: '10M+ device malfunction, injury and death reports. Full narrative text, UDI support, linked recall surfacing.' },
            { icon: Salad, label: 'Food & Supplements (CAERS)', desc: '100K+ food, supplement and cosmetic adverse events. Outcome grading from "Visited HCP" to "Death", industry classification.' },
            { icon: Cigarette, label: 'Tobacco Products', desc: '220K+ tobacco problem reports including e-cigarettes. Tracks health problems, product types, and non-user (secondhand) exposure.' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="w-7 h-7 rounded-md border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200 mb-0.5">{label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'search',
    icon: Search,
    title: 'Searching',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          Select a dataset from the left sidebar (Device, Drug, Food, Tobacco), then type into the search bar at the top of the screen.
        </p>

        <div className="space-y-3">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Basic Search</p>
          <ol className="space-y-2 text-xs">
            {[
              'Type a search term (drug name, device brand, product, report ID…)',
              'Press Enter to confirm the term as a search pill',
              'Press Enter again (with empty input) to run the search',
              'Or click the white Search button on the right of the bar',
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-black text-zinc-400 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Multi-term Search</p>
          <p className="text-xs">
            Add multiple search pills to run an <strong className="text-zinc-200">intersection query</strong> — results must match all terms.
            Separate terms by pressing <kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono text-[10px] text-zinc-300">,</kbd> (comma) or confirm
            each with Enter then start typing the next.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['aspirin', 'gastrointestinal hemorrhage'].map(t => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-zinc-700 text-zinc-100 text-xs font-medium">{t}</span>
            ))}
            <span className="text-xs text-zinc-600 self-center">← example pills</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Automatic Field Detection</p>
          <p className="text-xs">BIOGRID detects the query type automatically and routes to the right field:</p>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            {[
              { input: 'NDC code (e.g. 0069-0150-30)', field: 'Drug NDC', dataset: 'Drug' },
              { input: 'UDI / GS1 barcode', field: 'Device UDI', dataset: 'Device' },
              { input: 'MDR number (e.g. 3002847)', field: 'Report number', dataset: 'Device' },
              { input: '2–3 uppercase letters (e.g. FRZ)', field: 'Product code', dataset: 'Device' },
              { input: 'Free text', field: 'Name / brand / description', dataset: 'All' },
            ].map(r => (
              <div key={r.input} className="flex gap-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800">
                <span className="text-zinc-400 flex-1">{r.input}</span>
                <span className="text-zinc-600">→</span>
                <span className="text-zinc-300 font-medium">{r.field}</span>
                <span className="text-zinc-700 text-[10px] self-center">[{r.dataset}]</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs space-y-1">
          <p className="font-bold text-zinc-300">Keyboard shortcuts</p>
          <div className="flex gap-3 flex-wrap">
            <span><kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono text-[10px] text-zinc-300">↵ Enter</kbd> — confirm term / run search</span>
            <span><kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono text-[10px] text-zinc-300">,</kbd> — add term without confirming</span>
            <span><kbd className="px-1 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono text-[10px] text-zinc-300">Esc</kbd> — clear input</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'filters',
    icon: SlidersHorizontal,
    title: 'Filters',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          BIOGRID has two filter layers that work together: the <strong className="text-zinc-200">QuickFilter bar</strong> (visible below the search bar after results load)
          and the <strong className="text-zinc-200">Full Filters panel</strong> (opened via the filter icon next to the search bar).
        </p>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">QuickFilter Bar</p>
          <p className="text-xs">Shows the top values from your current results as clickable chips. Click any chip to toggle it. Three states cycle:</p>
          <div className="flex gap-2 flex-wrap text-xs">
            {[
              { label: 'Neutral', cls: 'bg-zinc-800 border-zinc-700 text-zinc-400', desc: '(not filtered)' },
              { label: '+ Include', cls: 'bg-emerald-900/60 border-emerald-600 text-emerald-300', desc: '(must match)' },
              { label: '− Exclude', cls: 'bg-red-900/60 border-red-600 text-red-300', desc: '(must not match)' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-semibold', s.cls)}>{s.label}</span>
                <span className="text-zinc-600">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Full Filters Panel — all dimensions</p>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            {[
              { dim: 'Event Type', desc: 'Malfunction, Injury, Death, Other' },
              { dim: 'Manufacturer / Reporter', desc: 'Include or exclude specific brands' },
              { dim: 'Device / Product Name', desc: 'Filter to specific device models' },
              { dim: 'Event Location', desc: 'Hospital, Home, Outpatient clinic…' },
              { dim: 'Report Source', desc: 'Manufacturer, User facility, Voluntary' },
              { dim: 'Reporter State', desc: 'US state of the reporter' },
              { dim: 'Patient Sex', desc: 'Male, Female, Unknown' },
              { dim: 'Patient Problem', desc: 'MedDRA reactions / health outcomes' },
              { dim: 'Product Problem', desc: 'Device or product-specific issues' },
              { dim: 'Date Range', desc: 'Start and end date for the event date' },
              { dim: 'Search Field', desc: 'Override auto-detection to a specific field' },
            ].map(r => (
              <div key={r.dim} className="flex gap-2 p-2 rounded-md bg-zinc-900/40 border border-zinc-800">
                <span className="text-zinc-200 font-medium w-40 shrink-0">{r.dim}</span>
                <span className="text-zinc-500">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Keyword Filter</p>
          <p className="text-xs">
            After results load, a keyword filter input appears in the controls bar. Type any word to instantly narrow the
            visible list — matched client-side with no new API call. Prefix with <code className="text-zinc-300 bg-zinc-800 px-1 rounded text-[10px]">-</code> to exclude.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'views',
    icon: List,
    title: 'Result Views',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          After a search, four view tabs appear below the controls bar. All views read from the same filtered result set —
          switching between them is instant with no additional API call.
        </p>
        <div className="space-y-3">
          {[
            {
              icon: List,
              label: 'List',
              desc: 'Paginated result cards. Each card shows the report ID, primary title, date, severity indicator, key facts, and summary text. Click a card to expand full detail. You can save, share, or copy any report from here.',
            },
            {
              icon: BarChart3,
              label: 'Analytics',
              desc: 'Charts generated from the loaded result set: top reactions/problems ranked by frequency, time-series trend by year, and patient demographic breakdowns (sex, age group). Hover bars to see counts.',
            },
            {
              icon: Brain,
              label: 'Problems',
              desc: 'A frequency-sorted mind-map of device problems and patient problems. Click any node to filter the list view by that problem type. Useful for quickly identifying the dominant issues in a result set.',
            },
            {
              icon: Bell,
              label: 'Recalls',
              desc: 'For device searches only. Automatically surfaces FDA recall records linked to the devices in your results. Matching uses a precision-tiered strategy: exact UDI → product code → manufacturer name.',
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-3 p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800">
              <div className="w-7 h-7 rounded-md border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200 mb-1">{label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'reports',
    icon: FolderOpen,
    title: 'Saving & Managing Reports',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Saving a Report</p>
          <ol className="space-y-1.5 text-xs list-decimal list-inside">
            <li>Expand any result card in List view</li>
            <li>Click <strong className="text-zinc-200">Save Report</strong> (bookmark icon)</li>
            <li>Choose an existing folder or type a new folder name</li>
            <li>Optionally add a private note</li>
            <li>A confirmation toast appears — the report is now in your Saved Reports panel</li>
          </ol>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Saved Reports Panel</p>
          <p className="text-xs">
            Access via <strong className="text-zinc-200">Saved Reports</strong> in the left sidebar. Reports are grouped by folder.
            Click any saved report to view its full details. Remove it with the trash icon.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Saving a Search</p>
          <p className="text-xs">
            After running a search, click the <strong className="text-zinc-200">Save Search</strong> option in the controls bar.
            Give it a name — the query and all active filters are saved. Re-run it from the History panel with one click.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Exporting</p>
          <p className="text-xs">
            Use the <strong className="text-zinc-200">Download CSV</strong> button in the controls bar to export the current
            filtered result set. All visible fields are included in the export.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'history',
    icon: History,
    title: 'Search History',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          Every search you run is automatically saved to your history. Access it via <strong className="text-zinc-200">History</strong> in the left sidebar.
        </p>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Replaying a Search</p>
          <p className="text-xs">
            Click any history item to replay the exact search — same query terms, same filters, and same dataset — against
            the latest live FDA data. Results will reflect any data that has been added since the original search.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Starred Searches</p>
          <p className="text-xs">
            Star a history item to pin it to the top of the list. Starred searches are preserved across sessions and
            won't be pushed out by newer searches.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Managing History</p>
          <p className="text-xs">
            Remove individual history items with the trash icon on each row. The history panel shows the dataset,
            query terms, result count, and timestamp for each entry.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics & Charts',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          Switch to the <strong className="text-zinc-200">Analytics</strong> tab after a search to see charts generated
          from your current result set. No additional query is made — analytics update instantly as you change filters.
        </p>
        <div className="space-y-3">
          {[
            { chart: 'Top Reactions / Problems', desc: 'Horizontal bar chart of the most frequently occurring MedDRA reactions (Drug/Food) or device problem codes (Device). Shows count and percentage of total.' },
            { chart: 'Time Trend', desc: 'Bar chart of report counts grouped by year. Useful for identifying spikes in adverse events following product launches or label changes.' },
            { chart: 'Patient Demographics', desc: 'Sex distribution (Male/Female/Unknown) and age group breakdown (Neonate through Elderly). Available for Drug and Device datasets.' },
            { chart: 'Outcome Distribution', desc: 'For Food and Drug, shows the proportion of reports by outcome severity (Hospitalised, Life Threatening, Fatal, etc.).' },
          ].map(r => (
            <div key={r.chart} className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800">
              <p className="text-xs font-bold text-zinc-200 mb-1">{r.chart}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'datasets',
    icon: Zap,
    title: 'Dataset Reference',
    content: (
      <div className="space-y-5 text-sm text-zinc-400 leading-relaxed">
        {[
          {
            icon: Pill,
            name: 'Drug Safety — FAERS',
            searchBy: ['Drug / Brand name', 'Generic name', 'Active ingredient', 'NDC code (auto-detected)', 'Pharmacologic class', 'Reporter type', 'Safety report ID'],
            keyFields: ['MedDRA reaction terms', 'Seriousness flags (fatal, hospitalised, life-threatening)', 'Patient sex & age group', 'Reporter qualification', 'Drug role (suspect / concomitant)', 'Country of occurrence'],
          },
          {
            icon: MonitorSmartphone,
            name: 'Medical Devices — MAUDE',
            searchBy: ['Device / brand name', 'Model number (auto-detected)', 'UDI / GS1 barcode (auto-detected)', 'Product code (auto-detected)', 'Manufacturer', 'MDR report number (auto-detected)'],
            keyFields: ['Device problem codes', 'Patient problem codes', 'Event type (malfunction / injury / death)', 'Full narrative text', 'UDI & product code', 'Related recalls (auto-surfaced)'],
          },
          {
            icon: Salad,
            name: 'Food & Supplements — CAERS',
            searchBy: ['Product / brand name', 'Industry category', 'Reaction / symptom', 'Outcome', 'Report number (auto-detected)'],
            keyFields: ['Outcome severity grading', 'Industry classification code', 'Consumer age & gender', 'MedDRA reaction terms', 'Product role (suspect / concomitant)'],
          },
          {
            icon: Cigarette,
            name: 'Tobacco Products',
            searchBy: ['Product type', 'Health problem'],
            keyFields: ['Product type (cigarettes, ENDS, smokeless…)', 'Reported health problems', 'Number of products involved', 'Non-user (secondhand) affected flag'],
          },
        ].map(({ icon: Icon, name, searchBy, keyFields }) => (
          <div key={name} className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-md border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <p className="text-sm font-bold text-zinc-100">{name}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Search by</p>
                <ul className="space-y-1">
                  {searchBy.map(f => <li key={f} className="text-xs text-zinc-500 flex items-start gap-1.5"><span className="text-zinc-700 mt-1">›</span>{f}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Key fields</p>
                <ul className="space-y-1">
                  {keyFields.map(f => <li key={f} className="text-xs text-zinc-500 flex items-start gap-1.5"><span className="text-zinc-700 mt-1">›</span>{f}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'account',
    icon: UserCog,
    title: 'Account & Settings',
    content: (
      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Profile</p>
          <p className="text-xs">
            Click your name or avatar at the bottom of the sidebar to open Profile Settings. From here you can update your
            first and last name, company, and role, and manage your communication preferences.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Changing Password</p>
          <p className="text-xs">
            Email/password accounts can change their password in Profile Settings. Google sign-in accounts manage passwords
            through Google.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Data Sync</p>
          <p className="text-xs">
            Saved reports, folders, notes, and starred searches sync to your Firestore account in real time.
            They are available on any device where you sign in.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Signing Out</p>
          <p className="text-xs">
            Click the sign-out icon at the bottom right of the sidebar. A confirmation step prevents accidental sign-outs.
          </p>
        </div>
        <div className="p-3 rounded-lg border border-amber-800/40 bg-amber-950/20 text-xs">
          <p className="font-bold text-amber-400 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Research Use Only</p>
          <p className="text-amber-700/80">
            BIOGRID is an informational tool. It does not constitute medical advice or clinical guidance.
            Adverse event reports are voluntary and may be incomplete or unverified.
            Data is sourced from the openFDA API. BIOGRID is not affiliated with the FDA.
          </p>
        </div>
      </div>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function GuideScreen() {
  const [openId, setOpenId] = useState<string | null>('overview');

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">User Guide</h2>
            <p className="text-xs text-zinc-600">How to use BIOGRID</p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="flex-1 px-4 py-4 space-y-1.5">
        {SECTIONS.map(section => {
          const isOpen = openId === section.id;
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className={cn(
                'rounded-xl border transition-colors',
                isOpen ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700',
              )}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-4 h-4 shrink-0', isOpen ? 'text-zinc-300' : 'text-zinc-500')} />
                  <span className={cn('text-sm font-semibold', isOpen ? 'text-zinc-100' : 'text-zinc-400')}>
                    {section.title}
                  </span>
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                }
              </button>
              {isOpen && (
                <div className="px-4 pb-5 pt-1 border-t border-zinc-800">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-4 border-t border-zinc-800 text-center">
        <p className="text-[11px] text-zinc-700">
          Data from <a href="https://open.fda.gov" target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors">openFDA API</a>
          {' '}· Not affiliated with the FDA · For research purposes only
        </p>
      </div>
    </div>
  );
}
