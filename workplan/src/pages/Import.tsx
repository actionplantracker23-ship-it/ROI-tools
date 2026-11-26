/**
 * Import du classeur OKR (registre + analyse d'alignement). Aperçu complet avant d'appliquer :
 * objectifs, Ref, KR des équipes globales et des pays, statuts d'alignement, orphelins, lignes non rapprochées.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useApp } from '../AppContext';
import { AlignBadge, Button, Card, Field, inputCls, PageHeader, Stat } from '../components/ui';
import { importOkr, readOkrWorkbook, type OkrFile } from '../lib/importer';
import { createPlan } from '../lib/ops';
import type { AlignStatus } from '../types';

const ORDER = ['aligned', 'partial', 'conflict', 'gap', 'global_only', 'none'];

export default function Import() {
  const { ws, plan, update, setError } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [file, setFile] = useState<OkrFile | null>(null);
  const [replace, setReplace] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [done, setDone] = useState(false);
  const hasContent = !!plan && ws.activities.some((a) => a.planId === plan.id);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setFile(readOkrWorkbook(XLSX.read(await f.arrayBuffer(), { type: 'array' })));
      setName(f.name);
      setDone(false);
    } catch (e) { setError(`Lecture du fichier impossible : ${(e as Error).message}`); }
  };
  const run = (w: typeof ws) => {
    const base = plan ? { ws: w, planId: plan.id } : createPlan(w, { year });
    return importOkr(base.ws, base.planId, file!, { replace: replace || !hasContent });
  };
  const preview = useMemo(() => (file ? run(ws).report : null), [file, replace, ws, plan, year]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={plan ? `Import dans : ${plan.name}` : 'Import'} title="Import du fichier OKR"
        subtitle="Le classeur contient le registre OKR (Ref, Global Key Result, Country / Team, Role, …, Scope, Go to plan) et l’analyse d’alignement (A · KR pays → équipes globales ; B · KR équipes globales → pays). Les deux feuilles sont reconnues automatiquement." />
      <Card title="1. Fichier">
        <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-md bg-brand-600 px-3.5 text-[16px] text-white hover:bg-brand-700">
          Choisir le fichier Excel<input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {name && <span className="ml-3 text-sm text-slate-600">{name}</span>}
        <p className="mt-2 text-xs text-slate-500">Le fichier est lu dans ce navigateur ; rien n’est envoyé sur internet.</p>
        {file && (
          <ul className="mt-3 space-y-1 text-sm">
            <li>Registre : <b>{file.registerSheet ?? 'non trouvé'}</b> · {file.register.filter((r) => r.kr).length} ligne(s) KR · {file.objectives.size} objectif(s)</li>
            <li>Analyse d’alignement : <b>{file.alignmentSheet ?? 'non trouvée'}</b> · A : {file.a.length} KR pays · B : {file.b.length} KR d’équipes globales</li>
          </ul>
        )}
      </Card>

      {file && preview && (
        <Card title="2. Aperçu et application">
          {!plan && <div className="mb-3"><Field label="Aucun plan ouvert : créer le plan de l’année"><input type="number" className={`${inputCls} w-32`} value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field></div>}
          {hasContent && (
            <div className="mb-3 space-y-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={!replace} onChange={() => setReplace(false)} /> Mettre à jour « {plan!.name} » en conservant le suivi (statuts, avancement, indicateurs, historique)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={replace} onChange={() => setReplace(true)} /> Remplacer tout le contenu du plan</label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Objectifs" value={file.objectives.size} />
            <Stat label="Ref (KR globaux)" value={preview.krs} hint="nouveaux, dont groupes Team KR" />
            <Stat label="KR équipes globales" value={preview.globalActivities} hint={preview.updated ? `${preview.updated} mis à jour` : undefined} color="#5bc0eb" />
            <Stat label="KR pays" value={preview.countryActivities} color="#f28c28" />
            <Stat label="Soutenus par le global" value={preview.linked} color="#2e9e4f" />
            <Stat label="Orphelins" value={<span className={preview.orphans ? 'text-rag-red' : ''}>{preview.orphans}</span>} color="#d64545" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(['countryStatus', 'globalStatus'] as const).map((k) => (
              <table key={k} className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">{k === 'countryStatus' ? 'KR pays' : 'KR équipes globales'}</th><th className="text-right">Nombre</th></tr></thead>
                <tbody>{ORDER.filter((s) => preview[k][s]).map((s) => <tr key={s} className="border-t border-[#eef0f3]"><td className="py-1">{s === 'none' ? <span className="text-xs text-slate-500">non analysé</span> : <AlignBadge status={s as AlignStatus} />}</td><td className="text-right font-bold">{preview[k][s]}</td></tr>)}</tbody>
              </table>
            ))}
          </div>
          {preview.orphanTitles.length > 0 && (
            <div className="mt-4 rounded-md border border-[#f3c2c8] bg-[#fdecee] p-3 text-sm text-[#8a1c2b]">
              <b>KR pays orphelins (aucune équipe globale sous la même Ref) :</b>
              <ul className="mt-1 list-disc pl-5">{preview.orphanTitles.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {preview.noPlan.length > 0 && <p className="mt-3 text-sm text-[#9a4a00]">KR globaux sans plan pays/équipe : {preview.noPlan.join(', ')}.</p>}
          {preview.unitsCreated.length > 0 && <p className="mt-2 text-sm text-[#9a4a00]">Unités créées : {preview.unitsCreated.join(', ')}.</p>}
          {preview.unmatched.length > 0 && <div className="mt-2 text-sm text-rag-red"><b>Lignes de l’analyse non rapprochées du registre :</b><ul className="list-disc pl-5 text-xs">{preview.unmatched.slice(0, 20).map((u) => <li key={u}>{u}</li>)}</ul></div>}
          {preview.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[#9a4a00]">{preview.warnings.slice(0, 15).map((w) => <li key={w}>{w}</li>)}</ul>}
          {preview.kept > 0 && !replace && <p className="mt-2 text-xs text-slate-500">{preview.kept} élément(s) du plan absents du fichier sont conservés.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" disabled={done || !file.registerSheet} onClick={() => { update((w) => run(w).ws, 'Import terminé.'); setDone(true); }}>
              {plan ? `Appliquer à ${plan.name}` : `Créer le plan ${year} et importer`}
            </Button>
            {done && <><span className="self-center text-sm font-semibold text-rag-green">Import appliqué.</span><Button onClick={() => navigate('/alignement')}>Voir l’alignement</Button><Button onClick={() => navigate('/taches')}>Voir les tâches</Button></>}
          </div>
        </Card>
      )}
    </div>
  );
}
