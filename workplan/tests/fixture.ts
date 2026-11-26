/**
 * Classeur de STRUCTURE pour les tests automatiques uniquement (mise en page identique au fichier OKR :
 * registre avec sections et cellules fusionnées, analyse d'alignement parties A et B). Textes neutres.
 */
import * as XLSX from 'xlsx';

export function workbook(): XLSX.WorkBook {
  const reg = [
    ['OKR Register · test', '', '', '', '', '', '', '', '◄ Contents'],
    [],
    ['Ref', 'Global Key Result', 'Country / Team', 'Role', 'Country/Team Objective', 'Country/Team Key Result', 'KR Lead', 'Scope', 'Go to plan'],
    ['OBJECTIVE 1  ·  Objective one title'],
    ['KR1.1', 'KR1.1\r\nGlobal KR one', 'Kenya', 'Lead', 'Obj K', 'Kenya KR a', 'Lead K', 'Kenya', 'Open ►'],
    ['KR1.1', '', 'Kenya (Finance & Admin)', 'Contributes', 'Obj KF', 'Kenya finance KR', 'Lead KF', 'Kenya', 'Open ►'],
    ['KR1.1', '', 'Global Programs (PEI)', 'Contributes', 'Obj PEI', 'PEI KR a', 'Lead P', 'Global', 'Open ►'],
    ['KR1.1', '', 'DHGP', 'Contributes', 'Obj D', 'DHGP KR a', 'Lead D', 'Global', 'Open ►'],
    ['KR1.2', 'KR1.2\r\nGlobal KR two', 'Burkina Faso', 'Lead', 'Obj B', 'Burkina KR orphan', 'Lead B', 'Burkina Faso', 'Open ►'],
    ['Team KR · O1', 'Team KRs (no Global KR) Key Results set by a team', 'Global Programs (PEI)', 'Team KR', 'Obj PEI2', 'PEI team KR', 'Lead P', 'Global', 'Open ►'],
    ['OBJECTIVE 2  ·  Objective two title'],
    ['KR2.1', 'KR2.1\r\nGlobal KR three', 'CEO', '', 'No country/team plan yet', '', '', '', ''],
  ];
  const ali = [
    ['OKR Alignment · test'],
    ['Status', 'Country KRs', 'Global team KRs'],
    ['A  ·  COUNTRY KR  →  IS IT SUPPORTED BY A GLOBAL TEAM KR?'],
    ['Country', 'Obj.', 'Ref', 'Country Key Result', 'KR Lead', 'Global teams with a KR under the same Ref', '# Global team KRs', 'Status', 'Finding / gap', 'Recommended action'],
    ['Kenya', 'O1', 'KR1.1', 'Kenya KR a', 'Lead K', 'Global Programs (PEI), DHGP', '2', 'Aligned', 'Supported', 'None'],
    ['Kenya', 'O1', 'KR1.1', 'Kenya finance KR', 'Lead KF', 'DHGP', '1', 'Partial', 'Only DHGP', 'Add PEI'],
    ['Burkina Faso', 'O1', 'KR1.2', 'Burkina KR orphan', 'Lead B', '— none —', '0', 'Gap', 'No global team KR', 'Name a team'],
    [],
    ['B · GLOBAL TEAM KR → DO THE COUNTRIES COMMIT TO IT?'],
    ['Global team', 'Obj.', 'Ref', 'Global team Key Result', 'Scope', 'Countries with a KR under the same Ref', '# Country KRs', 'Status', 'Finding / gap', 'Recommended action'],
    ['Global Programs (PEI)', 'O1', 'KR1.1', 'PEI KR a', 'Global', 'Kenya', '2', 'Aligned', 'ok', 'None'],
    ['DHGP', 'O1', 'KR1.1', 'DHGP KR a', 'Global', 'Kenya', '2', 'Conflict', 'Dates differ', 'Align dates'],
    ['Global Programs (PEI)', 'O1', 'Team KR · O1', 'PEI team KR', 'Global', '— none —', '0', 'Global only', 'Analytics', 'None'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(reg);
  ws['!merges'] = [{ s: { r: 4, c: 1 }, e: { r: 7, c: 1 } }, { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, { s: { r: 11, c: 4 }, e: { r: 11, c: 7 } }];
  XLSX.utils.book_append_sheet(wb, ws, 'OR register');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ali), 'alignement du OKR');
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
}
