/**
 * Classeur FICTIF (textes inventés) à la structure attendue : feuille « OKR Register » et feuille
 * « Analyse alignement ». Sert uniquement à tester l'outil. Usage : npx tsx scripts/make-test-workbook.ts sortie.xlsx
 */
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const DEPTS = ['DHGP', 'GSE', 'PEI', 'PSE', 'Finance', 'BDAC', 'DT', 'P&C', 'Innovations'];
const COUNTRIES = ['Kenya', 'Burkina Faso', 'Uganda', 'Benin', 'Zambia'];
const OBJ = [
  'Embed and scale high performing eCHIS, Smart Supervision, and performance management practices (test)',
  'Strengthen community health systems financing (test)',
  'Grow strategic partnerships and evidence use (test)',
  'Build a high performing organisation (test)',
];
const reg: string[][] = [['Ref', 'Global Key Result', 'Country / Team', 'Role', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Scope', 'Go to plan']];
const ali: string[][] = [['Analyse d’alignement activités globales / pays (FICTIF)'], ['Ref', 'Département', 'Activité globale', 'Pays', 'Activité pays', 'Alignement', 'Commentaire']];
let n = 0;
for (let o = 1; o <= 4; o++) {
  reg.push([`OBJECTIVE ${o}  ·  ${OBJ[o - 1]}`]);
  for (let k = 1; k <= 5; k++) {
    const ref = `KR${o}.${k}`;
    const lead = DEPTS[(o + k) % DEPTS.length];
    reg.push([ref, `Global KR ${o}.${k} (test)`, lead, 'Lead', `${lead} objective ${o}`, `${lead} delivers KR ${o}.${k}`, `Lead ${lead}`, 'Global', `${lead}`]);
    for (const c of COUNTRIES.filter((_, i) => (i + k) % 2 === 0)) reg.push(['', '', c, 'Contributes', `${c} objective ${o}`, `${c} contributes to ${o}.${k}`, `Lead ${c}`, 'Pays', c]);
    // 3 activités globales par KR
    for (let g = 1; g <= 3; g++) {
      const dept = DEPTS[(o * 3 + k + g) % DEPTS.length];
      const gTitle = `${dept} activity ${o}.${k}.${g}: deploy package and support countries (test)`;
      const countries = COUNTRIES.filter((_, i) => (i + g + k) % 3 !== 0).slice(0, g === 3 ? 0 : 3); // la 3e reste globale seule
      if (!countries.length) ali.push([ref, dept, gTitle, '', '', '', 'Pas de déclinaison pays']);
      countries.forEach((c, i) => {
        n++;
        ali.push([i ? '' : ref, i ? '' : dept, i ? '' : gTitle, c, `${c}: implement ${o}.${k}.${g} in districts (test)`, n % 7 === 0 ? 'Partiel' : 'Aligné', '']);
      });
    }
    // une activité pays orpheline tous les deux KR
    if ((o + k) % 2 === 0) ali.push([ref, '', '', COUNTRIES[(o + k) % 5], `${COUNTRIES[(o + k) % 5]} local initiative ${o}.${k} not in global plan (test)`, 'Non aligné', 'Initiative locale']);
  }
}
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg), 'OKR Register');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ali), 'Analyse alignement');
writeFileSync(process.argv[2] ?? 'classeur-test.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
