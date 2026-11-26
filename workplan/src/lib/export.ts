/** Exports : Excel/CSV via SheetJS, PDF via html2canvas + jsPDF. */
import * as XLSX from 'xlsx';

export function exportRows(rows: Record<string, unknown>[], fileName: string, format: 'xlsx' | 'csv') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${fileName}.${format}`, { bookType: format });
}

/** Classeur à plusieurs onglets. */
export function exportSheets(sheets: Record<string, Record<string, unknown>[]>, fileName: string) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

