/**
 * Contrôle de l'import en ligne de commande (sans navigateur) : imprime le rapport.
 * Usage : npx tsx scripts/check-import.ts "2027 OKR Consolidated Plans_V2.xlsx"
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../src/lib/import/excel';

const file = process.argv[2];
if (!file) throw new Error('Chemin du fichier .xlsx attendu');
const { report: r } = parseWorkbook(XLSX.read(readFileSync(file)), file);
console.table(r.sheets.map((s) => ({ onglet: s.sheet, lignes: s.rows, sections: s.sectionHeaders, KR: s.krs, initiatives: s.initiatives, jalons: s.milestones, remarques: s.warnings.length })));
console.log('Totaux :', r.totals);
for (const c of r.checks) console.log(`${c.ok ? '✓' : '!'} ${c.label} : ${c.detail}`);
for (const s of r.sheets) for (const w of s.warnings) console.log(`  [${s.sheet}] ${w}`);
for (const w of r.warnings) console.log(`  ${w}`);
