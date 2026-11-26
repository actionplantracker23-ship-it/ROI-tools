/**
 * Suivi trimestriel : par département ou par pays, mise à jour rapide de chaque activité
 * (statut, avancement, commentaire, historique) et saisie des valeurs de ses indicateurs pour le trimestre.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { fmt, QuickUpdate } from '../components/Editors';
import { Button, Card, inputCls, MiniProgress, NoPlan, OrphanBadge, PageHeader, StatusBadge } from '../components/ui';
import { targetKey } from '../lib/calc';
import { pct } from '../lib/format';
import { addIndicatorValue } from '../lib/ops';
import type { Activity, Indicator } from '../types';

function ValueInput({ ind }: { ind: Indicator }) {
  const { view, update } = useApp();
  const sc = view!.indicator.get(ind.id)!;
  const current = sc.valueQuarter === view!.quarter ? sc.value : null;
  const [v, setV] = useState(current === null ? '' : String(current));
  const n = ind.kind === 'yesno' ? (v === '' ? null : Number(v)) : v.trim() === '' ? null : Number(v.replace(',', '.'));
  const bad = n !== null && !Number.isFinite(n);
  return (
    <div className="grid grid-cols-[1fr,120px,auto] items-center gap-2 rounded-md bg-[#f5f8fb] px-2.5 py-1.5 text-sm">
      <span className="min-w-0"><span className="block truncate">{ind.name}</span>
        <span className="text-[11px] text-slate-500">cible Q{view!.quarter} {fmt(ind, sc.quarterTarget)} · finale {fmt(ind, ind.target)} · {pct(sc.progress)}</span></span>
      {ind.kind === 'yesno'
        ? <select className={inputCls} value={v} onChange={(e) => setV(e.target.value)} aria-label="Valeur"><option value="">—</option><option value="1">Oui</option><option value="0">Non</option></select>
        : <input inputMode="decimal" className={inputCls} value={v} onChange={(e) => setV(e.target.value)} placeholder={`Valeur Q${view!.quarter}`} aria-label="Valeur" />}
      <Button disabled={n === null || bad || n === current} onClick={() => update((w) => addIndicatorValue(w, ind.id, view!.quarter, n), 'Valeur enregistrée.')}>OK</Button>
    </div>
  );
}

function Row({ a }: { a: Activity }) {
  const { view, unit } = useApp();
  const v = view!;
  const sc = v.activity.get(a.id)!;
  const parents = v.parentsOf.get(a.id) ?? [];
  const inds = v.indByTarget.get(targetKey('activity', a.id)) ?? [];
  return (
    <Card className="!py-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-500">{unit(a.unitId)?.name}{a.subTeam ? ` (${a.subTeam})` : ''}</div>
          <div className="font-semibold text-[#1d2327]">{a.title}</div>
          <div className="text-xs text-slate-500">
            {v.krs.find((k) => k.id === a.krId)?.code ?? 'sans KR'} · Q{a.startQ}–Q{a.endQ} · Lead : {a.owner || 'non défini'}
            {a.level === 'country' && (parents.length ? <> · soutenu par <b>{[...new Set(parents.map((x) => unit(x.unitId)?.name))].join(', ')}</b></> : <> · <OrphanBadge /></>)}
            {a.level === 'global' && <> · {(v.childrenOf.get(a.id) ?? []).length} KR pays rattaché(s), avancement pays {pct(sc.children)}</>}
          </div>
        </div>
        <div className="flex items-center gap-2"><StatusBadge status={a.status} /><MiniProgress value={sc.progress} rag={sc.rag} /></div>
      </div>
      <QuickUpdate key={`${a.id}-${a.updatedAt}`} act={a} />
      {inds.length > 0 && <div className="mt-2 space-y-1.5">{inds.map((i) => <ValueInput key={`${i.id}-${v.quarter}`} ind={i} />)}</div>}
      {a.updatedAt && <div className="mt-1 text-[11px] text-slate-400">Mis à jour le {new Date(a.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} par {a.updatedBy}</div>}
    </Card>
  );
}

export default function FollowUp() {
  const { ws, plan, view } = useApp();
  const [unitId, setUnitId] = useState('');
  const [todo, setTodo] = useState(false);
  const [n, setN] = useState(20);
  const list = useMemo(() => {
    if (!view) return [];
    return view.activities.filter((a) => (!unitId || a.unitId === unitId) && a.status !== 'cancelled' && a.startQ <= view.quarter
      && (!todo || !a.updatedAt || (view.indByTarget.get(targetKey('activity', a.id)) ?? []).some((i) => view.indicator.get(i.id)?.valueQuarter !== view.quarter)));
  }, [view, unitId, todo]);
  if (!plan || !view) return <><PageHeader title="Suivi trimestriel" /><NoPlan /></>;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow={<>{plan.name} · <span className="text-accent">Q{view.quarter}</span></>} title="Suivi trimestriel"
        subtitle="Activités démarrées au trimestre choisi : statut, avancement, ce qui a été fait, et valeurs des indicateurs. Chaque enregistrement est conservé dans l’historique." />
      <Card>
        <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
          <select className={inputCls} value={unitId} onChange={(e) => { setUnitId(e.target.value); setN(20); }} aria-label="Département ou pays">
            <option value="">Tous les départements et pays</option>
            <optgroup label="Départements globaux">{ws.units.filter((u) => u.type === 'department').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
            <optgroup label="Pays">{ws.units.filter((u) => u.type === 'country').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} /> Reste à mettre à jour</label>
        </div>
      </Card>
      <p className="text-sm text-slate-500">{list.length} activité(s)</p>
      {list.slice(0, n).map((a) => <Row key={a.id} a={a} />)}
      {list.length > n && <div className="text-center"><Button onClick={() => setN(n + 20)}>Afficher 20 de plus</Button></div>}
    </div>
  );
}
