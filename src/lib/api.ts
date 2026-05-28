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
    searchFields: ['tobacco_product.product_brand_name'],
    countQuery: 'adverse_experience.exact',
    timeQuery: 'date_submitted'
  }
};

export async function fetchFDAData(category: Category, query: string, skip = 0, limit = 20) {
  if (!query) return null;
  const config = CATEGORY_CONFIGS[category];
  
  // Construct search string: field1:"query" OR field2:"query"
  const searchTerms = config.searchFields.map(field => `${field}:"${query}"`).join('+OR+');
  
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
  let patient: { sex?: string, age?: string, weight?: string } = {};

  switch (category) {
    case 'drug':
      id = item.safetyreportid || generateId();
      title = item.patient?.drug?.[0]?.medicinalproduct || 'Unknown Drug';
      date = item.receiptdate || item.transmissiondate || '';
      events = item.patient?.reaction?.map((r: any) => r.reactionmeddrapt) || [];
      patient.sex = item.patient?.patientsex == '1' ? 'Male' : item.patient?.patientsex == '2' ? 'Female' : 'Unknown';
      patient.weight = item.patient?.patientweight ? `${item.patient.patientweight} kg` : '';
      description = `Patient sex: ${patient.sex}. ${patient.weight ? `Weight: ${patient.weight}.` : ''}`;
      narrative = item.patient?.summary?.narrativeincludeclinical || '';
      break;
    case 'device':
      id = item.mdr_report_key || generateId();
      title = item.device?.[0]?.generic_name || item.device?.[0]?.brand_name || 'Unknown Device';
      date = item.date_received || item.date_of_event || '';
      events = [item.event_type].filter(Boolean);
      narrative = item.mdr_text?.find((t: any) => t.text_type_code === 'Description of Event or Problem')?.text || item.mdr_text?.[0]?.text || '';
      description = narrative || 'No description provided';
      deviceProblems = item.device?.[0]?.device_problem_code ? [{ code: item.device[0].device_problem_code }].map((c: any) => c.code) : [];
      if (item.device?.[0]?.device_problem_code) {
          // OpenFDA has some text descriptions usually in MDR data, but we can extract what's there
          deviceProblems = item.device.flatMap((d:any) => d.device_problem_code ? [d.device_problem_code].flat() : []).filter(Boolean);
      }
      let pArray = Array.isArray(item.patient) ? item.patient : (item.patient ? [item.patient] : []);
      patientProblems = pArray.flatMap((p:any) => p.patient_problem_code ? [p.patient_problem_code].flat() : []).filter(Boolean);
      break;
    case 'food':
      id = item.report_number || generateId();
      title = item.products?.[0]?.name_brand || item.products?.[0]?.industry_name || 'Unknown Food Product';
      date = item.date_created || '';
      events = item.reactions || item.outcomes || [];
      patient.age = item.consumer?.age ? `${item.consumer.age} ${item.consumer.age_unit}` : '';
      patient.sex = item.consumer?.gender || 'Unknown';
      description = item.description || `Reported by: ${patient.age || 'Unknown age'}, ${patient.sex}`;
      narrative = item.description || '';
      break;
    case 'tobacco':
      id = item.report_id || generateId();
      title = item.tobacco_product?.[0]?.product_brand_name || 'Unknown Tobacco Product';
      date = item.date_submitted || '';
      events = item.adverse_experience || [];
      description = item.problem_description || 'No description provided';
      narrative = item.problem_description || '';
      break;
  }

  return { id, title, date, events, description, narrative, deviceProblems, patientProblems, patient };
}

export async function fetchDeviceRecalls(query: string, skip = 0, limit = 20) {
  if (!query) return null;
  const searchFields = ['product_description', 'reason_for_recall'];
  const searchTerms = searchFields.map(field => `${field}:"${query}"`).join('+OR+');
  const url = `${BASE_URL}/device/recall.json?search=(${searchTerms})&skip=${skip}&limit=${limit}`;

  try {
    const response = await fetch(url.replace(/\+/g, '%2B')); // ensure + is kept in url
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching FDA device recalls:', error);
    return null;
  }
}

export async function fetchDeviceRecallCounts(query: string, countMode: 'time' | 'status') {
  if (!query) return null;
  const searchFields = ['product_description', 'reason_for_recall'];
  const searchTerms = searchFields.map(field => `${field}:"${query}"`).join('+OR+');
  const countField = countMode === 'time' ? 'event_date_initiated' : 'recall_status';
  const url = `${BASE_URL}/device/recall.json?search=(${searchTerms})&count=${countField}`;

  try {
    const response = await fetch(url.replace(/\+/g, '%2B'));
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching FDA device recall counts:', error);
    return null;
  }
}

export async function fetchFDACounts(category: Category, query: string, countMode: 'types' | 'time' = 'types') {
  if (!query) return null;
  const config = CATEGORY_CONFIGS[category];
  
  const searchTerms = config.searchFields.map(field => `${field}:"${query}"`).join('+OR+');
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
