/** Plans annuels : créer le plan de l'année (vierge ou à partir du plan précédent), changer de plan, statut, sauvegarde. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Button, Card, Field, inputCls, MiniProgress, PageHeader, RagBadge } from '../components/ui';
import { computePlan } from '../lib/calc';
import { createPlan, deletePlan, updatePlan } from '../lib/ops';
import { downloadJson, normalize } from '../lib/storage';
import { PLAN_STATUS_LABEL, type PlanStatus } from '../types';

export default function Plans() {
  const { ws, update, replaceAll, notify, setError } = useApp();
  const navigate = useNavigate();
  const plans = [...ws.plans].sort((a, b) => b.year - a.year);
  const last = plans[0];
  const [f, setF] = useState({
    year: (last?.year ?? new Date().getFullYear()) + (last ? 1 : 0), name: '', source: last?.id ?? '',
    activities: true, indicators: true, baselines: true,
  });
  const yearTaken = ws.plans.some((p) => p.year === f.year);

  const create = () => {
    update((w) => createPlan(w, {
      year: f.year, name: f.name.trim() || undefined, sourcePlanId: f.source || null,
      copyActivities: f.activities, copyIndicators: f.indicators, carryBaselines: f.baselines,
    }).ws, `Plan ${f.year} créé.`);
    navigate('/taches');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!confirm(`Remplacer toutes les données de ce navigateur par la sauvegarde (${data.plans.length} plan(s)) ?`)) return;
      replaceAll(data);
      notify('Sauvegarde restaurée.');
    } catch (e) { setError(`Restauration impossible : ${(e as Error).message}`); }
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Plans annuels" title="Plans de travail"
        subtitle="Un plan par année. Chaque nouveau plan peut reprendre la structure du précédent (objectifs, KR, activités globales et pays, liens d’alignement, indicateurs) avec un suivi remis à zéro." />

      <Card title="Créer un plan de travail">
        <div className="grid gap-3 sm:grid-cols-[120px,1fr,1fr]">
          <Field label="Année"><input type="number" className={inputCls} value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></Field>
          <Field label="Nom (facultatif)"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={`Plan de travail ${f.year}`} /></Field>
          <Field label="Point de départ">
            <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="">Plan vierge</option>
              {plans.map((p) => <option key={p.id} value={p.id}>Reprendre la structure de : {p.name}</option>)}
            </select>
          </Field>
        </div>
        {f.source && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="text-slate-500">Objectifs et KR toujours repris, plus :</span>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.activities} onChange={(e) => setF({ ...f, activities: e.target.checked })} /> KR / activités des équipes globales et des pays (registre, liens, analyse d’alignement)</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.indicators} onChange={(e) => setF({ ...f, indicators: e.target.checked })} /> indicateurs</label>
            {f.indicators && <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.baselines} onChange={(e) => setF({ ...f, baselines: e.target.checked })} /> baseline = dernière valeur mesurée l’an passé</label>}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" disabled={!f.year || yearTaken} onClick={create}>Créer le plan {f.year}</Button>
          {yearTaken && <span className="text-sm text-rag-red">Un plan existe déjà pour {f.year}.</span>}
          {!f.source && <span className="text-sm text-slate-500">Ensuite : construisez le plan (Plan de travail) ou importez votre fichier Excel (Import Excel).</span>}
        </div>
      </Card>

      {plans.length > 0 && (
        <Card title={`Plans (${plans.length})`}>
          <div className="overflow-x-auto">
            <table className="suivi min-w-[760px]">
              <thead><tr><th>Année</th><th>Plan</th><th>Statut</th><th>Contenu</th><th>Alignement</th><th>Avancement</th><th /></tr></thead>
              <tbody>
                {plans.map((p) => {
                  const v = computePlan(ws, p.id, ws.settings.currentQuarter);
                  const src = ws.plans.find((x) => x.id === p.sourcePlanId);
                  return (
                    <tr key={p.id} className={p.id === ws.currentPlanId ? 'bg-brand-50' : ''}>
                      <td className="font-titre text-2xl font-semibold text-accent">{p.year}</td>
                      <td>
                        <input className="w-full rounded border border-transparent bg-transparent px-1 font-semibold hover:border-[#c9ced4]" value={p.name} onChange={(e) => update((w) => updatePlan(w, { ...p, name: e.target.value }))} aria-label="Nom du plan" />
                        {src && <div className="px-1 text-xs text-slate-500">Structure reprise de {src.name}</div>}
                      </td>
                      <td>
                        <select className="rounded border border-[#c9ced4] px-1.5 py-1 text-sm" value={p.status} onChange={(e) => update((w) => updatePlan(w, { ...p, status: e.target.value as PlanStatus }))}>
                          {(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map((s) => <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">{v.objectives.length} objectifs · {v.krs.length} KR<br />{v.globalActs.length} KR équipes globales · {v.countryActs.length} KR pays · {v.indicators.length} indic.</td>
                      <td className="whitespace-nowrap text-xs">{v.alignment.countryActs ? <>{Math.round(v.alignment.rate ?? 0)} % soutenus{v.orphans.length ? <span className="ml-1 font-semibold text-rag-red">· {v.orphans.length} orphelin(s)</span> : null}</> : '—'}</td>
                      <td>{v.plan.progress === null ? <RagBadge rag="none" /> : <MiniProgress value={v.plan.progress} rag={v.plan.rag} />}</td>
                      <td className="whitespace-nowrap">
                        <Button className="!min-h-[32px] !px-2.5 !py-1 text-sm" variant={p.id === ws.currentPlanId ? 'primary' : 'secondary'} onClick={() => { update((w) => ({ ...w, currentPlanId: p.id })); navigate('/'); }}>Ouvrir</Button>
                        <button className="ml-2 text-sm text-rag-red hover:underline" onClick={() => { if (confirm(`Supprimer définitivement le plan ${p.year} et tout son suivi ?`)) update((w) => deletePlan(w, p.id), 'Plan supprimé.'); }}>Supprimer</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Sauvegarde">
        <p className="mb-3 text-sm text-slate-600">Les données sont enregistrées automatiquement dans ce navigateur. Exportez régulièrement une sauvegarde (fichier JSON) pour la partager ou la conserver.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadJson(ws, `plan-de-travail-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`)}>Exporter la sauvegarde</Button>
          <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-md border border-[#c9ced4] bg-white px-3.5 text-[16px] hover:border-accent">
            Restaurer une sauvegarde<input type="file" accept=".json" className="hidden" onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </Card>
    </div>
  );
}
