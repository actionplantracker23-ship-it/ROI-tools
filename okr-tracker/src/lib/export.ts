/** Exports : Excel/CSV via SheetJS, PDF via html2canvas + jsPDF. */
import * as XLSX from 'xlsx';

export function exportRows(rows: Record<string, unknown>[], fileName: string, format: 'xlsx' | 'csv') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${fileName}.${format}`, { bookType: format });
}

export async function exportPdf(el: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', ignoreElements: (n) => n.classList?.contains('no-print') });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth() - 20;
  const pageH = pdf.internal.pageSize.getHeight() - 20;
  const h = (canvas.height * w) / canvas.width;
  // découpe en pages A4
  const img = canvas.toDataURL('image/jpeg', 0.92);
  for (let y = 0; y < h; y += pageH) {
    if (y > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 10, 10 - y, w, h);
  }
  pdf.save(`${fileName}.pdf`);
}
