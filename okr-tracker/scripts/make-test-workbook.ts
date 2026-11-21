/**
 * Génère un classeur FICTIF à l'échelle du fichier réel (20 KR globaux, ~100 KR d'entité),
 * avec la même structure d'onglets et de colonnes. Sert à tester l'import et l'interface
 * quand le vrai fichier n'est pas disponible. Ce ne sont PAS des données Living Goods.
 * Usage : npx tsx scripts/make-test-workbook.ts sortie.xlsx
 */
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const H = ['Ref', 'Global Key Result', 'Team/Unit', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Initiative', 'Initiative Lead',
  'Current Baseline', 'Metric', 'Evidence Source and Rule', 'Q1 Milestone', 'Q2 Milestone', 'Q3 Milestone', 'Q4 Milestone', 'Indicative Budget'];
const COUNTRIES = ['Kenya', 'Burkina Faso', 'Uganda', 'Benin', 'Zambia'];
const wb = XLSX.utils.book_new();

const ref: string[][] = [['Ref', 'Key Result']];
const gkr: string[] = [];
for (let o = 1; o <= 4; o++) {
  ref.push([`Objective ${o}: Test global objective number ${o}`]);
  for (let k = 1; k <= 5; k++) {
    ref.push([`KR${o}.${k}`, `Test global KR ${o}.${k} (fictitious)`]);
    gkr.push(`KR${o}.${k}`);
  }
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ref), 'Ref Global OKRs');

const reg: string[][] = [['Ref', 'Global Key Result', 'Country/Team', 'Role', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Scope']];
const sheets: [string, string, string[]][] = [
  ['2 Kenya', 'Kenya', ['']], ['3 Burkina Faso', 'Burkina Faso', ['']], ['4 Uganda', 'Uganda', ['']], ['4b Benin', 'Benin', ['']], ['4c Zambia', 'Zambia', ['']],
  ['5 Global Programs', 'Global Programs', ['Innovations', 'PEI', 'PSE']], ['6 GSE', 'GSE', ['']], ['7 DHGP', 'DHGP', ['']], ['8 BDAC', 'BDAC', ['']],
  ['9 Finance', 'Finance', ['']], ['10 DT', 'DT', ['']], ['11 P&C', 'P&C', ['']],
];
let n = 0;
for (const [sheet, ent, units] of sheets) {
  const rows: string[][] = [[`${ent} 2027 plan (FICTIF)`], H];
  const country = COUNTRIES.includes(ent);
  for (const unit of units) {
    const nKr = country ? 12 : 4;
    let lastObj = 0;
    for (let k = 0; k < nKr; k++) {
      const g = gkr[(n * 7 + k * 3) % 20];
      const obj = Math.floor(k / (country ? 4 : 2)) + 1;
      if (obj !== lastObj) {
        rows.push([`OBJECTIVE ${obj} · Section ${obj}`]);
        lastObj = obj;
      }
      const name = unit || ent;
      const kr = `${name} KR ${k + 1}: reach ${60 + k}% of target${k % 5 === 0 ? ' [X]' : ''}`;
      const lead = `Lead ${name} ${k % 3}`;
      const target = country ? ent : k % 2 ? 'Kenya and Uganda' : 'all countries';
      for (let i = 0; i < 1 + (k % 3); i++) {
        rows.push([
          i ? '' : g, i ? '' : `Test global KR ${g.slice(2)}`, i ? '' : unit, i ? '' : `${name} objective ${obj}`, i ? '' : kr, i ? '' : lead,
          `Initiative ${k + 1}.${i + 1} support ${target}`, `IL ${i}`, i % 2 ? '40%' : '1,200', i % 2 ? 'Percentage' : 'Numeric',
          'Quarterly report signed by lead', 'Plan validated', `Pilot reaching ${50 + i}`, i === 2 ? '' : 'Scale up',
          i % 2 ? 'Reach 80% by 2027' : '2,400 CHWs', i ? '' : `$${(k + 1) * 10}k`,
        ]);
      }
      reg.push([g, `Test global KR ${g.slice(2)}`, unit ? `Global Programs – ${unit}` : ent, (n + k) % 4 === 0 ? 'Lead' : 'Contributes',
        `${name} objective ${obj}`, kr, lead, country ? 'Pays' : 'Global']);
    }
    n++;
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg), '1 OKR Register');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Product', 'Description'], ['Test product A', 'Fictitious annex row']]), 'Annex A Product Annexes');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['KPI', 'Target'], ['Uptime', '99%']]), 'Annex B DT Service KPIs');
writeFileSync(process.argv[2] ?? 'test-workbook.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
