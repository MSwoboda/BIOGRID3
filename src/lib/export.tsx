import * as xlsx from 'xlsx';
import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, TableLayoutType } from 'docx';
import { saveAs } from 'file-saver';
import { parseReport } from './api';
import type { Category, SavedReport } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
};

const hasVal = (v: any) => v && String(v).trim() && String(v) !== 'NA' && String(v) !== 'Unknown' && String(v) !== 'Not reported';
const valStr = (v: any) => hasVal(v) ? String(v) : 'Not reported';

const normalizeParagraphs = (text: string): string[] => {
  if (!text) return [];
  const paras = text.split(/\r?\n\s*\r?\n/);
  return paras
    .map(p => p.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const getPills = (cat: Category, raw: any) => {
  if (cat === 'device') {
    return [
      raw.event_type && { label: `Event Type: ${raw.event_type}` },
      raw.report_source_code && { label: `Source: ${raw.report_source_code}` },
      raw.product_problem_flag === 'Y' && { label: 'Flag: Product Problem' },
      raw.adverse_event_flag === 'Y' && { label: 'Flag: Adverse Event' },
    ].filter(Boolean) as {label: string}[];
  }
  if (cat === 'drug') {
    return [
      raw.seriousnessdeath === '1' && { label: 'Fatal' },
      raw.seriousnesslifethreatening === '1' && { label: 'Life-threatening' },
      raw.seriousnesshospitalization === '1' && { label: 'Hospitalized' },
      raw.serious === '1' && raw.seriousnessdeath !== '1' && raw.seriousnesslifethreatening !== '1' && raw.seriousnesshospitalization !== '1' && { label: 'Serious' },
      raw.serious !== '1' && { label: 'Non-serious' },
    ].filter(Boolean) as {label: string}[];
  }
  if (cat === 'food') {
    const outs: string[] = raw.outcomes || [];
    return outs.slice(0, 3).map(o => ({ label: o }));
  }
  if (cat === 'tobacco') {
    return [
      raw.nonuser_affected === 'Yes' && { label: '⚠ Non-user Affected' },
      { label: `${raw.number_health_problems ?? 0} health problems` },
    ].filter(Boolean) as {label: string}[];
  }
  return [];
};

// ── PDF Single Report ────────────────────────────────────────────────────────

export async function exportSingleReportToPDF(report: SavedReport): Promise<void> {
  const parsed = parseReport(report.category, report.rawData);
  const raw = report.rawData;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setLineHeightFactor(1.4);
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 50;
  let y = M;

  const C = {
    accent: [15, 23, 42] as const, // slate-900
    heading: [30, 41, 59] as const, // slate-800
    text: [51, 65, 85] as const, // slate-600
    empty: [148, 163, 184] as const, // slate-400
    rule: [226, 232, 240] as const, // slate-200
  };

  const drawPills = (pills: {label: string}[]) => {
    if (!pills.length) return;
    check(20);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.text);
    const text = pills.map(p => `[ ${p.label} ]`).join('   ');
    const lines = doc.splitTextToSize(text, PW - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 14 + 20;
  };

  const check = (need: number) => {
    if (y + need > PH - M) { doc.addPage(); y = M; }
  };

  const drawTitle = (title: string) => {
    check(40);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...C.accent);
    const lines = doc.splitTextToSize(title.toUpperCase(), PW - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 22 + 15;
  };

  const drawSection = (title: string) => {
    check(40);
    y += 15;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...C.heading);
    doc.text(title.toUpperCase(), M, y);
    y += 12;
  };

  const drawMultiPageText = (text: string, justify: boolean = false, textColor: readonly [number, number, number], fontStyle: 'normal' | 'italic' | 'bold' = 'normal') => {
    doc.setFont('Helvetica', fontStyle);
    doc.setTextColor(...textColor);
    const paragraphs = normalizeParagraphs(text);
    for (const p of paragraphs) {
      const lines = doc.splitTextToSize(p, PW - M * 2);
      for (let i = 0; i < lines.length; i++) {
        check(16);
        const line = lines[i];
        const isLast = (i === lines.length - 1);
        
        if (justify && !isLast) {
          const words = line.trim().split(/\s+/);
          if (words.length > 1) {
            const totalW = doc.getTextWidth(words.join(''));
            const spaceW = (PW - M * 2 - totalW) / (words.length - 1);
            let currX = M;
            for (const w of words) {
              doc.text(w, currX, y);
              currX += doc.getTextWidth(w) + spaceW;
            }
          } else {
            doc.text(line, M, y);
          }
        } else {
          doc.text(line, M, y);
        }
        y += 14;
      }
      y += 6;
    }
  };

  const drawField = (label: string, value: any, isBlock = false) => {
    check(20);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.heading);
    const isEmp = !hasVal(value);
    const valText = valStr(value);
    
    if (isBlock || doc.getTextWidth(`${label}:`) > 115) {
      doc.text(`${label}:`, M, y);
      y += 14;
      drawMultiPageText(valText, true, isEmp ? C.empty : C.text, isEmp ? 'italic' : 'normal');
      y += 6;
      return;
    }
    
    doc.text(`${label}:`, M, y);
    const labelW = doc.getTextWidth(`${label}: `) + 4;
    doc.setFont('Helvetica', isEmp ? 'italic' : 'normal');
    if (isEmp) doc.setTextColor(...C.empty); else doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(valText, PW - M - 140);
    doc.text(lines, M + labelW, y);
    y += lines.length * 14 + 6;
  };

  const drawText = (text: string) => {
    if (!hasVal(text)) {
      doc.setFont('Helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...C.empty);
      doc.text('Not reported', M, y);
      y += 20;
      return;
    }
    drawMultiPageText(text, true, C.text, 'normal');
    y += 10;
  };

  const drawTwoColumnSection = (title: string, leftFields: { label: string, value: any }[], rightFields: { label: string, value: any }[]) => {
    drawSection(title);
    
    const startY = y;
    let leftY = startY;
    let rightY = startY;
    
    leftFields.forEach(f => {
      const isEmp = !hasVal(f.value);
      const valText = valStr(f.value);
      check(16);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.heading);
      doc.text(`${f.label}:`, M, leftY);
      const labelW = doc.getTextWidth(`${f.label}: `) + 4;
      doc.setFont('Helvetica', isEmp ? 'italic' : 'normal');
      if (isEmp) doc.setTextColor(...C.empty); else doc.setTextColor(...C.text);
      
      const lines = doc.splitTextToSize(valText, PW / 2 - M - labelW - 10);
      doc.text(lines, M + labelW, leftY);
      leftY += lines.length * 14 + 6;
    });
    
    rightFields.forEach(f => {
      const isEmp = !hasVal(f.value);
      const valText = valStr(f.value);
      check(16);
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.heading);
      doc.text(`${f.label}:`, PW / 2 + 10, rightY);
      const labelW = doc.getTextWidth(`${f.label}: `) + 4;
      doc.setFont('Helvetica', isEmp ? 'italic' : 'normal');
      if (isEmp) doc.setTextColor(...C.empty); else doc.setTextColor(...C.text);
      
      const lines = doc.splitTextToSize(valText, PW / 2 - M - labelW - 10);
      doc.text(lines, PW / 2 + 10 + labelW, rightY);
      rightY += lines.length * 14 + 6;
    });
    
    y = Math.max(leftY, rightY) + 10;
  };

  // Header
  drawTitle(parsed.title);
  
  const drawMetaField = (label: string, value: any) => {
    const valText = valStr(value);
    const isEmp = !hasVal(value);
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.heading);
    doc.text(`${label}:`, M, y);
    const labelW = doc.getTextWidth(`${label}: `) + 4;
    doc.setFont('Helvetica', isEmp ? 'italic' : 'normal');
    if (isEmp) doc.setTextColor(...C.empty); else doc.setTextColor(...C.text);
    doc.text(valText, M + labelW, y);
    y += 16;
  };

  drawMetaField('Category', report.category.toUpperCase());
  drawMetaField('Report ID', parsed.id);
  drawMetaField('Date', fmtDate(parsed.date));
  drawPills(getPills(report.category, raw));
  y += 10;

  drawSection('Description');
  drawText(parsed.description);

  if (report.category === 'device') {
    const dev = raw.device?.[0] || raw.device || {};
    const udi = dev.udi_di || dev.udi_public;
    
    // 1. Device Description
    const deviceLeft = [
      { label: 'Brand Name', value: dev.brand_name },
      { label: 'Generic Name', value: dev.generic_name },
      { label: 'Model Number', value: dev.model_number },
      { label: 'Catalog Number', value: dev.catalog_number },
      { label: 'Product Code', value: dev.device_report_product_code }
    ];
    const deviceRight = [
      { label: 'Lot Number', value: dev.lot_number },
      { label: 'Expiration Date', value: fmtDate(dev.expiration_date_of_device) },
      { label: 'Operator', value: dev.device_operator },
      { label: 'Manufacturer', value: dev.manufacturer_d_name },
      { label: 'UDI', value: udi }
    ];
    drawTwoColumnSection('Device Description', deviceLeft, deviceRight);

    // 2. Dates
    const datesLeft = [
      { label: 'Event Date', value: fmtDate(raw.date_of_event) },
      { label: 'Received by FDA', value: fmtDate(raw.date_received) }
    ];
    const datesRight = [
      { label: 'Received by Mfr', value: fmtDate(raw.date_manufacturer_received) }
    ];
    drawTwoColumnSection('Dates', datesLeft, datesRight);

    // 3. Report
    const reportLeft = [
      { label: 'Report ID', value: parsed.id },
      { label: 'Event Type', value: raw.event_type },
      { label: 'Source', value: raw.report_source_code }
    ];
    const reportRight = [
      { label: 'Product Problems', value: (parsed.deviceProblems || []).join(', ') },
      { label: 'Patient Problems', value: (parsed.patientProblems || []).join(', ') }
    ];
    drawTwoColumnSection('Report', reportLeft, reportRight);

    // 4. Narratives
    const mdrTexts: any[] = Array.isArray(raw.mdr_text) ? raw.mdr_text : [];
    if (mdrTexts.length > 0) {
      drawSection('Narratives');
      
      const sortedMdr = [...mdrTexts].sort((a, b) => {
        const aType = a.text_type_code || '';
        const bType = b.text_type_code || '';
        if (aType.includes('Event') || aType.includes('Problem')) return -1;
        if (bType.includes('Event') || bType.includes('Problem')) return 1;
        if (aType.includes('Manufacturer')) return -1;
        if (bType.includes('Manufacturer')) return 1;
        return 0;
      });
      
      sortedMdr.forEach(t => {
        if (t.text) {
          drawField(t.text_type_code || 'Text', t.text, true);
        }
      });
    }

    // 5. Patient
    const pat = raw.patient?.[0] || raw.patient || {};
    const patLeft = [
      { label: 'Patient seq', value: pat.patient_sequence_number || '1' },
      { label: 'Sex', value: pat.patient_sex },
      { label: 'Age', value: pat.patient_age },
      { label: 'Weight', value: pat.patient_weight }
    ];
    const patRight = [
      { label: 'Ethnicity', value: pat.patient_ethnicity },
      { label: 'Race', value: pat.patient_race },
      { label: 'Outcomes', value: Array.isArray(pat.sequence_number_outcome) ? pat.sequence_number_outcome.filter(Boolean).join(', ') : null }
    ];
    drawTwoColumnSection('Patient', patLeft, patRight);

    // 6. Manufacturer
    const mfrName = raw.manufacturer_contact_t_name || raw.manufacturer_g_name;
    const mfrAddr = [raw.manufacturer_g_address_1, raw.manufacturer_g_address_2, raw.manufacturer_g_city, raw.manufacturer_g_state_city, raw.manufacturer_g_zip_code, raw.manufacturer_g_country].filter(Boolean).join(', ');
    const mfrLeft = [
      { label: 'Name', value: mfrName },
      { label: 'Address', value: mfrAddr }
    ];
    const mfrRight = [
      { label: 'Contact', value: raw.manufacturer_contact_t_name }
    ];
    drawTwoColumnSection('Manufacturer', mfrLeft, mfrRight);

    // 7. Reporter
    const reporterLeft = [
      { label: 'Event Location', value: raw.event_location },
      { label: 'State', value: raw.reporter_state_code },
      { label: 'Occupation', value: raw.reporter_occupation_code }
    ];
    const reporterRight = [
      { label: 'Report to FDA', value: raw.report_to_fda },
      { label: 'Report to Mfr', value: raw.report_to_manufacturer },
      { label: 'Geo-Coordinates', value: raw.reporter_state_code ? 'SYSTEM RESOLVED' : null }
    ];
    drawTwoColumnSection('Reporter', reporterLeft, reporterRight);

    // 8. Report Classification
    drawSection('Report Classification');
    const reportTypes = Array.isArray(raw.type_of_report) ? raw.type_of_report.filter(Boolean) : [];
    drawField('Type', reportTypes.join(', '));
    drawField('Source', raw.report_source_code);
    drawField('Reprocessed & Reused', raw.reprocessed_and_reused_flag === 'Y' ? 'Yes' : null);
    drawField('Exemption', raw.exemption_number);
    drawField('PMA/PMN', raw.pma_pmn_number);
    drawField('Manufacturer Linked', raw.manufacturer_link_flag === 'Y' ? 'Yes' : null);
  } else if (report.category === 'drug') {
    const pat = raw.patient;
    if (pat) {
      const patLeft = [
        { label: 'Age', value: pat.patientonsetage ? `${pat.patientonsetage} ${pat.patientonsetageunit || 'yrs'}` : null },
        { label: 'Sex', value: pat.patientsex === '1' ? 'Male' : pat.patientsex === '2' ? 'Female' : null }
      ];
      const patRight = [
        { label: 'Weight', value: pat.patientweight ? `${pat.patientweight} kg` : null }
      ];
      drawTwoColumnSection('Patient', patLeft, patRight);

      const drugs: any[] = Array.isArray(pat.drug) ? pat.drug : pat.drug ? [pat.drug] : [];
      drugs.forEach((d, i) => {
        const brand = Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : null;
        const drugLeft = [
          { label: 'Product', value: brand || d.medicinalproduct },
          { label: 'Indication', value: d.drugindication },
          { label: 'Route', value: Array.isArray(d.openfda?.route) ? d.openfda.route[0] : d.drugadministrationroute },
          { label: 'Dosage Form', value: d.drugdosageform }
        ];
        const drugRight = [
          { label: 'Dosage', value: d.drugdosagetext },
          { label: 'Start Date', value: fmtDate(d.drugstartdate) },
          { label: 'End Date', value: fmtDate(d.drugenddate) }
        ];
        drawTwoColumnSection(`Drug ${i + 1}`, drugLeft, drugRight);
      });

      const rxns: any[] = Array.isArray(pat.reaction) ? pat.reaction : pat.reaction ? [pat.reaction] : [];
      drawSection('Reactions');
      drawText(rxns.map(r => r.reactionmeddrapt).filter(Boolean).join(', '));
    }
  } else if (report.category === 'food') {
    const products = raw.products || [];
    products.forEach((p: any, i: number) => {
      const prodLeft = [
        { label: 'Brand', value: p.name_brand },
        { label: 'Industry', value: p.industry_name }
      ];
      const prodRight = [
        { label: 'Role', value: p.role }
      ];
      drawTwoColumnSection(`Product ${i + 1}`, prodLeft, prodRight);
    });
    drawSection('Reactions');
    drawText((raw.reactions || []).join(', '));
    drawSection('Outcomes');
    drawText((raw.outcomes || []).join(', '));
  } else if (report.category === 'tobacco') {
    const detailsLeft = [
      { label: 'Non-user Affected', value: raw.nonuser_affected }
    ];
    const detailsRight = [
      { label: 'Date Submitted', value: fmtDate(raw.date_submitted) }
    ];
    drawTwoColumnSection('Details', detailsLeft, detailsRight);
    
    drawSection('Tobacco Products');
    drawText((raw.tobacco_products || []).join(', '));
    
    drawSection('Reported Health Problems');
    drawText((raw.reported_health_problems || []).join(', '));
  }

  doc.save(`biogrid_${report.category}_${parsed.id}.pdf`);
}

// ── DOCX Single Report ───────────────────────────────────────────────────────

export async function exportSingleReportToDOCX(report: SavedReport): Promise<void> {
  const parsed = parseReport(report.category, report.rawData);
  const raw = report.rawData;
  const children: any[] = [];

  const addPills = (pills: {label: string}[]) => {
    if (!pills.length) return;
    const text = pills.map(p => `[ ${p.label} ]`).join('   ');
    children.push(new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18, color: '475569', font: 'Calibri' })],
      spacing: { after: 200 }
    }));
  };

  const addTitle = (t: string) => {
    children.push(new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 36, color: '0f172a', font: 'Calibri' })], spacing: { after: 200 } }));
  };

  const addSection = (t: string) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: '', size: 2, font: 'Calibri' })],
      thematicBreak: true,
      spacing: { before: 200, after: 0 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 24, color: '1e293b', font: 'Calibri' })],
      spacing: { before: 60, after: 120 }
    }));
  };

  const justifiedParagraph = (textContent: string, color: string, isItalic: boolean, afterSpacing: number) => {
    return new Paragraph({
      children: [new TextRun({ text: textContent, size: 20, color, italics: isItalic, font: 'Calibri' })],
      style: 'JustifiedText',
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: afterSpacing }
    });
  };

  const normalParagraph = (textContent: string, color: string, isItalic: boolean, afterSpacing: number) => {
    return new Paragraph({
      children: [new TextRun({ text: textContent, size: 20, color, italics: isItalic, font: 'Calibri' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: afterSpacing }
    });
  };

  const addField = (label: string, value: any, isBlock = false) => {
    const isEmp = !hasVal(value);
    if (isBlock || label.length > 25) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${label}:`, bold: true, size: 20, color: '1e293b', font: 'Calibri' })],
        spacing: { after: 100 }
      }));
      const paragraphs = normalizeParagraphs(valStr(value));
      paragraphs.forEach((p, i) => {
        children.push(justifiedParagraph(
          p,
          isEmp ? '94a3b8' : '475569',
          isEmp,
          (i === paragraphs.length - 1) ? 150 : 100
        ));
      });
      return;
    }
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: '1e293b', font: 'Calibri' }),
        new TextRun({ 
          text: valStr(value), 
          size: 20, 
          color: isEmp ? '94a3b8' : '475569', 
          italics: isEmp,
          font: 'Calibri' 
        }),
      ],
      spacing: { after: 80 }
    }));
  };

  const addNormalText = (text: string) => {
    const isEmp = !hasVal(text);
    const paragraphs = normalizeParagraphs(valStr(text));
    paragraphs.forEach((p, i) => {
      children.push(normalParagraph(
        p,
        isEmp ? '94a3b8' : '475569',
        isEmp,
        (i === paragraphs.length - 1) ? 150 : 100
      ));
    });
  };

  const addJustifiedText = (text: string) => {
    const isEmp = !hasVal(text);
    const paragraphs = normalizeParagraphs(valStr(text));
    paragraphs.forEach((p, i) => {
      children.push(justifiedParagraph(
        p,
        isEmp ? '94a3b8' : '475569',
        isEmp,
        (i === paragraphs.length - 1) ? 150 : 100
      ));
    });
  };

  const addTwoColumnSection = (sectionTitle: string, leftFields: { label: string, value: any }[], rightFields: { label: string, value: any }[]) => {
    addSection(sectionTitle);
    
    const rows: TableRow[] = [];
    const maxRows = Math.max(leftFields.length, rightFields.length);
    
    for (let i = 0; i < maxRows; i++) {
      const leftF = leftFields[i];
      const rightF = rightFields[i];
      
      const leftCellChildren: Paragraph[] = [];
      if (leftF) {
        const isEmp = !hasVal(leftF.value);
        leftCellChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `${leftF.label}: `, bold: true, size: 20, color: '1e293b', font: 'Calibri' }),
            new TextRun({ text: valStr(leftF.value), size: 20, color: isEmp ? '94a3b8' : '475569', italics: isEmp, font: 'Calibri' })
          ],
          spacing: { after: 60 }
        }));
      } else {
        leftCellChildren.push(new Paragraph({ children: [] }));
      }
      
      const rightCellChildren: Paragraph[] = [];
      if (rightF) {
        const isEmp = !hasVal(rightF.value);
        rightCellChildren.push(new Paragraph({
          children: [
            new TextRun({ text: `${rightF.label}: `, bold: true, size: 20, color: '1e293b', font: 'Calibri' }),
            new TextRun({ text: valStr(rightF.value), size: 20, color: isEmp ? '94a3b8' : '475569', italics: isEmp, font: 'Calibri' })
          ],
          spacing: { after: 60 }
        }));
      } else {
        rightCellChildren.push(new Paragraph({ children: [] }));
      }
      
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: leftCellChildren,
            width: { size: 4680, type: WidthType.DXA },
          }),
          new TableCell({
            children: rightCellChildren,
            width: { size: 4680, type: WidthType.DXA },
          })
        ]
      }));
    }
    
    const table = new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      layout: TableLayoutType.FIXED,
      rows,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      margins: {
        top: 80,
        bottom: 80,
        left: 100,
        right: 100,
      }
    });
    
    children.push(table);
  };

  // Top Title
  addTitle(parsed.title);
  
  const addMetaField = (label: string, value: any) => {
    const isEmp = !hasVal(value);
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20, color: '1e293b', font: 'Calibri' }),
        new TextRun({ text: valStr(value), size: 20, color: isEmp ? '94a3b8' : '334155', italics: isEmp, font: 'Calibri' })
      ],
      spacing: { after: 80 }
    }));
  };

  addMetaField('Category', report.category.toUpperCase());
  addMetaField('Report ID', parsed.id);
  addMetaField('Date', fmtDate(parsed.date));
  addPills(getPills(report.category, raw));

  addSection('Description');
  addJustifiedText(parsed.description);

  if (report.category === 'device') {
    const dev = raw.device?.[0] || raw.device || {};
    const udi = dev.udi_di || dev.udi_public;
    
    // 1. Device Description
    const deviceLeft = [
      { label: 'Brand Name', value: dev.brand_name },
      { label: 'Generic Name', value: dev.generic_name },
      { label: 'Model Number', value: dev.model_number },
      { label: 'Catalog Number', value: dev.catalog_number },
      { label: 'Product Code', value: dev.device_report_product_code }
    ];
    const deviceRight = [
      { label: 'Lot Number', value: dev.lot_number },
      { label: 'Expiration Date', value: fmtDate(dev.expiration_date_of_device) },
      { label: 'Operator', value: dev.device_operator },
      { label: 'Manufacturer', value: dev.manufacturer_d_name },
      { label: 'UDI', value: udi }
    ];
    addTwoColumnSection('Device Description', deviceLeft, deviceRight);

    // 2. Dates
    const datesLeft = [
      { label: 'Event Date', value: fmtDate(raw.date_of_event) },
      { label: 'Received by FDA', value: fmtDate(raw.date_received) }
    ];
    const datesRight = [
      { label: 'Received by Mfr', value: fmtDate(raw.date_manufacturer_received) }
    ];
    addTwoColumnSection('Dates', datesLeft, datesRight);

    // 3. Report
    const reportLeft = [
      { label: 'Report ID', value: parsed.id },
      { label: 'Event Type', value: raw.event_type },
      { label: 'Source', value: raw.report_source_code }
    ];
    const reportRight = [
      { label: 'Product Problems', value: (parsed.deviceProblems || []).join(', ') },
      { label: 'Patient Problems', value: (parsed.patientProblems || []).join(', ') }
    ];
    addTwoColumnSection('Report', reportLeft, reportRight);

    // 4. Narratives
    const mdrTexts: any[] = Array.isArray(raw.mdr_text) ? raw.mdr_text : [];
    if (mdrTexts.length > 0) {
      addSection('Narratives');
      const sortedMdr = [...mdrTexts].sort((a, b) => {
        const aType = a.text_type_code || '';
        const bType = b.text_type_code || '';
        if (aType.includes('Event') || aType.includes('Problem')) return -1;
        if (bType.includes('Event') || bType.includes('Problem')) return 1;
        if (aType.includes('Manufacturer')) return -1;
        if (bType.includes('Manufacturer')) return 1;
        return 0;
      });
      sortedMdr.forEach(t => {
        if (t.text) {
          addField(t.text_type_code || 'Text', t.text, true);
        }
      });
    }

    // 5. Patient
    const pat = raw.patient?.[0] || raw.patient || {};
    const patLeft = [
      { label: 'Patient seq', value: pat.patient_sequence_number || '1' },
      { label: 'Sex', value: pat.patient_sex },
      { label: 'Age', value: pat.patient_age },
      { label: 'Weight', value: pat.patient_weight }
    ];
    const patRight = [
      { label: 'Ethnicity', value: pat.patient_ethnicity },
      { label: 'Race', value: pat.patient_race },
      { label: 'Outcomes', value: Array.isArray(pat.sequence_number_outcome) ? pat.sequence_number_outcome.filter(Boolean).join(', ') : null }
    ];
    addTwoColumnSection('Patient', patLeft, patRight);

    // 6. Manufacturer
    const mfrName = raw.manufacturer_contact_t_name || raw.manufacturer_g_name;
    const mfrAddr = [raw.manufacturer_g_address_1, raw.manufacturer_g_address_2, raw.manufacturer_g_city, raw.manufacturer_g_state_city, raw.manufacturer_g_zip_code, raw.manufacturer_g_country].filter(Boolean).join(', ');
    const mfrLeft = [
      { label: 'Name', value: mfrName },
      { label: 'Address', value: mfrAddr }
    ];
    const mfrRight = [
      { label: 'Contact', value: raw.manufacturer_contact_t_name }
    ];
    addTwoColumnSection('Manufacturer', mfrLeft, mfrRight);

    // 7. Reporter
    const reporterLeft = [
      { label: 'Event Location', value: raw.event_location },
      { label: 'State', value: raw.reporter_state_code },
      { label: 'Occupation', value: raw.reporter_occupation_code }
    ];
    const reporterRight = [
      { label: 'Report to FDA', value: raw.report_to_fda },
      { label: 'Report to manufacturer', value: raw.report_to_manufacturer },
      { label: 'Geo-Coordinates', value: raw.reporter_state_code ? 'SYSTEM RESOLVED' : null }
    ];
    addTwoColumnSection('Reporter', reporterLeft, reporterRight);

    // 8. Report Classification
    addSection('Report Classification');
    const reportTypes = Array.isArray(raw.type_of_report) ? raw.type_of_report.filter(Boolean) : [];
    addField('Type', reportTypes.join(', '));
    addField('Source', raw.report_source_code);
    addField('Reprocessed & Reused', raw.reprocessed_and_reused_flag === 'Y' ? 'Yes' : null);
    addField('Exemption', raw.exemption_number);
    addField('PMA/PMN', raw.pma_pmn_number);
    addField('Manufacturer Linked', raw.manufacturer_link_flag === 'Y' ? 'Yes' : null);
  } else if (report.category === 'drug') {
    const pat = raw.patient;
    if (pat) {
      const patLeft = [
        { label: 'Age', value: pat.patientonsetage ? `${pat.patientonsetage} ${pat.patientonsetageunit || 'yrs'}` : null },
        { label: 'Sex', value: pat.patientsex === '1' ? 'Male' : pat.patientsex === '2' ? 'Female' : null }
      ];
      const patRight = [
        { label: 'Weight', value: pat.patientweight ? `${pat.patientweight} kg` : null }
      ];
      addTwoColumnSection('Patient', patLeft, patRight);

      const drugs: any[] = Array.isArray(pat.drug) ? pat.drug : pat.drug ? [pat.drug] : [];
      drugs.forEach((d, i) => {
        const brand = Array.isArray(d.openfda?.brand_name) ? d.openfda.brand_name[0] : null;
        const drugLeft = [
          { label: 'Product', value: brand || d.medicinalproduct },
          { label: 'Indication', value: d.drugindication },
          { label: 'Route', value: Array.isArray(d.openfda?.route) ? d.openfda.route[0] : d.drugadministrationroute },
          { label: 'Dosage Form', value: d.drugdosageform }
        ];
        const drugRight = [
          { label: 'Dosage', value: d.drugdosagetext },
          { label: 'Start Date', value: fmtDate(d.drugstartdate) },
          { label: 'End Date', value: fmtDate(d.drugenddate) }
        ];
        addTwoColumnSection(`Drug ${i + 1}`, drugLeft, drugRight);
      });

      const rxns: any[] = Array.isArray(pat.reaction) ? pat.reaction : pat.reaction ? [pat.reaction] : [];
      addSection('Reactions');
      addNormalText(rxns.map(r => r.reactionmeddrapt).filter(Boolean).join(', '));
    }
  } else if (report.category === 'food') {
    const products = raw.products || [];
    products.forEach((p: any, i: number) => {
      const prodLeft = [
        { label: 'Brand', value: p.name_brand },
        { label: 'Industry', value: p.industry_name }
      ];
      const prodRight = [
        { label: 'Role', value: p.role }
      ];
      addTwoColumnSection(`Product ${i + 1}`, prodLeft, prodRight);
    });
    addSection('Reactions');
    addNormalText((raw.reactions || []).join(', '));
    addSection('Outcomes');
    addNormalText((raw.outcomes || []).join(', '));
  } else if (report.category === 'tobacco') {
    const detailsLeft = [
      { label: 'Non-user Affected', value: raw.nonuser_affected }
    ];
    const detailsRight = [
      { label: 'Date Submitted', value: fmtDate(raw.date_submitted) }
    ];
    addTwoColumnSection('Details', detailsLeft, detailsRight);
    
    addSection('Tobacco Products');
    addNormalText((raw.tobacco_products || []).join(', '));
    
    addSection('Reported Health Problems');
    addNormalText((raw.reported_health_problems || []).join(', '));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 }
        },
      },
      paragraphStyles: [
        {
          id: 'JustifiedText',
          name: 'Justified Text',
          basedOn: 'Normal',
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
          },
          run: {
            font: 'Calibri',
            size: 20,
          },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children
    }],
  });

  saveAs(await Packer.toBlob(doc), `biogrid_${report.category}_${parsed.id}.docx`);
}

// ── Batch Folder Exports ─────────────────────────────────────────────────────

export async function exportFolderToXLSX(reports: SavedReport[], folderName: string) {
  const parsed = reports.map(r => parseReport(r.category, r.rawData));
  const ws = xlsx.utils.json_to_sheet(parsed.map((r, i) => ({
    ID: r.id, Category: reports[i].category, Title: r.title, Date: r.date, Events: r.events.join('; '), Description: r.description
  })));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, folderName.substring(0, 31));
  xlsx.writeFile(wb, `biogrid_folder_${folderName}.xlsx`);
}

export async function exportFolderToPDF(reports: SavedReport[], folderName: string) {
  const parsed = reports.map(r => parseReport(r.category, r.rawData));
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.text(`BioGrid Folder: ${folderName}`, 14, 15);
  autoTable(doc, {
    head: [['ID', 'Category', 'Date', 'Title', 'Events', 'Description']],
    body: parsed.map((r, i) => [r.id, reports[i].category, r.date, r.title, r.events.join('; '), r.description]),
    startY: 20
  });
  doc.save(`biogrid_folder_${folderName}.pdf`);
}

export async function exportFolderToDOCX(reports: SavedReport[], folderName: string) {
  const parsed = reports.map(r => parseReport(r.category, r.rawData));
  const table = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1872, 1872, 1872, 1872, 1872],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ children: ['ID', 'Category', 'Date', 'Title', 'Events'].map(t => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })], width: { size: 1872, type: WidthType.DXA } })) }),
      ...parsed.map((r, i) => new TableRow({ children: [r.id, reports[i].category, r.date, r.title, r.events.join('; ')].map(t => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t })] })], width: { size: 1872, type: WidthType.DXA } })) }))
    ]
  });
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children: [table]
    }]
  });
  saveAs(await Packer.toBlob(doc), `biogrid_folder_${folderName}.docx`);
}

// ── Search Results Exports ───────────────────────────────────────────────────

export async function exportSearchResultsToXLSX(results: any[], category: Category, queries: string[]) {
  const parsed = results.map(r => parseReport(category, r));
  const ws = xlsx.utils.json_to_sheet(parsed.map(r => ({
    ID: r.id, Title: r.title, Date: r.date, Events: r.events.join('; '), Description: r.description
  })));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Results');
  xlsx.writeFile(wb, `biogrid_${category}_search.xlsx`);
}

export async function exportSearchResultsToPDF(results: any[], category: Category, queries: string[]) {
  const parsed = results.map(r => parseReport(category, r));
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.text(`BioGrid Search: ${category.toUpperCase()}`, 14, 15);
  autoTable(doc, {
    head: [['ID', 'Date', 'Title', 'Events', 'Description']],
    body: parsed.map(r => [r.id, r.date, r.title, r.events.join('; '), r.description]),
    startY: 20
  });
  doc.save(`biogrid_${category}_search.pdf`);
}

export async function exportSearchResultsToDOCX(results: any[], category: Category, queries: string[]) {
  const parsed = results.map(r => parseReport(category, r));
  const table = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 2340, 2340, 2340],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ children: ['ID', 'Date', 'Title', 'Events'].map(t => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })], width: { size: 2340, type: WidthType.DXA } })) }),
      ...parsed.map(r => new TableRow({ children: [r.id, r.date, r.title, r.events.join('; ')].map(t => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t })] })], width: { size: 2340, type: WidthType.DXA } })) }))
    ]
  });
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children: [table]
    }]
  });
  saveAs(await Packer.toBlob(doc), `biogrid_${category}_search.docx`);
}
