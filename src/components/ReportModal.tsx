import React, { useState } from 'react';
import { cn, formatDate } from '../lib/utils';
import { parseReport } from '../lib/api';
import { useStore } from '../store';
import type { Category } from '../types';
import {
  X, Bookmark, Clock, Box, Activity, ChevronRight
} from 'lucide-react';

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

// ── Main component ───────────────────────────────────────────────────────────

export default function ReportModal({
  rawReport,
  category,
  onClose,
  store,
  embedded = false,
}: {
  rawReport: any;
  category: Category;
  onClose: () => void;
  store: ReturnType<typeof useStore>;
  embedded?: boolean;
}) {
  const parsed = parseReport(category, rawReport);
  const r = rawReport;
  const [showRaw, setShowRaw] = useState(false);
  const { saveReport } = store;
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    saveReport({
      id: parsed.id, category, title: parsed.title,
      summary: parsed.description.substring(0, 200),
      rawData: rawReport, notes: '', folderId: null,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // ── Data extraction ────────────────────────────────────────────────────────
  const devices: any[]  = Array.isArray(r.device)  ? r.device  : r.device  ? [r.device]  : [];
  const patients: any[] = Array.isArray(r.patient) ? r.patient : r.patient ? [r.patient] : [];
  const mdrTexts: any[] = Array.isArray(r.mdr_text) ? r.mdr_text : [];
  const productProblems: string[] = Array.isArray(r.product_problems) ? r.product_problems : [];

  const narrativeText = mdrTexts.find(
    t => t.text_type_code === 'Description of Event or Problem'
  )?.text || mdrTexts[0]?.text || parsed.narrative || '';

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

  const timeline = [
    { label: 'Event Date',           value: r.date_of_event },
    { label: 'Report Date',          value: r.report_date },
    { label: 'Received by FDA',      value: r.date_received },
    { label: 'Received by Mfr',      value: r.date_manufacturer_received },
  ].filter(t => t.value && String(t.value).trim());

  // ── Severity colour for header ─────────────────────────────────────────────
  const evt = String(r.event_type || '').toLowerCase();
  const headerGrad =
    evt.includes('death')    ? 'from-red-950/80 to-zinc-950 border-red-900'    :
    evt.includes('injury')   ? 'from-orange-950/70 to-zinc-950 border-orange-900' :
    evt.includes('malfunc')  ? 'from-amber-950/60 to-zinc-950 border-amber-900' :
    'from-zinc-900 to-zinc-950 border-zinc-800';

  const evtPillColor =
    evt.includes('death')   ? 'red'   :
    evt.includes('injury')  ? 'amber' :
    evt.includes('malfunc') ? 'amber' : 'indigo';

  const outcomeColor = (o: string) => {
    const l = o.toLowerCase();
    return l.includes('death') ? 'red' : l.includes('hospital') ? 'rose' : l.includes('injur') ? 'amber' : 'zinc';
  };

  // Outer wrapper: fixed overlay for modal mode, plain div for embedded mode
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
    <Outer>
      {/* ── HEADER BAND ───────────────────────────────────────────────────── */}
      <div className={cn('bg-gradient-to-r px-6 pt-5 pb-4 border-b flex items-start gap-4', headerGrad)}>
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono text-xs font-bold bg-black/30 text-zinc-200 px-2 py-0.5 rounded border border-zinc-700">
                {parsed.id || r.mdr_report_key || r.report_number || '—'}
              </span>
              {parsed.date && (
                <span className="text-zinc-400 text-xs font-mono">{formatDate(parsed.date)}</span>
              )}
              {r.event_type && <Pill label={r.event_type} color={evtPillColor} />}
              {r.report_source_code && <Pill label={r.report_source_code} color="zinc" />}
              {r.product_problem_flag === 'Y' && (
                <Pill label="Product Problem" color="amber" />
              )}
              {r.adverse_event_flag === 'Y' && (
                <Pill label="Adverse Event" color="red" />
              )}
            </div>
            {/* Title */}
            <h2 className="text-lg font-bold text-zinc-50 leading-tight capitalize">{parsed.title}</h2>
          </div>
          {/* Actions — hide close button in embedded mode, save is always available */}
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <button
              onClick={handleSave}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                isSaved
                  ? 'bg-emerald-900 border-emerald-700 text-emerald-300'
                  : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
              )}
            >
              <Bookmark className={cn('w-3.5 h-3.5', isSaved && 'fill-current')} />
              {isSaved ? 'Saved!' : 'Save'}
            </button>
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

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800/70">
              {timeline.map(t => (
                <div key={t.label} className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="text-zinc-500 font-medium">{t.label}:</span>
                  <span className="text-zinc-200 font-semibold font-mono">{formatDate(String(t.value))}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── NARRATIVE ─────────────────────────────────────────────────── */}
          <div>
            <SectionTitle empty={!narrativeText}>Description of Event or Problem</SectionTitle>
            {narrativeText ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {narrativeText}
              </div>
            ) : (
              <EmptyNote>No narrative provided</EmptyNote>
            )}
            {otherTexts.map((t, i) => (
              <div key={i} className="mt-2 bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">{t.text_type_code}</p>
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{t.text}</p>
              </div>
            ))}
          </div>

          {/* ── DEVICE(S) ─────────────────────────────────────────────────── */}
          {devices.length > 0 ? (
            <div>
              <SectionTitle>
                <Box className="w-3.5 h-3.5 text-amber-500" />
                {devices.length > 1 ? `Devices (${devices.length})` : 'Device'}
              </SectionTitle>
              <div className="space-y-3">
                {devices.map((dev, di) => (
                  <div key={di} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    {/* Core fields */}
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
                    {/* UDI */}
                    {(dev.udi_di || dev.udi_public) && (
                      <div className="mt-1 pt-3 border-t border-zinc-800">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">UDI</dt>
                        <code className="text-xs text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded-lg block break-all">
                          {dev.udi_di || dev.udi_public}
                        </code>
                      </div>
                    )}
                    {/* Status pills */}
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

          {/* ── PRODUCT PROBLEMS ──────────────────────────────────────────── */}
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

          {/* ── PATIENT(S) ────────────────────────────────────────────────── */}
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
                    <div key={pi}
                      className={cn('border rounded-xl p-4',
                        hasData
                          ? 'bg-zinc-900/50 border-zinc-800'
                          : 'bg-zinc-900/20 border-zinc-800/30 opacity-30'
                      )}>
                      {/* Patient header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-zinc-400">
                          Patient{patients.length > 1 ? ` #${pi + 1}` : ''}
                        </span>
                        {pat.patient_sequence_number && (
                          <span className="text-[10px] text-zinc-700 font-mono">
                            seq:{pat.patient_sequence_number}
                          </span>
                        )}
                        {!hasData && <EmptyNote>No data recorded</EmptyNote>}
                      </div>

                      {/* Demographics grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-2 mb-3">
                        <Field label="Sex"       value={pat.patient_sex} />
                        <Field label="Age"       value={pat.patient_age} />
                        <Field label="Weight"    value={pat.patient_weight} />
                        <Field label="Ethnicity" value={pat.patient_ethnicity} />
                        <Field label="Race"      value={pat.patient_race} />
                      </div>

                      {/* Outcomes */}
                      {outcomes.length > 0 ? (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                            Outcomes
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                                {outcomes.map((o, oi) => (
                                  <React.Fragment key={oi}><Pill label={o} color={outcomeColor(o)} /></React.Fragment>
                                ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-700 italic mb-2">Outcomes: not reported</p>
                      )}

                      {/* Patient problems */}
                      {patProblems.length > 0 ? (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                            Patient Problems
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                                {patProblems.map((p, pi2) => (
                                  <React.Fragment key={pi2}><Pill label={p} color="rose" /></React.Fragment>
                                ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-700 italic mb-2">Patient problems: not reported</p>
                      )}

                      {/* Treatments */}
                      {treatments.filter(t => t.trim()).length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                            Treatments
                          </p>
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

          {/* ── MANUFACTURER & REPORTER ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Manufacturer */}
            <div className={cn(
              'border rounded-xl p-4',
              mfr ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-900/20 border-zinc-800/30 opacity-25',
            )}>
              <SectionTitle empty={!mfr}>Manufacturer</SectionTitle>
              <dl className="space-y-2.5">
                <Field label="Name"    value={mfr} />
                <Field label="Address" value={mfrAddr || null} />
                <Field label="Contact" value={r.manufacturer_contact_t_name || null} />
              </dl>
            </div>
            {/* Reporter */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
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

          {/* ── REPORT CLASSIFICATION ─────────────────────────────────────── */}
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

          {/* ── RAW JSON (collapsible) ────────────────────────────────────── */}
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
  );
}
