import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, inputCls, PageHeader, RoleBadge } from '../components/ui';
import { applyDemoQ1 } from '../lib/demo';
import { parseFile, type ParseResult } from '../lib/import/excel';
import { contributionWeight } from '../lib/progress';
import { isAdmin } from '../lib/permissions';
import { ROLE_LABEL, type AppUser, type Dataset, type ImportReport, type Quarter, type Settings, type UserRole } from '../types';

function ReportView({ r }: { r: ImportReport }) {
  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {r.checks.map((c) => (
          <li key={c.label} className={`rounded-lg px-3 py-2 text-sm ring-1 ${c.ok ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
            <b>{c.ok ? '✓' : '!'} {c.label}</b> · {c.detail}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr><th className="px-2 py-1.5">Onglet</th><th className="px-2 py-1.5">Lignes</th><th className="px-2 py-1.5">En-têtes de section</th><th className="px-2 py-1.5">KR</th><th className="px-2 py-1.5">Initiatives</th><th className="px-2 py-1.5">Jalons</th><th className="px-2 py-1.5">Remarques</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.sheets.map((s) => (
              <tr key={s.sheet} className={s.found ? '' : 'text-red-700'}>
                <td className="px-2 py-1.5 font-medium">{s.sheet}</td>
                <td className="px-2 py-1.5 tabular-nums">{s.rows}</td>
                <td className="px-2 py-1.5 tabular-nums">{s.sectionHeaders}</td>
                <td className="px-2 py-1.5 tabular-nums">{s.krs}</td>
                <td className="px-2 py-1.5 tabular-nums">{s.initiatives}</td>
                <td className="px-2 py-1.5 tabular-nums">{s.milestones}</td>
                <td className="px-2 py-1.5 text-xs text-slate-600">{s.found ? s.warnings.slice(0, 4).join(' · ') : 'Onglet absent'}{s.warnings.length > 4 ? ` (+${s.warnings.length - 4})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-600">
        Totaux : {r.totals.globalObjectives} objectifs, {r.totals.globalKrs} KR globaux, {r.totals.entityKrs} KR pays/équipes,
        {' '}{r.totals.initiatives} initiatives, {r.totals.milestones} jalons, {r.totals.contributions} liens.
      </p>
      {r.warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-800">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
    </div>
  );
}

function ImportSection() {
  const { ds, importDataset, store, reload, notify, setError } = useApp();
  const [pending, setPending] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setPending(await parseFile(f));
    } catch (e) {
      setError(`Lecture du fichier impossible : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await importDataset(pending.dataset);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };
  const demo = async () => {
    if (!confirm('Remplacer les statuts Q1 par des statuts FICTIFS de démonstration ?')) return;
    setBusy(true);
    try {
      const next = applyDemoQ1(ds);
      if (store.mode === 'local') await store.saveDataset(next);
      else for (const u of next.updates.filter((x) => x.id.startsWith('demo-'))) await store.checkIn(u);
      await reload();
      notify('Statuts Q1 fictifs appliqués.');
    } finally {
      setBusy(false);
    }
  };
  const backup = () => {
    const blob = new Blob([JSON.stringify(ds, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `okr-tracker-2027-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Dataset;
      if (data.version !== 1 || !Array.isArray(data.milestones)) throw new Error('format inattendu');
      await store.saveDataset(data);
      await reload();
      notify('Sauvegarde restaurée.');
    } catch (e) {
      setError(`Restauration impossible : ${(e as Error).message}`);
    }
  };

  return (
    <Card title="Import / réimport de l’Excel">
      <p className="mb-3 text-sm text-slate-600">
        Choisissez <em>2027 OKR Consolidated Plans_V2.xlsx</em>. Le fichier est lu dans le navigateur. Un réimport met à jour la structure
        et <b>conserve</b> les statuts, valeurs réelles, preuves, historique et pondérations déjà saisis.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
        {busy ? 'Lecture…' : 'Choisir le fichier Excel'}
        <input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {pending && (
        <div className="mt-4 space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
          <h3 className="text-sm font-semibold">Rapport d’import : {pending.report.fileName}</h3>
          <ReportView r={pending.report} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={apply} disabled={busy}>Appliquer l’import</Button>
            <Button onClick={() => setPending(null)}>Annuler</Button>
          </div>
        </div>
      )}
      {!pending && ds.lastImport && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Dernier import : {ds.lastImport.fileName} ({new Date(ds.lastImport.importedAt).toLocaleString('fr-FR')})</summary>
          <div className="mt-3"><ReportView r={ds.lastImport} /></div>
        </details>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button onClick={demo} disabled={!ds.milestones.length || busy}>Générer des statuts Q1 fictifs (démo)</Button>
        {store.mode === 'local' && (
          <>
            <Button onClick={backup} disabled={!ds.globalKrs.length}>Sauvegarde JSON</Button>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Restaurer une sauvegarde
              <input type="file" accept=".json" className="hidden" onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </>
        )}
      </div>
    </Card>
  );
}

function SettingsSection() {
  const { ds, updateSettings } = useApp();
  const [s, setS] = useState<Settings>(ds.settings);
  useEffect(() => setS(ds.settings), [ds.settings]);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const valid = s.rag.amber < s.rag.green && s.rag.green <= 100 && s.rag.amber >= 0 && s.weights.Lead >= 0 && s.weights.Contributes >= 0;
  return (
    <Card title="Pondérations et seuils RAG">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs font-medium text-slate-600">Poids Lead<input type="number" min={0} step={0.5} className={`${inputCls} mt-1`} value={s.weights.Lead} onChange={(e) => setS({ ...s, weights: { ...s.weights, Lead: num(e.target.value) } })} /></label>
        <label className="text-xs font-medium text-slate-600">Poids Contributes<input type="number" min={0} step={0.5} className={`${inputCls} mt-1`} value={s.weights.Contributes} onChange={(e) => setS({ ...s, weights: { ...s.weights, Contributes: num(e.target.value) } })} /></label>
        <label className="text-xs font-medium text-slate-600">Vert à partir de (%)<input type="number" min={0} max={100} className={`${inputCls} mt-1`} value={s.rag.green} onChange={(e) => setS({ ...s, rag: { ...s.rag, green: num(e.target.value) } })} /></label>
        <label className="text-xs font-medium text-slate-600">Ambre à partir de (%)<input type="number" min={0} max={100} className={`${inputCls} mt-1`} value={s.rag.amber} onChange={(e) => setS({ ...s, rag: { ...s.rag, amber: num(e.target.value) } })} /></label>
        <label className="text-xs font-medium text-slate-600">Score d’un jalon en retard (%)<input type="number" min={0} max={100} className={`${inputCls} mt-1`} value={s.lateScore} onChange={(e) => setS({ ...s, lateScore: num(e.target.value) })} /></label>
        <label className="text-xs font-medium text-slate-600">Trimestre courant
          <select className={`${inputCls} mt-1`} value={s.currentQuarter} onChange={(e) => setS({ ...s, currentQuarter: Number(e.target.value) as Quarter })}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">Rouge sous le seuil Ambre, ou dès qu’un jalon est en retard. Un jalon en retard reste compté avec le score ci-dessus.</p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" disabled={!valid} onClick={() => updateSettings(s)}>Enregistrer</Button>
        {!valid && <span className="text-xs text-red-700">Le seuil Ambre doit être inférieur au seuil Vert.</span>}
      </div>
    </Card>
  );
}

function WeightsSection() {
  const { ds, updateWeight } = useApp();
  const [g, setG] = useState(ds.globalKrs[0]?.id ?? '');
  const links = ds.contributions.filter((c) => c.globalKrId === g);
  return (
    <Card title="Poids par lien (KR global ↔ KR pays/équipe)">
      <select className={`${inputCls} mb-3 sm:w-96`} value={g} onChange={(e) => setG(e.target.value)}>
        {ds.globalKrs.map((k) => <option key={k.id} value={k.id}>{k.id} · {k.title.slice(0, 70)}</option>)}
      </select>
      <ul className="divide-y divide-slate-100">
        {links.map((c) => {
          const e = ds.entities.find((x) => x.id === c.entityId);
          const k = ds.entityKrs.find((x) => x.id === c.entityKrId);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <RoleBadge role={c.role} /><b>{e?.name}</b>
              <span className="min-w-0 flex-1 truncate text-slate-600" title={k?.title}>{k?.title}</span>
              <input type="number" min={0} step={0.5} className={`${inputCls} w-24`} aria-label="Poids"
                placeholder={String(ds.settings.weights[c.role])} value={c.weight ?? ''}
                onChange={(ev) => updateWeight(c.id, ev.target.value === '' ? null : Number(ev.target.value))} />
              <span className="w-28 text-xs text-slate-500">effectif : {contributionWeight(c, ds.settings)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Champ vide = poids par défaut du rôle.</p>
    </Card>
  );
}

function UserEditor({ u, onSave, onDelete }: { u: AppUser; onSave: (u: AppUser) => void; onDelete?: () => void }) {
  const { ds, store } = useApp();
  const [x, setX] = useState(u);
  useEffect(() => setX(u), [u]);
  const pool = ds.entities.filter((e) => (x.role === 'country_lead' ? e.type === 'Country' : x.role === 'team_lead' ? e.type === 'GlobalTeam' : false));
  return (
    <li className="space-y-2 py-3">
      <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto,auto]">
        <input className={inputCls} value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="Nom" />
        <input className={inputCls} value={x.email} disabled={store.mode === 'supabase'} onChange={(e) => setX({ ...x, email: e.target.value })} placeholder="E-mail" />
        <select className={inputCls} value={x.role} onChange={(e) => setX({ ...x, role: e.target.value as UserRole, entityIds: [] })}>
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <div className="flex gap-1">
          <Button variant="primary" onClick={() => onSave(x)}>OK</Button>
          {onDelete && <Button variant="danger" onClick={onDelete}>{store.mode === 'supabase' ? 'Retirer' : 'Suppr.'}</Button>}
        </div>
      </div>
      {pool.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="font-medium text-slate-600">Périmètre :</span>
          {pool.map((e) => (
            <label key={e.id} className="inline-flex items-center gap-1">
              <input type="checkbox" checked={x.entityIds.includes(e.id)}
                onChange={(ev) => setX({ ...x, entityIds: ev.target.checked ? [...x.entityIds, e.id] : x.entityIds.filter((i) => i !== e.id) })} />
              {e.name}
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

function UsersSection() {
  const { store, user, notify, refreshUser } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const load = async () => setUsers(await store.listUsers());
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (u: AppUser) => {
    await store.saveUser(u);
    await load();
    await refreshUser();
    notify('Utilisateur enregistré.');
  };
  return (
    <Card title="Utilisateurs et droits">
      <p className="mb-2 text-xs text-slate-500">
        Admin : tout · Lead pays : KR et initiatives de son pays · Lead équipe : activités de son équipe · Lecteur : consultation.
        {store.mode === 'supabase' && ' Les comptes se créent par la page de connexion (lien e-mail) ; attribuez ensuite le rôle ici.'}
      </p>
      <ul className="divide-y divide-slate-100">
        {users.map((u) => (
          <UserEditor key={u.id} u={u} onSave={save} onDelete={u.id === user?.id ? undefined : async () => { await store.deleteUser(u.id); await load(); }} />
        ))}
      </ul>
      {store.mode === 'local' && (
        <Button className="mt-2" onClick={() => save({ id: crypto.randomUUID(), name: 'Nouvel utilisateur', email: '', role: 'viewer', entityIds: [] })}>+ Ajouter un utilisateur</Button>
      )}
    </Card>
  );
}

function SessionSection() {
  const { store, user, refreshUser, reload, notify, setError } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => { if (store.mode === 'local') void store.listUsers().then(setUsers); }, [store, user]);

  if (store.mode === 'local') {
    return (
      <Card title="Utilisateur (mode local)">
        <p className="mb-2 text-xs text-slate-500">Mode local : pas d’authentification réelle. Choisissez un profil pour tester les droits. Configurez Supabase pour un usage partagé.</p>
        <select className={`${inputCls} sm:w-96`} value={user?.id ?? ''} onChange={async (e) => { await store.signIn(e.target.value); await refreshUser(); }}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
        </select>
      </Card>
    );
  }
  if (user) {
    return (
      <Card title="Session">
        <p className="text-sm">Connecté : <b>{user.email}</b> · {ROLE_LABEL[user.role]}</p>
        <Button className="mt-2" onClick={async () => { await store.signOut(); await reload(); }}>Se déconnecter</Button>
      </Card>
    );
  }
  return (
    <Card title="Connexion">
      <form className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]" onSubmit={async (e) => {
        e.preventDefault();
        try {
          const msg = await store.signIn(email, password || undefined);
          if (msg) notify(msg);
          await reload();
        } catch (err) { setError((err as Error).message); }
      }}>
        <input type="email" required className={inputCls} placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className={inputCls} placeholder="Mot de passe (vide = lien par e-mail)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary">Se connecter</Button>
      </form>
    </Card>
  );
}

export default function Admin() {
  const { user, ds } = useApp();
  const admin = isAdmin(user);
  return (
    <div className="space-y-5">
      <PageHeader title="Administration" subtitle="Import de l’Excel, utilisateurs, pondérations et seuils RAG." />
      <SessionSection />
      {admin ? (
        <>
          <ImportSection />
          {ds.globalKrs.length > 0 && <SettingsSection />}
          {ds.contributions.length > 0 && <WeightsSection />}
          <UsersSection />
        </>
      ) : <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Ces réglages sont réservés à l’administrateur (équipe Strategy/PMO).</p>}
    </div>
  );
}
