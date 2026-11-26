/**
 * Crée le fichier de départ (JSON) d'un plan à partir du classeur OKR, pour un HTML pré-rempli.
 *   npx tsx scripts/build-seed.ts classeur.xlsx 2027 plan.json
 * Le JSON contient vos données : le garder hors du dépôt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { importOkr, readOkrWorkbook } from '../src/lib/importer';
import { createPlan, updatePlan } from '../src/lib/ops';
import { emptyWorkspace } from '../src/types';

const [file, yearArg, out] = process.argv.slice(2);
if (!file || !out) throw new Error('Usage : build-seed.ts classeur.xlsx 2027 plan.json');
const year = Number(yearArg) || new Date().getFullYear();
const { ws: w0, planId } = createPlan(emptyWorkspace(), { year, name: `Plan de travail ${year}` });
const { ws, report } = importOkr(w0, planId, readOkrWorkbook(XLSX.read(readFileSync(file))), { replace: true });
const plan = ws.plans.find((p) => p.id === planId)!;
writeFileSync(out, JSON.stringify(updatePlan(ws, { ...plan, status: 'active', notes: `Importé de ${file.split('/').pop()}` })));
console.log(`${report.globalActivities} KR équipes globales, ${report.countryActivities} KR pays, ${report.orphans} orphelin(s), ${report.unmatched.length} ligne(s) non rapprochée(s)`);
