/** Tous les indicateurs de mesure du plan (objectifs, KR, activités globales et pays) : valeurs par trimestre, avancement. */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { fmt, IndicatorEditor } from '../components/Editors';
import { Button, Card, inputCls, MiniProgress, NoPlan, PageHeader, RagBadge } from '../components/ui';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import type { Indicator, Quarter } from '../types';
import { t as tr } from '../i18n';

const LEVEL: Record<string, string> = { objective: 'Objectif', kr: 'KR', global: 'Activité globale', country: 'Activité pays' };

export default function Indicators() {
  const { plan, view, unit } = useApp();
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Indicator | null>(null);
  const [f, setF] = useState({ level: '', unit: '', missing: false, q: '' });
  const rows = useMemo(() => {
    if (!view) return [];
    return view.indicators.map((i) => {
      const a = i.targetType === 'activity' ? view.byId.get(i.targetId) : undefined;
      const level = i.targetType === 'activity' ? (a?.level ?? 'global') : i.targetType;
      const owner = i.targetType === 'objective' ? view.objectives.find((o) => o.id === i.targetId) : i.targetType === 'kr' ? view.krs.find((k) => k.id === i.targetId) : a;
      const label = i.targetType === 'objective' ? `O${(owner as { code: string })?.code ?? ''}` : i.targetType === 'kr' ? (owner as { code: string })?.code ?? '' : a?.title ?? '';
      return { i, level, label, unitId: a?.unitId ?? '' };
    });
  }, [view]);
  if (!plan || !view) return <><PageHeader title={tr("Indicateurs")} /><NoPlan /></>;
  const focus = params.get('ind');
  const q = f.q.toLowerCase();
  const list = rows.filter((r) => (!f.level || r.level === f.level) && (!f.unit || r.unitId === f.unit)
    && (!f.missing || view.indicator.get(r.i.id)?.valueQuarter !== view.quarter) && (!q || (r.i.name + r.label).toLowerCase().includes(q)) && (!focus || r.i.id === focus || f.q || f.level || f.unit));
  const valueAt = (i: Indicator, qq: Quarter) => (view.valuesByInd.get(i.id) ?? []).filter((v) => v.quarter === qq).sort((a, b) => b.at.localeCompare(a.at))[0]?.value ?? null;
  const filled = view.indicators.filter((i) => view.indicator.get(i.id)?.valueQuarter === view.quarter).length;
  const doExport = () => exportRows(list.map(({ i, level, label, unitId }) => ({
    [tr("Niveau")]: tr(LEVEL[level]), [tr("Rattaché à")]: label, [tr("Unité")]: unitId ? unit(unitId)?.name : '', [tr("Indicateur")]: i.name, Type: i.kind, Baseline: i.baseline ?? '',
    ...Object.fromEntries(([1, 2, 3, 4] as Quarter[]).flatMap((qq) => [[tr("Cible Q{0}", { 0: qq }), i.quarterTargets[qq - 1] ?? ''], [tr("Valeur Q{0}", { 0: qq }), valueAt(i, qq) ?? '']])),
    [tr("Cible finale")]: i.target ?? '', [tr("Avancement Q{0}", { 0: view.quarter })]: pct(view.indicator.get(i.id)?.progress), Source: i.source,
  })), `indicateurs-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={<>{plan.name} · <span className="text-accent">{tr("Q")}{view.quarter}</span></>} title={tr("Indicateurs de mesure des résultats")}
        subtitle={tr("{0} indicateur(s), {1} renseigné(s) au Q{2}. Ajoutez des indicateurs depuis le plan de travail ou la fiche d’une activité ; cliquez sur une ligne pour saisir une valeur.", { 0: view.indicators.length, 1: filled, 2: view.quarter })}
        actions={<Button onClick={doExport}>{tr("Export Excel")}</Button>} />
      <Card>
        <div className="grid gap-2 sm:grid-cols-[1fr,1fr,1fr,auto]">
          <select className={inputCls} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} aria-label={tr("Niveau")}>
            <option value="">{tr("Tous les niveaux")}</option>{Object.entries(LEVEL).map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
          </select>
          <select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label={tr("Unité")}>
            <option value="">{tr("Toutes les unités")}</option>{[...new Set(rows.map((r) => r.unitId).filter(Boolean))].map((u) => <option key={u} value={u}>{unit(u)?.name}</option>)}
          </select>
          <input className={inputCls} placeholder={tr("Rechercher…")} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.missing} onChange={(e) => setF({ ...f, missing: e.target.checked })} /> {tr("Non renseignés Q")}{view.quarter}</label>
        </div>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1100px]">
          <thead><tr><th>{tr("Niveau")}</th><th>{tr("Indicateur")}</th><th>{tr("Baseline")}</th>{[1, 2, 3, 4].map((qq) => <th key={qq} className={qq === view.quarter ? '!bg-brand-500' : ''}>{tr("Q")}{qq}</th>)}<th>{tr("Cible")}</th><th>{tr("Avancement")}</th></tr></thead>
          <tbody>
            {list.map(({ i, level, label, unitId }) => {
              const sc = view.indicator.get(i.id)!;
              return (
                <tr key={i.id} className={`cursor-pointer hover:bg-[#fafbfc] ${focus === i.id ? 'bg-brand-50' : ''}`} onClick={() => setEdit(i)}>
                  <td className="whitespace-nowrap text-xs"><b className="text-brand-500">{tr(LEVEL[level])}</b><div className="max-w-[180px] truncate text-slate-500" title={label}>{unitId ? `${unit(unitId)?.name} · ` : ''}{label}</div></td>
                  <td className="max-w-[280px]">{i.name}{i.source && <div className="text-xs text-slate-500">{tr("Source :")} {i.source}</div>}</td>
                  <td className="whitespace-nowrap">{fmt(i, i.baseline)}</td>
                  {([1, 2, 3, 4] as Quarter[]).map((qq) => {
                    const v = valueAt(i, qq);
                    const t = i.quarterTargets[qq - 1];
                    const ok = v === null || t === null ? null : (i.target ?? 0) >= (i.baseline ?? 0) ? v >= t : v <= t;
                    return <td key={qq} className={`whitespace-nowrap ${qq === view.quarter ? 'bg-[#f5f8fb]' : ''}`}><b className={ok === false ? 'text-rag-red' : ok ? 'text-rag-green' : ''}>{fmt(i, v)}</b>{t !== null && <div className="text-[13.5px] text-slate-500">{tr("cible")} {fmt(i, t)}</div>}</td>;
                  })}
                  <td className="whitespace-nowrap font-semibold text-brand-500">{fmt(i, i.target)}</td>
                  <td>{sc.progress === null ? <RagBadge rag="none" /> : <MiniProgress value={sc.progress} rag={sc.rag} />}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={9} className="py-6 text-center text-slate-500">{tr("Aucun indicateur.")}</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <IndicatorEditor ind={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
