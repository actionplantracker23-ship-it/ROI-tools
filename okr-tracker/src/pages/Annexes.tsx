import { useState } from 'react';
import { useApp } from '../AppContext';
import { Card, EmptyState, PageHeader } from '../components/ui';

export default function Annexes() {
  const { ds } = useApp();
  const [tab, setTab] = useState(0);
  if (!ds.annexes.length) return <><PageHeader title="Annexes" /><EmptyState title="Aucune annexe importée" /></>;
  const a = ds.annexes[Math.min(tab, ds.annexes.length - 1)];
  return (
    <div className="space-y-4">
      <PageHeader title="Annexes" subtitle="Tableaux de référence repris tels quels du fichier source." />
      <div className="flex flex-wrap gap-2">
        {ds.annexes.map((x, i) => (
          <button key={x.id} onClick={() => setTab(i)} className={`rounded-full px-3 py-1 text-sm font-medium ${i === tab ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{x.sheet}</button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {a.rows.map((r, i) => (
                <tr key={i} className={i === 0 ? 'bg-slate-50 font-semibold' : ''}>
                  {r.map((c, j) => <td key={j} className="whitespace-pre-line px-3 py-1.5 align-top">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
