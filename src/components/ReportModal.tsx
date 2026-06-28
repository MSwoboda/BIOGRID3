import React, { useState } from 'react';
import { cn, formatDate } from '../lib/utils';
import { parseReport } from '../lib/api';
import { useStore } from '../store';
import type { Category } from '../types';
import {
  X, Bookmark, Clock, Box, Activity, ChevronRight, ChevronDown, Download,
  Pill as PillIcon, Apple, Cigarette, AlertTriangle, Share2,
} from 'lucide-react';
import { createShareLink } from '../lib/share';
import ShareLinkDialog from './ShareLinkDialog';
import { exportSingleReportToPDF, exportSingleReportToDOCX } from '../lib/export';
import type { SavedReport } from '../types';

// ── Shared tiny components ───────────────────────────────────────────────────

const PILL_STYLES: Record<string, string> = {
  amber:   'bg-amber-950/60 text-amber-300 border-amber-800',
  rose:    'bg-rose-950/60 text-rose-300 border-rose-800',
  blue:    'bg-blue-950/60 text-blue-300 border-blue-800',
  indigo:  'bg-indigo-950/60 text-indigo-300 border-indigo-800',
  emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
  zinc:    'bg-zinc-800 text-zinc-300 border-zinc-700',
  red:     'bg-red-950/60 text-red-300 border-red-800',
  violet:  'bg-violet-950/60 text-violet-300 border-violet-800',
  orange:  'bg-orange-950/60 text-orange-300 border-orange-800',
};

function Pill({ label, color = 'zinc' }: { label: string; color?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border leading-none',
      PILL_STYLES[color] ?? PILL_STYLES.zinc
    )}>
      {label}
    </span>
  );
}

function Field({
  label, value, mono = false,
}: { label: string; value?: string | null; mono?: boolean }) {
  const has = value && String(value).trim() && String(value) !== 'NA' && String(value) !== 'Unknown';
  return (
    <div className={has ? '' : 'opacity-25'}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5 select-none">
        {label}
      </dt>
      <dd className={cn(
        'text-sm leading-snug break-words',
        mono ? 'font-mono text-zinc-300' : 'text-zinc-200',
        !has && 'text-zinc-700 italic text-xs',
      )}>
        {has ? String(value) : 'Not reported'}
      </dd>
    </div>
  );
}

function SectionTitle({
  children, empty = false,
}: { children: React.ReactNode; empty?: boolean }) {
  return (
    <h3 className={cn(
      'text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2',
      empty ? 'text-zinc-700' : 'text-zinc-400',
    )}>
      {children}
    </h3>
  );
}

function EmptyNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-[11px] text-zinc-700 italic">{children ?? 'None reported'}</p>
  );
}

// ── Geographic Locator Component ─────────────────────────────────────────────
function GeographicLocator({ state, country }: { state?: string | null; country?: string | null }) {
  const hasGeo = (state && state !== 'NA') || (country && country !== 'NA');
  if (!hasGeo) return null;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 border-l-2 border-l-blue-500 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden transition-all hover:border-zinc-700 hover:border-l-blue-500">
      {/* Grid background effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:14px_14px]" />
      
      {/* Compass / Radar Graphic */}
      <div className="relative w-12 h-12 rounded-full border border-zinc-800 bg-zinc-950/90 flex items-center justify-center shrink-0">
        <div className="absolute inset-1 rounded-full border border-dashed border-zinc-800 animate-[spin_20s_linear_infinite]" />
        <div className="absolute w-2 h-2 rounded-full bg-blue-500 animate-ping opacity-75" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        {/* Radar sweep */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-blue-500/10 animate-[spin_4s_linear_infinite]" />
      </div>

      <div className="z-10 flex-1 min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5 select-none">Report Location</dt>
        <dd className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
          <span>{state ? `${state}, ` : ''}{country || 'United States'}</span>
          {country && country.toUpperCase() !== 'US' && country.toUpperCase() !== 'USA' ? (
            <span className="text-xs text-zinc-500 font-mono">({country})</span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50">US Region</span>
          )}
        </dd>
        <p className="text-[9px] text-zinc-600 font-mono mt-0.5 uppercase tracking-tight">Geo-coordinates: System Resolved</p>
      </div>
    </div>
  );
}

// ── Category-specific detail sections ────────────────────────────────────────

function DrugDetail({ r }: { r: any }) {
  const drugs: any[] = r.patient?.drug || [];
  const reactions: any[] = r.patient?.reaction || [];

  const roleLabel = (code: string) => code === '1' ? 'Suspect' : code === '2' ? 'Concomitant' : code === '3' ? 'Interacting' : code;
  const roleColor = (code: string) => code === '1' ? 'red' : code === '2' ? 'zinc' : 'amber';
  const outcomeLabel = (code: string) => {
    const m: Record<string, string> = { '1': 'Recovered', '2': 'Recovering', '3': 'Not recovered', '4': 'Fatal', '5': 'Unknown', '6': 'Unknown' };
    return m[code] ?? code;
  };
  const outcomeColor = (code: string) => code === '4' ? 'red' : code === '1' ? 'emerald' : code === '2' ? 'blue' : 'zinc';

  const ageGroupMap: Record<string, string> = { '1': 'Neonate', '2': 'Infant', '3': 'Child', '4': 'Adolescent', '5': 'Adult', '6': 'Elderly' };
  const qualMap: Record<string, string> = { '1': 'Physician', '2': 'Pharmacist', '3': 'Other Health Professional', '4': 'Lawyer', '5': 'Consumer/Non-professional' };
  const reportTypeMap: Record<string, string> = { '1': 'Spontaneous', '2': 'From Study', '3': 'Other', '4': 'Not Applicable' };

  // Seriousness flags
  const flags = [
    r.seriousnessdeath === '1' && { label: '☠ Death', color: 'red' },
    r.seriousnesslifethreatening === '1' && { label: '⚡ Life-threatening', color: 'orange' },
    r.seriousnesshospitalization === '1' && { label: '🏥 Hospitalization', color: 'rose' },
    r.seriousnessdisabling === '1' && { label: 'Disabling', color: 'amber' },
    r.seriousnesscongenitalanomali === '1' && { label: 'Congenital Anomaly', color: 'violet' },
    r.seriousnessother === '1' && { label: 'Other Serious', color: 'amber' },
    r.serious !== '1' && { label: 'Non-serious', color: 'zinc' },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="space-y-5">
      {/* Seriousness */}
      <div>
        <SectionTitle><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Seriousness</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f, i) => <React.Fragment key={i}><Pill label={f.label} color={f.color} /></React.Fragment>)}
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-rose-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-rose-500">
        <SectionTitle><Activity className="w-3.5 h-3.5 text-rose-400" /> Patient</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Field label="Sex" value={r.patient?.patientsex === '1' ? 'Male' : r.patient?.patientsex === '2' ? 'Female' : null} />
          <Field label="Age Group" value={ageGroupMap[r.patient?.patientagegroup] ?? null} />
          <Field label="Onset Age" value={r.patient?.patientonsetage ? `${r.patient.patientonsetage} yr` : null} />
          <Field label="Weight" value={r.patient?.patientweight ? `${r.patient.patientweight} kg` : null} />
          <Field label="Country" value={r.primarysourcecountry || r.occurcountry} />
          <Field label="Report Type" value={reportTypeMap[r.reporttype] ?? r.reporttype} />
          <Field label="Reporter" value={qualMap[r.primarysource?.qualification] ?? r.primarysource?.qualification} />
        </div>
      </div>

      {/* Geographic Locator */}
      <GeographicLocator country={r.primarysourcecountry || r.occurcountry} />

      {/* Reactions */}
      <div>
        <SectionTitle><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Reactions ({reactions.length})</SectionTitle>
        {reactions.length > 0 ? (
          <div className="space-y-1.5">
            {reactions.map((rxn: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-rose-500/80 rounded-lg px-3 py-2 transition-colors hover:border-zinc-700 hover:border-l-rose-500">
                <span className="text-sm text-zinc-200 font-medium">{rxn.reactionmeddrapt}</span>
                {rxn.reactionoutcome && (
                  <Pill label={outcomeLabel(rxn.reactionoutcome)} color={outcomeColor(rxn.reactionoutcome)} />
                )}
              </div>
            ))}
          </div>
        ) : <EmptyNote />}
      </div>

      {/* Drugs */}
      <div>
        <SectionTitle><PillIcon className="w-3.5 h-3.5 text-blue-400" /> Drugs Involved ({drugs.length})</SectionTitle>
        <div className="space-y-3">
          {drugs.map((drug: any, i: number) => {
            const brand = Array.isArray(drug.openfda?.brand_name) ? drug.openfda.brand_name[0] : null;
            const generic = Array.isArray(drug.openfda?.generic_name) ? drug.openfda.generic_name[0] : null;
            const substance = drug.activesubstance?.activesubstancename || (Array.isArray(drug.openfda?.substance_name) ? drug.openfda.substance_name[0] : null);
            const mfr = Array.isArray(drug.openfda?.manufacturer_name) ? drug.openfda.manufacturer_name[0] : null;
            const pharmClass = Array.isArray(drug.openfda?.pharm_class_epc) ? drug.openfda.pharm_class_epc[0] : null;
            const route = Array.isArray(drug.openfda?.route) ? drug.openfda.route[0] : drug.drugadministrationroute;
            return (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-blue-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-blue-500">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-100 capitalize">{brand || drug.medicinalproduct || 'Unknown'}</p>
                    {(generic || substance) && <p className="text-xs text-zinc-500">{generic || substance}</p>}
                  </div>
                  <Pill label={`${roleLabel(drug.drugcharacterization)} #${i + 1}`} color={roleColor(drug.drugcharacterization)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                  <Field label="Manufacturer" value={mfr} />
                  <Field label="Indication" value={drug.drugindication} />
                  <Field label="Route" value={route} />
                  <Field label="Dosage Form" value={drug.drugdosageform} />
                  <Field label="Dosage" value={drug.drugdosagetext} />
                  <Field label="Pharmacologic Class" value={pharmClass} />
                  <Field label="Start Date" value={drug.drugstartdate} mono />
                  <Field label="End Date" value={drug.drugenddate} mono />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-zinc-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-zinc-500">
          <SectionTitle>Report Details</SectionTitle>
          <dl className="space-y-2.5">
            <Field label="Safety Report ID" value={r.safetyreportid} mono />
            <Field label="Version" value={r.safetyreportversion} />
            <Field label="Company Number" value={r.companynumb} mono />
            <Field label="Primary Source Country" value={r.primarysourcecountry} />
          </dl>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-zinc-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-zinc-500">
          <SectionTitle>Dates</SectionTitle>
          <dl className="space-y-2.5">
            <Field label="Received" value={r.receivedate} mono />
            <Field label="Receipt" value={r.receiptdate} mono />
            <Field label="Transmission" value={r.transmissiondate} mono />
          </dl>
        </div>
      </div>
    </div>
  );
}

function FoodDetail({ r }: { r: any }) {
  const products: any[] = r.products || [];
  const reactions: string[] = r.reactions || [];
  const outcomes: string[] = r.outcomes || [];

  const outcomeColor = (o: string) => {
    const l = o.toLowerCase();
    return l.includes('death') ? 'red' : l.includes('life threat') ? 'orange' : l.includes('hospital') ? 'rose' : l.includes('emergency') ? 'amber' : l.includes('disab') ? 'violet' : 'zinc';
  };

  return (
    <div className="space-y-5">
      {/* Outcomes */}
      {outcomes.length > 0 && (
        <div>
          <SectionTitle><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Outcomes ({outcomes.length})</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {outcomes.map((o, i) => <React.Fragment key={i}><Pill label={o} color={outcomeColor(o)} /></React.Fragment>)}
          </div>
        </div>
      )}

      {/* Consumer */}
      <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-emerald-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-emerald-500">
        <SectionTitle><Activity className="w-3.5 h-3.5 text-rose-400" /> Consumer</SectionTitle>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <Field label="Gender" value={r.consumer?.gender !== 'Not Available' ? r.consumer?.gender : null} />
          <Field label="Age" value={r.consumer?.age ? `${r.consumer.age} ${r.consumer.age_unit || 'yr'}` : null} />
          <Field label="Report #" value={r.report_number} mono />
          <Field label="Date Started" value={r.date_started} mono />
          <Field label="Date Created" value={r.date_created} mono />
        </div>
      </div>

      {/* Products */}
      <div>
        <SectionTitle><Apple className="w-3.5 h-3.5 text-emerald-400" /> Products ({products.length})</SectionTitle>
        <div className="space-y-2">
          {products.map((p: any, i: number) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-indigo-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-indigo-500">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-zinc-100">{p.name_brand || 'Unknown Brand'}</p>
                  {p.industry_name && <p className="text-xs text-zinc-500 mt-0.5">{p.industry_name}</p>}
                </div>
                {p.role && <Pill label={p.role} color="zinc" />}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <Field label="Industry Code" value={p.industry_code} mono />
                <Field label="Role" value={p.role} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reactions */}
      {reactions.length > 0 && (
        <div>
          <SectionTitle><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Reactions / Symptoms ({reactions.length})</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {reactions.map((rxn, i) => <React.Fragment key={i}><Pill label={rxn} color="rose" /></React.Fragment>)}
          </div>
        </div>
      )}
    </div>
  );
}

function TobaccoDetail({ r }: { r: any }) {
  const products: string[] = r.tobacco_products || [];
  const problems: string[] = r.reported_health_problems || [];
  const nonuser = r.nonuser_affected === 'Yes';

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-amber-500 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-zinc-100">{r.number_tobacco_products ?? products.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Products</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-rose-500 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-zinc-100">{r.number_health_problems ?? problems.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Health Problems</p>
        </div>
        <div className={cn('border border-l-2 rounded-xl p-4 text-center', nonuser ? 'bg-amber-950/40 border-amber-800 border-l-amber-500' : 'bg-zinc-900/50 border-zinc-800 border-l-zinc-500')}>
          <p className={cn('text-2xl font-bold', nonuser ? 'text-amber-300' : 'text-zinc-100')}>{nonuser ? 'Yes' : 'No'}</p>
          <p className={cn('text-xs mt-1', nonuser ? 'text-amber-500' : 'text-zinc-500')}>Non-user Affected</p>
        </div>
      </div>

      {/* Product types */}
      <div>
        <SectionTitle><Cigarette className="w-3.5 h-3.5 text-amber-400" /> Tobacco Products</SectionTitle>
        {products.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {products.map((p, i) => <React.Fragment key={i}><Pill label={p} color="amber" /></React.Fragment>)}
          </div>
        ) : <EmptyNote />}
      </div>

      {/* Health problems */}
      <div>
        <SectionTitle><Activity className="w-3.5 h-3.5 text-rose-400" /> Reported Health Problems</SectionTitle>
        {problems.length > 0 ? (
          <div className="space-y-1.5">
            {problems.map((p, i) => (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-rose-500/80 rounded-lg px-3 py-2 transition-colors hover:border-zinc-700 hover:border-l-rose-500">
                <span className="text-sm text-zinc-200">{p}</span>
              </div>
            ))}
          </div>
        ) : <EmptyNote />}
      </div>

      {/* Report details */}
      <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-zinc-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-zinc-500">
        <SectionTitle>Report Details</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Field label="Report ID" value={String(r.report_id ?? '')} mono />
          <Field label="Date Submitted" value={r.date_submitted} mono />
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ReportModal({
  rawReport,
  category,
  onClose,
  store,
  embedded = false,
  uid,
  showToast,
}: {
  rawReport: any;
  category: Category;
  onClose: () => void;
  store: ReturnType<typeof useStore>;
  embedded?: boolean;
  uid?: string | null;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const parsed = parseReport(category, rawReport);
  const r = rawReport;
  const [showRaw, setShowRaw] = useState(false);
  const { saveReport, removeReport, savedReports } = store;
  const existingSave = savedReports.find(r => r.id === parsed.id);
  const [justSaved, setJustSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleSave = () => {
    if (existingSave) {
      removeReport(parsed.id);
    } else {
      saveReport({
        id: parsed.id, category, title: parsed.title,
        summary: parsed.description.substring(0, 200),
        rawData: rawReport, notes: '', folderId: null,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  // ── Device-specific data extraction ────────────────────────────────────────
  const devices: any[]  = Array.isArray(r.device)  ? r.device  : r.device  ? [r.device]  : [];
  const patients: any[] = Array.isArray(r.patient) ? r.patient : r.patient ? [r.patient] : [];
  const mdrTexts: any[] = Array.isArray(r.mdr_text) ? r.mdr_text : [];
  const productProblems: string[] = Array.isArray(r.product_problems) ? r.product_problems : [];

  const narrativeText = category === 'device'
    ? mdrTexts.find(t => t.text_type_code === 'Description of Event or Problem')?.text || mdrTexts[0]?.text || ''
    : parsed.narrative || '';

  const otherTexts = mdrTexts.filter(
    t => t.text_type_code !== 'Description of Event or Problem' && t.text !== narrativeText
  );

  const mfr = r.manufacturer_name || r.manufacturer_d_name || devices[0]?.manufacturer_d_name || '';
  const mfrAddr = [
    r.manufacturer_address_1, r.manufacturer_address_2,
    r.manufacturer_city, r.manufacturer_state,
    r.manufacturer_zip_code, r.manufacturer_country,
  ].filter(Boolean).join(', ');

  const reportTypes: string[] = Array.isArray(r.type_of_report)
    ? r.type_of_report : r.type_of_report ? [r.type_of_report] : [];

  const timeline = category === 'device' ? [
    { label: 'Event Date',           value: r.date_of_event },
    { label: 'Report Date',          value: r.report_date },
    { label: 'Received by FDA',      value: r.date_received },
    { label: 'Received by Mfr',      value: r.date_manufacturer_received },
  ].filter(t => t.value && String(t.value).trim()) : [];

  // ── Header severity colour ─────────────────────────────────────────────────
  const headerGrad = (() => {
    if (category === 'device') {
      const evt = String(r.event_type || '').toLowerCase();
      return evt.includes('death')   ? 'from-red-950/80 to-zinc-950 border-red-900'
           : evt.includes('injury')  ? 'from-orange-950/70 to-zinc-950 border-orange-900'
           : evt.includes('malfunc') ? 'from-amber-950/60 to-zinc-950 border-amber-900'
           : 'from-zinc-900 to-zinc-950 border-zinc-800';
    }
    if (category === 'drug') {
      return r.seriousnessdeath === '1'       ? 'from-red-950/80 to-zinc-950 border-red-900'
           : r.seriousnesslifethreatening === '1' ? 'from-orange-950/70 to-zinc-950 border-orange-900'
           : r.seriousnesshospitalization === '1'  ? 'from-rose-950/60 to-zinc-950 border-rose-900'
           : r.serious === '1'                ? 'from-amber-950/50 to-zinc-950 border-amber-900'
           : 'from-zinc-900 to-zinc-950 border-zinc-800';
    }
    if (category === 'food') {
      const outs: string[] = r.outcomes || [];
      const hasDeaths = outs.some(o => o.toLowerCase().includes('death'));
      const hasHosp   = outs.some(o => o.toLowerCase().includes('hospital'));
      return hasDeaths ? 'from-red-950/80 to-zinc-950 border-red-900'
           : hasHosp   ? 'from-rose-950/60 to-zinc-950 border-rose-900'
           : 'from-zinc-900 to-zinc-950 border-zinc-800';
    }
    if (category === 'tobacco') {
      return r.nonuser_affected === 'Yes'
        ? 'from-amber-950/50 to-zinc-950 border-amber-900'
        : 'from-zinc-900 to-zinc-950 border-zinc-800';
    }
    return 'from-zinc-900 to-zinc-950 border-zinc-800';
  })();

  // Header pills per category
  const headerPills = (() => {
    if (category === 'device') {
      return [
        r.event_type && { label: r.event_type, color: String(r.event_type).toLowerCase().includes('death') ? 'red' : String(r.event_type).toLowerCase().includes('injury') ? 'amber' : 'indigo' },
        r.report_source_code && { label: r.report_source_code, color: 'zinc' },
        r.product_problem_flag === 'Y' && { label: 'Product Problem', color: 'amber' },
        r.adverse_event_flag === 'Y' && { label: 'Adverse Event', color: 'red' },
      ].filter(Boolean) as { label: string; color: string }[];
    }
    if (category === 'drug') {
      return [
        r.seriousnessdeath === '1' && { label: 'Fatal', color: 'red' },
        r.seriousnesslifethreatening === '1' && { label: 'Life-threatening', color: 'orange' },
        r.seriousnesshospitalization === '1' && { label: 'Hospitalized', color: 'rose' },
        r.serious === '1' && r.seriousnessdeath !== '1' && r.seriousnesslifethreatening !== '1' && r.seriousnesshospitalization !== '1' && { label: 'Serious', color: 'amber' },
        r.serious !== '1' && { label: 'Non-serious', color: 'zinc' },
      ].filter(Boolean) as { label: string; color: string }[];
    }
    if (category === 'food') {
      const outs: string[] = r.outcomes || [];
      return outs.slice(0, 3).map(o => {
        const l = o.toLowerCase();
        const color = l.includes('death') ? 'red' : l.includes('life threat') ? 'orange' : l.includes('hospital') ? 'rose' : l.includes('emergency') ? 'amber' : 'zinc';
        return { label: o, color };
      });
    }
    if (category === 'tobacco') {
      return [
        r.nonuser_affected === 'Yes' && { label: '⚠ Non-user Affected', color: 'amber' },
        { label: `${r.number_health_problems ?? 0} health problems`, color: 'zinc' },
      ].filter(Boolean) as { label: string; color: string }[];
    }
    return [];
  })();

  const outcomeColor = (o: string) => {
    const l = o.toLowerCase();
    return l.includes('death') ? 'red' : l.includes('hospital') ? 'rose' : l.includes('injur') ? 'amber' : 'zinc';
  };

  // Outer wrapper
  const Outer = ({ children }: { children: React.ReactNode }) => embedded ? (
    <div className="bg-zinc-950 w-full">{children}</div>
  ) : (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-zinc-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[96vh] flex flex-col border border-zinc-800"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return (
    <>
    <Outer>
      {/* ── HEADER BAND ───────────────────────────────────────────────────── */}
      <div className={cn('bg-gradient-to-r px-6 pt-5 pb-4 border-b flex items-start gap-4', headerGrad)}>
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono text-xs font-bold bg-black/30 text-zinc-200 px-2 py-0.5 rounded border border-zinc-700">
              {parsed.id || '—'}
            </span>
            {parsed.date && (
              <span className="text-zinc-400 text-xs font-mono">{formatDate(parsed.date)}</span>
            )}
            {headerPills.map((p, i) => (
              <React.Fragment key={i}><Pill label={p.label} color={p.color} /></React.Fragment>
            ))}
          </div>
          {/* Title */}
          <h2 className="text-lg font-bold text-zinc-50 leading-tight capitalize">{parsed.title}</h2>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <button
            onClick={handleSave}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              existingSave || justSaved
                ? 'bg-emerald-900 border-emerald-700 text-emerald-300'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
            )}
          >
            <Bookmark className={cn('w-3.5 h-3.5', (existingSave || justSaved) && 'fill-current')} />
            {justSaved ? 'Saved!' : existingSave ? 'Saved' : 'Save'}
          </button>
          {uid && (
            <button
              onClick={async () => {
                try {
                  const report = {
                    id: parsed.id, category, title: parsed.title,
                    summary: parsed.description.substring(0, 200),
                    rawData: rawReport, notes: '', folderId: null,
                    savedAt: Date.now(),
                  };
                  const url = await createShareLink(uid, 'report', { report });
                  setShareUrl(url);
                } catch (err) {
                  console.error('Share failed:', err);
                  showToast?.('Failed to share', 'error');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          )}
          {/* Download dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all">
              <Download className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full pt-1 w-36 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all">
              <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-lg py-1">
                <button
                  onClick={() => {
                    const sr: SavedReport = {
                      id: parsed.id, category, title: parsed.title,
                      summary: parsed.description.substring(0, 200),
                      rawData: rawReport, notes: '', folderId: null, savedAt: Date.now(),
                    };
                    exportSingleReportToPDF(sr);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >PDF</button>
                <button
                  onClick={() => {
                    const sr: SavedReport = {
                      id: parsed.id, category, title: parsed.title,
                      summary: parsed.description.substring(0, 200),
                      rawData: rawReport, notes: '', folderId: null, savedAt: Date.now(),
                    };
                    exportSingleReportToDOCX(sr);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >Word (.docx)</button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(rawReport, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${parsed.id}_report.json`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >JSON (raw)</button>
              </div>
            </div>
          </div>
          {!embedded && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ───────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex-1 p-5 space-y-5">

        {/* ── DRUG detail ───────────────────────────────────────────────── */}
        {category === 'drug' && <DrugDetail r={r} />}

        {/* ── FOOD detail ───────────────────────────────────────────────── */}
        {category === 'food' && <FoodDetail r={r} />}

        {/* ── TOBACCO detail ────────────────────────────────────────────── */}
        {category === 'tobacco' && <TobaccoDetail r={r} />}

        {/* ── DEVICE-specific sections ───────────────────────────────────── */}
        {category === 'device' && (
          <>
            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800/70 border-l-2 border-l-zinc-500">
                {timeline.map(t => (
                  <div key={t.label} className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <span className="text-zinc-500 font-medium">{t.label}:</span>
                    <span className="text-zinc-200 font-semibold font-mono">{formatDate(String(t.value))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Narrative */}
            <div>
              <SectionTitle empty={!narrativeText}>Description of Event or Problem</SectionTitle>
              {narrativeText ? (
                <div className="bg-zinc-900/60 border border-zinc-800 border-l-2 border-l-blue-500 rounded-xl px-5 py-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {narrativeText}
                </div>
              ) : (
                <EmptyNote>No narrative provided</EmptyNote>
              )}
              {otherTexts.map((t, i) => (
                <div key={i} className="mt-2 bg-zinc-900/40 border border-zinc-800/50 border-l-2 border-l-zinc-600 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">{t.text_type_code}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{t.text}</p>
                </div>
              ))}
            </div>

            {/* Device(s) */}
            {devices.length > 0 ? (
              <div>
                <SectionTitle>
                  <Box className="w-3.5 h-3.5 text-amber-500" />
                  {devices.length > 1 ? `Devices (${devices.length})` : 'Device'}
                </SectionTitle>
                <div className="space-y-3">
                  {devices.map((dev, di) => (
                    <div key={di} className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-amber-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-amber-500">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-3">
                        <Field label="Generic Name"    value={dev.generic_name} />
                        <Field label="Brand Name"      value={dev.brand_name} />
                        <Field label="Model #"         value={dev.model_number}   mono />
                        <Field label="Catalog #"       value={dev.catalog_number} mono />
                        <Field label="Product Code"    value={dev.device_report_product_code} mono />
                        <Field label="Lot #"           value={dev.lot_number} mono />
                        <Field label="Expiration"      value={dev.expiration_date_of_device} mono />
                        <Field label="Operator"        value={dev.device_operator} />
                        <Field label="Manufacturer"    value={dev.manufacturer_d_name} />
                      </div>
                      {(dev.udi_di || dev.udi_public) && (
                        <div className="mt-1 pt-3 border-t border-zinc-800">
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">UDI</dt>
                          <code className="text-xs text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded-lg block break-all">
                            {dev.udi_di || dev.udi_public}
                          </code>
                        </div>
                      )}
                      {(() => {
                        const pills: { label: string; color: string }[] = [];
                        if (dev.implant_flag === 'Y')      pills.push({ label: 'Implanted', color: 'indigo' });
                        if (dev.device_availability === 'Y') pills.push({ label: 'Device Available', color: 'emerald' });
                        if (dev.single_use_flag === 'Y')    pills.push({ label: 'Single-Use', color: 'violet' });
                        if (dev.device_age_text)             pills.push({ label: `Age: ${dev.device_age_text}`, color: 'zinc' });
                        if (dev.device_evaluated_by_manufacturer)
                          pills.push({ label: `Eval: ${dev.device_evaluated_by_manufacturer}`, color: 'zinc' });
                        return pills.length > 0 ? (
                           <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-800/50">
                            {pills.map((p, i) => <React.Fragment key={i}><Pill label={p.label} color={p.color} /></React.Fragment>)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="opacity-25">
                <SectionTitle empty><Box className="w-3.5 h-3.5" /> Device</SectionTitle>
                <EmptyNote />
              </div>
            )}

            {/* Product Problems */}
            {productProblems.length > 0 ? (
              <div>
                <SectionTitle>
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Product Problems
                </SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {productProblems.map((p, i) => <React.Fragment key={i}><Pill label={p} color="amber" /></React.Fragment>)}
                </div>
              </div>
            ) : (
              <div className="opacity-25">
                <SectionTitle empty><span className="w-2 h-2 rounded-full bg-amber-800 inline-block" /> Product Problems</SectionTitle>
                <EmptyNote />
              </div>
            )}

            {/* Patient(s) */}
            {patients.length > 0 ? (
              <div>
                <SectionTitle>
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  {patients.length > 1 ? `Patients (${patients.length})` : 'Patient'}
                </SectionTitle>
                <div className="space-y-3">
                  {patients.map((pat, pi) => {
                    const patProblems: string[] = Array.isArray(pat.patient_problems)
                      ? pat.patient_problems.filter(Boolean) : [];
                    const outcomes: string[] = Array.isArray(pat.sequence_number_outcome)
                      ? pat.sequence_number_outcome.filter(Boolean) : [];
                    const treatments: string[] = Array.isArray(pat.sequence_number_treatment)
                      ? pat.sequence_number_treatment.filter(Boolean) : [];
                    const hasData = patProblems.length > 0 || outcomes.length > 0
                      || pat.patient_age || pat.patient_sex || pat.patient_weight;

                    return (
                      <div key={pi} className={cn('border border-l-2 rounded-xl p-4 transition-colors hover:border-zinc-700',
                        hasData ? 'bg-zinc-900/50 border-zinc-800 border-l-rose-500 hover:border-l-rose-500' : 'bg-zinc-900/20 border-zinc-800/30 border-l-zinc-700 opacity-30 hover:border-l-zinc-700'
                      )}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-zinc-400">
                            Patient{patients.length > 1 ? ` #${pi + 1}` : ''}
                          </span>
                          {pat.patient_sequence_number && (
                            <span className="text-[10px] text-zinc-700 font-mono">seq:{pat.patient_sequence_number}</span>
                          )}
                          {!hasData && <EmptyNote>No data recorded</EmptyNote>}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-2 mb-3">
                          <Field label="Sex"       value={pat.patient_sex} />
                          <Field label="Age"       value={pat.patient_age} />
                          <Field label="Weight"    value={pat.patient_weight} />
                          <Field label="Ethnicity" value={pat.patient_ethnicity} />
                          <Field label="Race"      value={pat.patient_race} />
                        </div>
                        {outcomes.length > 0 ? (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">Outcomes</p>
                            <div className="flex flex-wrap gap-1.5">
                              {outcomes.map((o, oi) => (
                                <React.Fragment key={oi}><Pill label={o} color={outcomeColor(o)} /></React.Fragment>
                              ))}
                            </div>
                          </div>
                        ) : <p className="text-[10px] text-zinc-700 italic mb-2">Outcomes: not reported</p>}
                        {patProblems.length > 0 ? (
                          <div className="mb-2">
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">Patient Problems</p>
                            <div className="flex flex-wrap gap-1.5">
                              {patProblems.map((p, pi2) => (
                                <React.Fragment key={pi2}><Pill label={p} color="rose" /></React.Fragment>
                              ))}
                            </div>
                          </div>
                        ) : <p className="text-[10px] text-zinc-700 italic mb-2">Patient problems: not reported</p>}
                        {treatments.filter(t => t.trim()).length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">Treatments</p>
                            <div className="flex flex-wrap gap-1.5">
                              {treatments.map((t, ti) => (
                                <React.Fragment key={ti}><Pill label={t} color="emerald" /></React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="opacity-25">
                <SectionTitle empty><Activity className="w-3.5 h-3.5" /> Patient</SectionTitle>
                <EmptyNote />
              </div>
            )}

            {/* Manufacturer & Reporter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={cn('border border-l-2 rounded-xl p-4 transition-colors hover:border-zinc-700',
                mfr ? 'bg-zinc-900/50 border-zinc-800 border-l-zinc-600 hover:border-l-zinc-600' : 'bg-zinc-900/20 border-zinc-800/30 border-l-zinc-800 opacity-25 hover:border-l-zinc-800',
              )}>
                <SectionTitle empty={!mfr}>Manufacturer</SectionTitle>
                <dl className="space-y-2.5">
                  <Field label="Name"    value={mfr} />
                  <Field label="Address" value={mfrAddr || null} />
                  <Field label="Contact" value={r.manufacturer_contact_t_name || null} />
                </dl>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 border-l-2 border-l-blue-500 rounded-xl p-4 transition-colors hover:border-zinc-700 hover:border-l-blue-500">
                <SectionTitle>Reporter</SectionTitle>
                <dl className="space-y-2.5">
                  <Field label="Event Location"  value={r.event_location} />
                  <Field label="State"           value={r.reporter_state_code} />
                  <Field label="Occupation"      value={r.reporter_occupation_code} />
                  <Field label="Report to FDA"   value={r.report_to_fda} />
                  <Field label="Report to Mfr"   value={r.report_to_manufacturer} />
                </dl>
              </div>
            </div>

            {/* Geographic Locator */}
            <GeographicLocator state={r.reporter_state_code} country="United States" />

            {/* Report Classification */}
            {(() => {
              const hasMeta = reportTypes.length > 0 || r.report_source_code || r.reprocessed_and_reused_flag === 'Y'
                || r.exemption_number || r.pma_pmn_number || r.manufacturer_link_flag === 'Y';
              return hasMeta ? (
                <div>
                  <SectionTitle>Report Classification</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {reportTypes.map((t, i) => <React.Fragment key={i}><Pill label={t} color="blue" /></React.Fragment>)}
                    {r.report_source_code && <Pill label={`Source: ${r.report_source_code}`} color="zinc" />}
                    {r.reprocessed_and_reused_flag === 'Y' && <Pill label="Reprocessed & Reused" color="amber" />}
                    {r.exemption_number && <Pill label={`Exemption: ${r.exemption_number}`} color="zinc" />}
                    {r.pma_pmn_number && <Pill label={`PMA/PMN: ${r.pma_pmn_number}`} color="indigo" />}
                    {r.manufacturer_link_flag === 'Y' && <Pill label="Manufacturer Linked" color="emerald" />}
                  </div>
                </div>
              ) : (
                <div className="opacity-25">
                  <SectionTitle empty>Report Classification</SectionTitle>
                  <EmptyNote />
                </div>
              );
            })()}
          </>
        )}

        {/* ── RAW JSON (collapsible, all categories) ────────────────────── */}
        <div className="border-t border-zinc-800/50 pt-4">
          <button
            onClick={() => setShowRaw(s => !s)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform duration-150', showRaw && 'rotate-90')} />
            {showRaw ? 'Hide' : 'Show'} raw JSON
          </button>
          {showRaw && (
            <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-400 overflow-x-auto max-h-72">
              <pre>{JSON.stringify(rawReport, null, 2)}</pre>
            </div>
          )}
        </div>

      </div>{/* end scrollable */}
    </Outer>
    {shareUrl && <ShareLinkDialog url={shareUrl} onClose={() => setShareUrl(null)} />}
    </>
  );
}
