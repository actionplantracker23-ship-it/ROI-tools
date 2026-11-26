/** Paramètres : départements globaux et pays, trimestre en cours, seuils RAG, nom de l'utilisateur. */
import { useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, Field, inputCls, PageHeader } from '../components/ui';
import { addUnit, remove, upsert } from '../lib/ops';
import { emptyWorkspace, type Quarter, type UnitType } from '../types';
import { t as tr } from '../i18n';

export default function Settings() {
  const { ws, update, replaceAll, notify } = useApp();
  const [name, setName] = useState('');
  const [type, setType] = useState<UnitType>('department');
  const s = ws.settings;
  const set = (patch: Partial<typeof s>) => update((w) => ({ ...w, settings: { ...w.settings, ...patch } }));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={tr("Paramètres")} title={tr("Paramètres")} subtitle={tr("Départements globaux et pays (communs à tous les plans annuels), trimestre en cours, seuils de couleur.")} />
      <Card title={tr("Général")}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={tr("Votre nom (tracé dans l’historique)")}><input className={inputCls} value={s.userName} onChange={(e) => set({ userName: e.target.value })} /></Field>
          <Field label={tr("Trimestre en cours")}><select className={inputCls} value={s.currentQuarter} onChange={(e) => set({ currentQuarter: Number(e.target.value) as Quarter })}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>{tr("Q")}{q}</option>)}</select></Field>
          <Field label={tr("Vert à partir de (%)")}><input type="number" min={0} max={100} className={inputCls} value={s.rag.green} onChange={(e) => set({ rag: { ...s.rag, green: Number(e.target.value) } })} /></Field>
          <Field label={tr("Ambre à partir de (%)")}><input type="number" min={0} max={100} className={inputCls} value={s.rag.amber} onChange={(e) => set({ rag: { ...s.rag, amber: Number(e.target.value) } })} /></Field>
        </div>
        {s.rag.amber >= s.rag.green && <p className="mt-2 text-sm text-rag-red">{tr("Le seuil Ambre doit être inférieur au seuil Vert.")}</p>}
      </Card>
      {(['department', 'country'] as UnitType[]).map((t) => (
        <Card key={t} title={t === 'department' ? tr("Départements globaux") : tr("Pays")}>
          <ul className="divide-y divide-[#eef0f3]">
            {ws.units.filter((u) => u.type === t).sort((a, b) => a.order - b.order).map((u) => {
              const n = ws.activities.filter((a) => a.unitId === u.id).length;
              return (
                <li key={u.id} className="grid grid-cols-[1fr,1fr,90px,auto] items-center gap-2 py-2">
                  <input className={inputCls} value={u.name} onChange={(e) => update((w) => upsert(w, 'units', { ...u, name: e.target.value }))} aria-label={tr("Nom")} />
                  <input className={inputCls} value={u.group ?? ''} placeholder={tr("Regroupement (ex. Global Programs)")} onChange={(e) => update((w) => upsert(w, 'units', { ...u, group: e.target.value || undefined }))} aria-label={tr("Regroupement")} />
                  <span className="text-xs text-slate-500">{n} {tr("activité(s)")}</span>
                  <button className="text-sm text-rag-red hover:underline" onClick={() => { if (confirm(n ? tr("Supprimer {0} et ses {1} activité(s) dans tous les plans ?", { 0: u.name, 1: n }) : tr("Supprimer {0} ?", { 0: u.name }))) update((w) => remove(w, 'units', u.id), tr("Supprimé.")); }}>{tr("Supprimer")}</button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <Card title={tr("Ajouter un département ou un pays")}>
        <div className="grid gap-2 sm:grid-cols-[1fr,200px,auto]">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Nom")} />
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as UnitType)}><option value="department">{tr("Département global")}</option><option value="country">{tr("Pays")}</option></select>
          <Button variant="primary" disabled={!name.trim()} onClick={() => { update((w) => addUnit(w, name.trim(), type), tr("Ajouté.")); setName(''); }}>{tr("Ajouter")}</Button>
        </div>
      </Card>
      <Card title={tr("Réinitialiser")}>
        <p className="mb-2 text-sm text-slate-600">{tr("Efface tous les plans et le suivi de ce navigateur. Exportez d’abord une sauvegarde (Plans annuels).")}</p>
        <Button variant="danger" onClick={() => { if (confirm(tr("Effacer toutes les données de ce navigateur ?"))) { replaceAll(emptyWorkspace()); notify(tr("Données effacées.")); } }}>{tr("Tout effacer")}</Button>
      </Card>
    </div>
  );
}
