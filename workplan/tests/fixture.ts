/** Classeur FICTIF reproduisant la structure décrite (registre + analyse d'alignement). Textes inventés. */
import * as XLSX from 'xlsx';

export function registerSheet(): string[][] {
  return [
    ['Ref', 'Global Key Result', 'Country / Team', 'Role', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Scope', 'Go to plan'],
    ['OBJECTIVE 1  ·  Embed and scale high performing eCHIS, Smart Supervision, and performance management practices into implementation support in Kenya and Burkina Faso.'],
    ['KR1.1', 'eCHIS scaled in 2 countries', 'DHGP', 'Lead', 'DHGP objective', 'DHGP supports eCHIS scale-up', 'Lead D', 'Global', '7 DHGP'],
    ['', '', 'Kenya', 'Contributes', 'Kenya objective', 'Kenya eCHIS in 10 counties', 'Lead K', 'Pays', '2 Kenya'],
    ['', '', 'Burkina Faso', 'Contributes', 'BF objective', 'BF eCHIS in 3 regions', 'Lead B', 'Pays', '3 Burkina Faso'],
    ['KR1.2', 'Smart supervision adopted', 'GSE', 'Lead', 'GSE objective', 'GSE smart supervision', 'Lead G', 'Global', '6 GSE'],
    ['OBJECTIVE 2  ·  Second test objective'],
    ['KR2.1', 'Finance KR', 'Finance', 'Lead', 'Fin objective', 'Finance KR text', 'Lead F', 'Global', '9 Finance'],
  ];
}

export function alignmentLong(): string[][] {
  return [
    ['Analyse d’alignement des activités'],
    ['Ref', 'Département', 'Activité globale', 'Pays', 'Activité pays', 'Alignement', 'Commentaire'],
    ['KR1.1', 'DHGP', 'Deploy eCHIS training package', 'Kenya', 'Train CHAs on eCHIS in 10 counties', 'Aligné', ''],
    ['', '', '', 'Burkina Faso', 'Former les ASC sur eCHIS', 'Partiel', 'Couverture régionale seulement'],
    ['KR1.2', 'GSE', 'Smart supervision rollout', '', '', '', 'Pas encore décliné en pays'],
    ['KR1.1', '', '', 'Kenya', 'Kenya-only data dashboard', 'Non aligné', 'Initiative locale'],
    ['KR2.1', 'Finance', 'Budget tracking tool', 'Zambia', 'Zambia budget tracking', 'Aligned', ''],
  ];
}

export function alignmentWide(): string[][] {
  return [
    ['Ref', 'Department', 'Global activity', 'Kenya', 'Burkina Faso', 'Uganda'],
    ['KR1.1', 'DHGP', 'Deploy eCHIS training package', 'Train CHAs on eCHIS', 'Former les ASC\nSuivi mensuel eCHIS', ''],
    ['KR1.2', 'GSE', 'Smart supervision rollout', '', '', 'N/A'],
  ];
}

export function workbook(align: string[][] = alignmentLong()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const reg = XLSX.utils.aoa_to_sheet(registerSheet());
  XLSX.utils.book_append_sheet(wb, reg, 'OKR Register');
  const al = XLSX.utils.aoa_to_sheet(align);
  // l'activité globale DHGP est fusionnée sur deux lignes (Kenya + Burkina Faso)
  if (align === undefined || align[1]?.[2] === 'Activité globale') {
    al['!merges'] = [{ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }, { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }];
  }
  XLSX.utils.book_append_sheet(wb, al, 'Analyse alignement');
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
}
