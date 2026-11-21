/**
 * Classeur FICTIF qui reproduit la STRUCTURE décrite du fichier source (onglets, colonnes,
 * cellules fusionnées, en-têtes de section). Les textes sont inventés : ils servent uniquement
 * à tester l'import, jamais de données de démonstration.
 */
import * as XLSX from 'xlsx';

const PLAN_HEADER = ['Ref', 'Global Key Result', 'Team/Unit', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead',
  'Initiative', 'Initiative Lead', 'Current Baseline', 'Metric', 'Evidence Source and Rule',
  'Q1 Milestone', 'Q2 Milestone', 'Q3 Milestone', 'Q4 Milestone', 'Indicative Budget'];

export function buildFixture(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ref: string[][] = [['2027 Global OKRs'], ['Ref', 'Objective / Key Result']];
  for (let o = 1; o <= 4; o++) {
    ref.push([`Objective ${o}: Test objective ${o}`]);
    for (let k = 1; k <= 5; k++) ref.push([`KR${o}.${k}`, `Test global key result ${o}.${k}`]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ref), 'Ref Global OKRs');

  const reg = [['OKR Register'], ['Ref', 'Global Key Result', 'Country/Team', 'Role', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Scope']];
  reg.push(['KR1.1', 'Test global key result 1.1', 'Kenya', 'Lead', 'Kenya obj A', 'Kenya KR alpha reach 80% coverage', 'Lead K', 'Pays']);
  reg.push(['', '', 'Global Programs – PEI', 'Contributes', 'PEI obj', 'PEI KR support countries', 'Lead P', 'Global']);
  reg.push(['KR1.2', 'Test global key result 1.2', 'Kenya', 'Contributes', 'Kenya obj A', 'Kenya KR beta [X] households', 'Lead K2', 'Pays']);
  reg.push(['KR2.1', 'Test global key result 2.1', 'GSE', 'Lead', 'GSE obj', 'GSE KR only in register', 'Lead G', 'Global']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reg), '1 OKR Register');

  const ke = [['Kenya 2027 plan'], PLAN_HEADER,
    ['OBJECTIVE 1 · Test objective 1'],
    ['KR1.1', 'Test global key result 1.1', 'Ops', 'Kenya obj A', 'Kenya KR alpha reach 80% coverage', 'Lead K', 'Init 1', 'IL1', '50%', 'Percentage', 'DHIS2 report', 'Plan', 'Pilot 60%', 'Scale 70%', 'Reach 80% by 2027', '$120k'],
    ['', '', '', '', '', '', 'Init 2', 'IL2', 'n/a', 'Yes/No', 'Memo', 'Draft', '', 'Validate', 'Done', ''],
    ['KR1.2', 'Test global key result 1.2', 'Ops', '', 'Kenya KR beta [X] households', 'Lead K2', 'Init 3', 'IL3', '1,000', 'Numeric', 'Survey', 'Survey', 'Q2', 'Q3', '2,000 households', '45,000'],
  ];
  const wsKe = XLSX.utils.aoa_to_sheet(ke);
  wsKe['!merges'] = [{ s: { r: 3, c: 3 }, e: { r: 5, c: 3 } }]; // objectif fusionné sur 3 lignes
  XLSX.utils.book_append_sheet(wb, wsKe, '2 Kenya');

  const gp = [PLAN_HEADER,
    ['KR1.1', 'Test global key result 1.1', 'PEI', 'PEI obj', 'PEI KR support countries', 'Lead P', 'TA to Kenya and Uganda', 'IL4', '', 'Yes/No', 'Report', 'Mission Kenya', 'Mission Uganda', '', 'Report', ''],
    ['KR3.1', 'Test global key result 3.1', 'Innovations', 'Inno obj', 'Inno KR', 'Lead I', 'All countries rollout', 'IL5', '', 'Yes/No', 'Report', 'A', 'B', 'C', 'D', ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gp), '5 Global Programs');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['KPI', 'Target'], ['Uptime', '99%']]), 'Annex B DT Service KPIs');
  return wb;
}
