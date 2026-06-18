import { Category } from '../types';
import { generateId } from './utils';

const BASE_URL = 'https://api.fda.gov';

const CATEGORY_CONFIGS: Record<Category, { endpoint: string, searchFields: string[], countQuery: string, timeQuery: string }> = {
  drug: {
    endpoint: '/drug/event.json',
    searchFields: ['patient.drug.medicinalproduct', 'patient.drug.openfda.brand_name', 'patient.drug.openfda.generic_name'],
    countQuery: 'patient.reaction.reactionmeddrapt.exact',
    timeQuery: 'receiptdate'
  },
  device: {
    endpoint: '/device/event.json',
    searchFields: ['device.generic_name', 'device.openfda.device_name', 'device.brand_name'],
    countQuery: 'event_type.exact',
    timeQuery: 'date_received'
  },
  food: {
    endpoint: '/food/event.json',
    searchFields: ['products.name_brand', 'products.industry_name'],
    countQuery: 'outcomes.exact',
    timeQuery: 'date_created'
  },
  tobacco: {
    endpoint: '/tobacco/problem.json',
    searchFields: ['tobacco_products', 'reported_health_problems'],
    countQuery: 'reported_health_problems.exact',
    timeQuery: 'date_submitted'
  }
};

/** Named search field groups per category, keyed by an ID used in FiltersState.searchField */
export const SEARCH_FIELD_GROUPS: Partial<Record<Category, Record<string, { label: string; fields: string[] }>>> = {
  device: {
    name:         { label: 'Device Name / Brand', fields: ['device.generic_name', 'device.openfda.device_name', 'device.brand_name'] },
    manufacturer: { label: 'Manufacturer',         fields: ['device.manufacturer_d_name'] },
    model:        { label: 'Model / Catalog #',    fields: ['device.model_number', 'device.catalog_number'] },
    product_code: { label: 'Product Code',         fields: ['device.device_report_product_code'] },
    report_number:{ label: 'Report Number',        fields: ['mdr_report_key', 'report_number'] },
    exemption:    { label: 'Exemption #',          fields: ['exemption_number'] },
    udi:          { label: 'UDI',                  fields: ['device.udi_di', 'device.udi_public'] },
  },
  drug: {
    name:        { label: 'Drug / Brand Name',    fields: ['patient.drug.medicinalproduct', 'patient.drug.openfda.brand_name', 'patient.drug.openfda.generic_name'] },
    reaction:    { label: 'Reaction (MedDRA)',     fields: ['patient.reaction.reactionmeddrapt'] },
    manufacturer:{ label: 'Manufacturer',          fields: ['patient.drug.openfda.manufacturer_name'] },
    ingredient:  { label: 'Active Ingredient',     fields: ['patient.drug.activesubstance.activesubstancename', 'patient.drug.openfda.substance_name'] },
    indication:  { label: 'Drug Indication',       fields: ['patient.drug.drugindication'] },
    report_id:   { label: 'Report ID',             fields: ['safetyreportid'] },
    pharm_class: { label: 'Pharmacologic Class',   fields: ['patient.drug.openfda.pharm_class_epc'] },
  },
  food: {
    name:        { label: 'Product / Brand Name', fields: ['products.name_brand'] },
    reaction:    { label: 'Reaction / Symptom',    fields: ['reactions'] },
    industry:    { label: 'Product Category',      fields: ['products.industry_name'] },
    outcome:     { label: 'Outcome',               fields: ['outcomes'] },
    report_id:   { label: 'Report Number',         fields: ['report_number'] },
  },
  tobacco: {
    name:        { label: 'Product Type',          fields: ['tobacco_products'] },
    problem:     { label: 'Health Problem',         fields: ['reported_health_problems'] },
  },
};

/** Order in which field groups are tried for auto-fallback */
const FIELD_GROUP_FALLBACK_ORDER: Partial<Record<Category, string[]>> = {
  device: ['name', 'manufacturer', 'model', 'product_code', 'report_number', 'exemption', 'udi'],
  drug:   ['name', 'reaction', 'manufacturer', 'ingredient', 'indication', 'pharm_class', 'report_id'],
  food:   ['name', 'reaction', 'industry', 'outcome', 'report_id'],
  tobacco:['name', 'problem'],
};

/**
 * Auto-detect which field group key is most appropriate for a query.
 * Returns a group key, or null if no specific pattern is detected (use default 'name').
 */
export function detectQueryFieldKey(category: Category, query: string): string {
  const q = query.trim();
  if (category === 'device') {
    if (/^\d{4,}$/.test(q))                                               return 'report_number';
    if (/^[A-Z]{2,3}$/.test(q))                                           return 'product_code';
    if (q.length > 25 || /^\(01\)/.test(q) || /^\(00\)/.test(q))         return 'udi';
    if (q.length <= 20 && !/\s/.test(q) && /\d/.test(q) && /[A-Za-z]/.test(q)) return 'model';
  }
  if (category === 'drug') {
    if (/^[0-9]{4}-[0-9]{4}-[0-9]{2}$/.test(q)) return 'ndc';
    if (/^\d{7,10}$/.test(q)) return 'report_id';
  }
  if (category === 'food') {
    if (/^\d{6,}$/.test(q)) return 'report_id';
  }
  return 'name';
}

/** Resolve a field group key to actual FDA field strings for a category */
export function resolveSearchFields(category: Category, fieldKey: string): string[] {
  return SEARCH_FIELD_GROUPS[category]?.[fieldKey]?.fields ?? CATEGORY_CONFIGS[category].searchFields;
}

/** 
 * Given a query that returned 0 results with `triedKey`, probe all other field groups 
 * in parallel and return the first key that has results (or null if none).
 */
export async function probeFallbackFields(
  category: Category,
  query: string,
  triedKey: string
): Promise<string | null> {
  const order = FIELD_GROUP_FALLBACK_ORDER[category] ?? [];
  const toProbe = order.filter(k => k !== triedKey);
  if (toProbe.length === 0) return null;

  const probes = await Promise.all(
    toProbe.map(async key => {
      const fields = resolveSearchFields(category, key);
      const res = await fetchFDAData(category, query, 0, 1, fields);
      return { key, hasResults: (res?.results?.length ?? 0) > 0 };
    })
  );

  return probes.find(p => p.hasResults)?.key ?? null;
}

export async function fetchFDAData(
  category: Category,
  query: string,
  skip = 0,
  limit = 20,
  searchFieldsOverride?: string[]
) {
  if (!query) return null;
  const config = CATEGORY_CONFIGS[category];
  const fields = searchFieldsOverride ?? config.searchFields;
  
  // Construct search string: field1:"query" OR field2:"query"
  const searchTerms = fields.map(field => `${field}:"${query}"`).join('+OR+');
  
  const url = `${BASE_URL}${config.endpoint}?search=${searchTerms}&limit=${limit}&skip=${skip}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return { results: [], meta: { results: { total: 0, skip, limit } } };
      throw new Error('API Request Failed');
    }
    return await response.json();
  } catch (err) {
    console.error('FDA Fetch Error:', err);
    return null;
  }
}

export function parseReport(category: Category, item: any) {
  let id = '';
  let title = '';
  let date = '';
  let events: string[] = [];
  let description = '';
  let narrative = '';
  let deviceProblems: string[] = [];
  let patientProblems: string[] = [];
  let patient: { sex?: string, age?: string, weight?: string, ageGroup?: string, country?: string } = {};

  switch (category) {
    case 'drug': {
      id = item.safetyreportid || generateId();
      // Prefer suspect drug; fall back to first drug in list
      const suspectDrug = item.patient?.drug?.find((d: any) => d.drugcharacterization === '1') || item.patient?.drug?.[0];
      const brandName = Array.isArray(suspectDrug?.openfda?.brand_name) ? suspectDrug.openfda.brand_name[0] : null;
      const genericName = Array.isArray(suspectDrug?.openfda?.generic_name) ? suspectDrug.openfda.generic_name[0] : null;
      title = brandName || genericName || suspectDrug?.medicinalproduct || 'Unknown Drug';
      date = item.receivedate || item.receiptdate || item.transmissiondate || '';
      events = (item.patient?.reaction || []).map((r: any) => r.reactionmeddrapt).filter(Boolean);
      // Demographics
      const sexCode = item.patient?.patientsex;
      patient.sex = sexCode === '1' ? 'Male' : sexCode === '2' ? 'Female' : 'Unknown';
      const ageGroupCode = item.patient?.patientagegroup;
      const ageGroupMap: Record<string, string> = { '1': 'Neonate', '2': 'Infant', '3': 'Child', '4': 'Adolescent', '5': 'Adult', '6': 'Elderly' };
      patient.ageGroup = ageGroupCode ? (ageGroupMap[ageGroupCode] ?? '') : '';
      const ageVal = item.patient?.patientonsetage;
      const ageUnit = item.patient?.patientonsetageunit;
      const ageUnitMap: Record<string, string> = { '800': 'decades', '801': 'yr', '802': 'mo', '803': 'wk', '804': 'days', '805': 'hr' };
      patient.age = ageVal ? `${ageVal} ${ageUnit ? ageUnitMap[ageUnit] ?? '' : 'yr'}`.trim() : patient.ageGroup || '';
      patient.weight = item.patient?.patientweight ? `${item.patient.patientweight} kg` : '';
      patient.country = item.primarysourcecountry || item.occurcountry || '';
      // Seriousness
      const serious = item.serious === '1';
      const fatal = item.seriousnessdeath === '1';
      const hospitalized = item.seriousnesshospitalization === '1';
      const lifeThreatening = item.seriousnesslifethreatening === '1';
      // All drugs involved
      const allDrugs: string[] = (item.patient?.drug || []).map((d: any) =>
        Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : d.medicinalproduct
      ).filter(Boolean);
      // Build description
      const severityLabel = fatal ? '⚠️ Fatal' : lifeThreatening ? '🔴 Life-threatening' : hospitalized ? '🏥 Hospitalized' : serious ? '⚡ Serious' : '';
      const descParts = [
        severityLabel,
        patient.sex !== 'Unknown' ? patient.sex : '',
        patient.age ? `Age: ${patient.age}` : '',
        patient.country,
        allDrugs.length > 1 ? `${allDrugs.length} drugs` : '',
      ].filter(Boolean);
      description = descParts.join(' · ') || 'No details';
      narrative = item.patient?.summary?.narrativeincludeclinical || '';
      // patientProblems = reactions for Drug
      patientProblems = events;
      // deviceProblems = seriousness flags for Drug
      deviceProblems = [
        fatal ? 'Death' : '',
        hospitalized ? 'Hospitalization' : '',
        lifeThreatening ? 'Life Threatening' : '',
        item.seriousnessdisabling === '1' ? 'Disabling' : '',
        item.seriousnesscongenitalanomali === '1' ? 'Congenital Anomaly' : '',
        item.seriousnessother === '1' ? 'Other Serious' : '',
      ].filter(Boolean);
      break;
    }
    case 'device': {
      id = item.mdr_report_key || generateId();
      title = item.device?.[0]?.generic_name || item.device?.[0]?.brand_name || 'Unknown Device';
      date = item.date_received || item.date_of_event || '';
      events = [item.event_type].filter(Boolean);
      narrative = item.mdr_text?.find((t: any) => t.text_type_code === 'Description of Event or Problem')?.text || item.mdr_text?.[0]?.text || '';
      description = narrative || 'No description provided';
      deviceProblems = Array.isArray(item.product_problems) && item.product_problems.length > 0
        ? item.product_problems.flat().filter(Boolean)
        : item.device?.flatMap((d: any) => d.device_problem_code ? [d.device_problem_code].flat() : []).filter(Boolean) ?? [];
      const pArray = Array.isArray(item.patient) ? item.patient : (item.patient ? [item.patient] : []);
      patientProblems = pArray.flatMap((p: any) =>
        Array.isArray(p.patient_problems) && p.patient_problems.length > 0
          ? p.patient_problems
          : p.patient_problem_code ? [p.patient_problem_code].flat() : []
      ).filter(Boolean);
      break;
    }
    case 'food': {
      id = item.report_number || generateId();
      const allProducts: any[] = item.products || [];
      const brandNames = allProducts.map((p: any) => p.name_brand).filter(Boolean);
      const industryNames = [...new Set(allProducts.map((p: any) => p.industry_name).filter(Boolean))] as string[];
      title = brandNames.join(' + ') || industryNames[0] || 'Unknown Food Product';
      date = item.date_created || item.date_started || '';
      // Events = reactions first, then outcomes
      const reactions: string[] = item.reactions || [];
      const outcomes: string[] = item.outcomes || [];
      events = reactions.length > 0 ? reactions : outcomes;
      // Demographics
      patient.sex = item.consumer?.gender || 'Unknown';
      const cAge = item.consumer?.age;
      const cUnit = item.consumer?.age_unit || 'yr';
      patient.age = cAge ? `${cAge} ${cUnit}` : '';
      // Description
      const outcomeLabel = outcomes.length > 0 ? outcomes.slice(0, 2).join(', ') : '';
      const foodParts = [
        outcomeLabel,
        industryNames.length > 0 ? industryNames[0] : '',
        patient.age ? `Age: ${patient.age}` : '',
        patient.sex !== 'Unknown' ? patient.sex : '',
      ].filter(Boolean);
      description = foodParts.join(' · ') || 'No additional details';
      narrative = '';
      // For QuickFilter compatibility:
      patientProblems = reactions;  // reactions = patient-side problems
      deviceProblems = outcomes;    // outcomes = product-side consequences
      break;
    }
    case 'tobacco': {
      id = String(item.report_id ?? generateId());
      const products: string[] = item.tobacco_products || [];
      title = products.slice(0, 2).join(', ') || 'Unknown Tobacco Product';
      date = item.date_submitted || '';
      events = item.reported_health_problems || [];
      const nonuser = item.nonuser_affected === 'Yes';
      const numProblems: number = item.number_health_problems ?? events.length;
      const tobaccoParts = [
        nonuser ? '⚠️ Non-user affected' : '',
        numProblems > 1 ? `${numProblems} health problems` : '',
        products.length > 2 ? `${products.length} product types` : '',
      ].filter(Boolean);
      description = tobaccoParts.join(' · ') || 'See health problems below';
      narrative = '';
      patientProblems = item.reported_health_problems || [];
      deviceProblems = products;  // product types
      break;
    }
  }

  return { id, title, date, events, description, narrative, deviceProblems, patientProblems, patient };
}

// ── Device identifier extraction from MAUDE results ─────────────────────────
export interface DeviceIdentifier {
  brandName: string;
  genericName: string;
  productCode: string;
  kNumbers: string[];
  deviceName: string; // openfda.device_name
  manufacturer: string;
}

/** Extract unique device identifiers from an array of MAUDE event records. */
export function extractDeviceIdentifiers(results: any[]): DeviceIdentifier[] {
  const seen = new Set<string>();
  const identifiers: DeviceIdentifier[] = [];
  for (const r of results) {
    const devices: any[] = Array.isArray(r.device) ? r.device : [];
    for (const d of devices) {
      const brand = (d.brand_name || '').trim();
      const generic = (d.generic_name || '').trim();
      const productCode = (d.device_report_product_code || '').trim();
      const deviceName = (d.openfda?.device_name || '').trim();
      const manufacturer = (d.manufacturer_d_name || '').trim();
      const kNums: string[] = [];
      if (d.openfda?.k_number) kNums.push(...(Array.isArray(d.openfda.k_number) ? d.openfda.k_number : [d.openfda.k_number]));
      // Key by brand+generic+productCode to deduplicate
      const key = `${brand}||${generic}||${productCode}`;
      if (!seen.has(key) && (brand || generic || productCode || deviceName)) {
        seen.add(key);
        identifiers.push({ brandName: brand, genericName: generic, productCode, kNumbers: kNums, deviceName, manufacturer });
      }
    }
  }
  return identifiers;
}

// ── Recall search precision helpers ──────────────────────────────────────────

/** Normalize a firm name for fuzzy comparison (strip legal suffixes, lowercase). */
export function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|sa|plc|ag|bv|nv|pty|srl|sas|spa)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Given a set of manufacturer groups, return all aliases for the canonical group
 * that contains `rawFirmName`, or just [rawFirmName] if none found.
 */
export function resolveManufacturerAliases(
  rawFirmName: string,
  groups: { name: string; aliases: string[] }[]
): string[] {
  const norm = normalizeFirmName(rawFirmName);
  for (const g of groups) {
    const normed = g.aliases.map(a => normalizeFirmName(a));
    if (normed.some(a => a === norm || a.includes(norm) || norm.includes(a))) {
      return g.aliases;
    }
  }
  return [rawFirmName];
}

/**
 * Auto-suggest manufacturer groups from a flat list of raw firm names.
 * Uses normalized string overlap to cluster similar names.
 */
export function autoGroupManufacturers(rawFirms: string[]): { name: string; aliases: string[] }[] {
  const norms = rawFirms.map(f => ({ raw: f, norm: normalizeFirmName(f) }));
  const clusters: string[][] = [];
  const assigned = new Set<string>();

  for (const { raw, norm } of norms) {
    if (assigned.has(raw)) continue;
    const cluster = [raw];
    assigned.add(raw);
    // Look for others that share ≥3 consecutive words
    const words = norm.split(' ').filter(w => w.length > 2);
    for (const other of norms) {
      if (assigned.has(other.raw)) continue;
      const otherWords = other.norm.split(' ').filter(w => w.length > 2);
      const shared = words.filter(w => otherWords.includes(w));
      if (shared.length >= Math.min(2, words.length)) {
        cluster.push(other.raw);
        assigned.add(other.raw);
      }
    }
    if (cluster.length > 1) clusters.push(cluster);
  }
  return clusters.map(aliases => ({
    name: aliases[0], // user can rename
    aliases,
  }));
}

/**
 * Build an openFDA recall search — precision-first per-identifier strategy.
 *
 * For each unique device identifier from MAUDE results, build the tightest
 * possible AND query combining brand name + manufacturer + product code.
 *
 * Tier 1 (tightest): product_description:"DreamStation" AND recalling_firm:"Philips Respironics" AND product_code:"LYU"
 * Tier 2 (no code):  product_description:"DreamStation" AND recalling_firm:"Philips Respironics"
 * Tier 3 (k-number): openfda.k_number:"K123456"
 * Tier 4 (brand only, last resort): product_description:"DreamStation"
 *
 * NEVER use: openfda.device_name (too generic — entire device class)
 * NEVER use: product_code alone (entire device class from all manufacturers)
 */
function buildRecallSearchTerms(
  identifiers: DeviceIdentifier[],
  fallbackQuery: string,
  mfrGroups: { name: string; aliases: string[] }[] = []
): string {
  if (identifiers.length === 0) {
    return `product_description:"${fallbackQuery}"`;
  }

  const seen = new Set<string>();
  const tier1: string[] = [];  // brand + firm + code
  const tier2: string[] = [];  // brand + firm
  const tier3: string[] = [];  // k_number
  const tier4: string[] = [];  // brand only

  const isGenericBrand = (b: string) =>
    b.length <= 4 || /^(mask|cpap|bipap|apap|vpap|ventilator|pump|probe|sensor|device|system|unit|monitor|kit|set)$/i.test(b.trim());

  for (const id of identifiers) {
    const brand = id.brandName.trim();
    const code  = id.productCode.trim();
    const mfr   = id.manufacturer.trim();

    // Expand manufacturer through groups (handles "PHILIPS RESPIRONICS INC" → all aliases)
    const firmAliases = mfr.length > 2
      ? resolveManufacturerAliases(mfr, mfrGroups)
      : [];
    const firms = [...new Set(firmAliases)].slice(0, 3);

    if (!isGenericBrand(brand) && firms.length > 0 && code) {
      // Tier 1: brand + firm + product_code (most specific)
      for (const firm of firms) {
        const key = `${brand}||${firm}||${code}`;
        if (!seen.has(key)) {
          seen.add(key);
          tier1.push(`(product_description:"${brand}"+AND+recalling_firm:"${firm}"+AND+product_code:"${code}")`);
        }
      }
    } else if (!isGenericBrand(brand) && firms.length > 0) {
      // Tier 2: brand + firm (no product code available)
      for (const firm of firms) {
        const key = `${brand}||${firm}`;
        if (!seen.has(key)) {
          seen.add(key);
          tier2.push(`(product_description:"${brand}"+AND+recalling_firm:"${firm}")`);
        }
      }
    } else if (!isGenericBrand(brand)) {
      // Tier 4: specific brand name alone
      const key = `brand:${brand}`;
      if (!seen.has(key)) { seen.add(key); tier4.push(`product_description:"${brand}"`); }
    }

    // Tier 3: k-numbers (independent, very precise)
    for (const k of id.kNumbers.slice(0, 2)) {
      const key = `k:${k}`;
      if (!seen.has(key)) { seen.add(key); tier3.push(`openfda.k_number:"${k}"`); }
    }
  }

  // Return the tightest tier that has results; mix tier3 (k-numbers) into whichever tier wins
  const primary = tier1.length > 0 ? tier1
    : tier2.length > 0 ? tier2
    : tier4;

  const allTerms = [...primary, ...tier3];

  return allTerms.length > 0
    ? allTerms.join('+OR+')
    : `product_description:"${fallbackQuery}"`;
}

export async function fetchDeviceRecalls(
  identifiers: DeviceIdentifier[],
  fallbackQuery: string,
  skip = 0,
  limit = 100,
  mfrGroups: { name: string; aliases: string[] }[] = []
) {
  const searchTerms = buildRecallSearchTerms(identifiers, fallbackQuery, mfrGroups);
  const url = `${BASE_URL}/device/recall.json?search=${searchTerms}&skip=${skip}&limit=${limit}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching FDA device recalls:', error);
    return null;
  }
}

export async function fetchDeviceRecallCounts(
  identifiers: DeviceIdentifier[],
  fallbackQuery: string,
  countMode: 'time' | 'status',
  mfrGroups: { name: string; aliases: string[] }[] = []
) {
  const searchTerms = buildRecallSearchTerms(identifiers, fallbackQuery, mfrGroups);
  const countField = countMode === 'time' ? 'event_date_initiated' : 'recall_status';
  const url = `${BASE_URL}/device/recall.json?search=${searchTerms}&count=${countField}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching FDA device recall counts:', error);
    return null;
  }
}

export async function fetchFDACounts(category: Category, query: string, countMode: 'types' | 'time' = 'types', searchFieldsOverride?: string[]) {
  if (!query) return null;
  const config = CATEGORY_CONFIGS[category];
  const fields = searchFieldsOverride ?? config.searchFields;
  
  const searchTerms = fields.map(field => `${field}:"${query}"`).join('+OR+');
  const countField = countMode === 'types' ? config.countQuery : config.timeQuery;
  
  const url = `${BASE_URL}${config.endpoint}?search=${searchTerms}&count=${countField}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) return { results: [] };
        throw new Error('API Request Failed');
    }
    return await response.json();
  } catch (err) {
    console.error('FDA Fetch Error:', err);
    return null;
  }
}
