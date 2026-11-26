/**
 * Import Excel : 1) choisir le fichier ; 2) rôle de chaque feuille (registre OKR / analyse d'alignement) ;
 * 3) correspondance des colonnes (proposée automatiquement, modifiable, avec exemples) ;
 * 4) aperçu du résultat (activités, liens, orphelines) ; 5) appliquer au plan choisi.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useApp } from '../AppContext';
import { Button, Card, Field, inputCls, PageHeader, Stat } from '../components/ui';
import { ALIGN_FIELDS, countryColumns, guessMapping, readWorkbook, REGISTER_FIELDS, runImport, type Field as F, type Mapping, type SheetInfo } from '../lib/importer';
import { createPlan } from '../lib/ops';

type RoleKind = 'register' | 'alignment' | 'ignore';
const colName = (i: number) => XLSX.utils.encode_col(i);

function MappingTable({ sheet, fields, mapping, onChange }: { sheet: SheetInfo; fields: F[]; mapping: Mapping; onChange: (m: Mapping) => void }) {
  const sample = (col: number) => {
    const out: string[] = [];
    for (let r = sheet.headerRow + 1; r < sheet.grid.length && out.length < 3; r++) {
      const v = sheet.grid[r][col];
      if (v && !/^\s*OBJECTIVE\s*\d/i.test(sheet.grid[r].find(Boolean) ?? '')) out.push(v);
    }
    return out;
  };
  return (
    <div className="overflow-x-auto">
      <table className="suivi min-w-[720px]">
        <thead><tr><th className="w-56">Champ de l’outil</th><th className="w-72">Colonne du fichier</th><th>Exemples de valeurs</th></tr></thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id}>
              <td><b>{f.label}</b>{f.required && <span className="text-rag-red"> *</span>}{f.hint && <div className="text-xs text-slate-500">{f.hint}</div>}</td>
              <td>
                <select className={`${inputCls} ${f.required && mapping[f.id] < 0 ? '!border-rag-red' : ''}`} value={mapping[f.id]} onChange={(e) => onChange({ ...mapping, [f.id]: Number(e.target.value) })} aria-label={f.label}>
                  <option value={-1}>— non utilisé —</option>
                  {sheet.headers.map((h, i) => <option key={i} value={i}>{colName(i)} · {h || '(sans titre)'}</option>)}
                </select>
              </td>
              <td className="text-xs text-slate-600">{mapping[f.id] >= 0 ? sample(mapping[f.id]).map((s, i) => <div key={i} className="truncate" title={s}>{s}</div>) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Import() {
  const { ws, plan, update, setError } = useApp();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [roles, setRoles] = useState<Record<string, RoleKind>>({});
  const [maps, setMaps] = useState<Record<string, Mapping>>({});
  const [wide, setWide] = useState(false);
  const [cols, setCols] = useState<{ col: number; unitId: string }[]>([]);
  const [replace, setReplace] = useState(true);
  const [continuation, setContinuation] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear() + 1);
  const [done, setDone] = useState(false);

  const reg = sheets.find((s) => roles[s.name] === 'register');
  const ali = sheets.find((s) => roles[s.name] === 'alignment');

  const setAlignmentSheet = (s: SheetInfo | undefined) => {
    if (!s) return;
    const cc = countryColumns(s.headers, ws.units);
    const m = guessMapping(s.headers, ALIGN_FIELDS);
    // format large : au moins deux colonnes portent un nom de pays et aucune colonne « activité pays »
    const isWide = cc.length >= 2 && m.countryActivity < 0;
    setWide(isWide);
    setCols(cc.map((c) => ({ col: c.col, unitId: c.unit!.id })));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const s = readWorkbook(wb);
      setFileName(file.name);
      setSheets(s);
      const r: Record<string, RoleKind> = {};
      let hasReg = false;
      let hasAli = false;
      for (const x of s) {
        if (x.guess === 'register' && !hasReg) { r[x.name] = 'register'; hasReg = true; }
        else if (x.guess === 'alignment' && !hasAli) { r[x.name] = 'alignment'; hasAli = true; }
        else r[x.name] = 'ignore';
      }
      setRoles(r);
      setMaps(Object.fromEntries(s.map((x) => [x.name, guessMapping(x.headers, r[x.name] === 'alignment' ? ALIGN_FIELDS : REGISTER_FIELDS)])));
      setAlignmentSheet(s.find((x) => r[x.name] === 'alignment'));
      setDone(false);
    } catch (e) { setError(`Lecture du fichier impossible : ${(e as Error).message}`); }
  };

  const setRole = (name: string, role: RoleKind) => {
    const next = { ...roles };
    for (const k of Object.keys(next)) if (role !== 'ignore' && next[k] === role) next[k] = 'ignore'; // une feuille par rôle
    next[name] = role;
    setRoles(next);
    const s = sheets.find((x) => x.name === name)!;
    setMaps({ ...maps, [name]: guessMapping(s.headers, role === 'alignment' ? ALIGN_FIELDS : REGISTER_FIELDS) });
    if (role === 'alignment') setAlignmentSheet(s);
  };
  const setHeaderRow = (name: string, row: number) => {
    const s = sheets.map((x) => (x.name === name ? { ...x, headerRow: row, headers: x.grid[row] ?? [] } : x));
    setSheets(s);
    const sh = s.find((x) => x.name === name)!;
    setMaps({ ...maps, [name]: guessMapping(sh.headers, roles[name] === 'alignment' ? ALIGN_FIELDS : REGISTER_FIELDS) });
    if (roles[name] === 'alignment') setAlignmentSheet(sh);
  };

  const missing = [
    ...(reg ? REGISTER_FIELDS.filter((f) => f.required && maps[reg.name]?.[f.id] < 0).map((f) => `${reg.name} : ${f.label}`) : []),
    ...(ali ? ALIGN_FIELDS.filter((f) => f.required && maps[ali.name]?.[f.id] < 0).map((f) => `${ali.name} : ${f.label}`) : []),
    ...(ali && wide && !cols.length ? ['Format large : aucune colonne pays sélectionnée'] : []),
  ];

  // aperçu : import à blanc sur une copie
  const preview = useMemo(() => {
    if ((!reg && !ali) || missing.length) return null;
    try {
      const base = plan ? { ws, planId: plan.id } : createPlan(ws, { year });
      return runImport(base.ws, {
        planId: base.planId, replace,
        register: reg ? { sheet: reg, mapping: maps[reg.name] } : undefined,
        alignment: ali ? { sheet: ali, mapping: maps[ali.name], wide, countryCols: cols, continuation } : undefined,
      }).report;
    } catch (e) { return { error: (e as Error).message } as never; }
  }, [reg, ali, maps, wide, cols, replace, continuation, ws, plan, year, missing.length]);

  const apply = () => {
    update((w) => {
      const base = plan ? { ws: w, planId: plan.id } : createPlan(w, { year });
      return runImport(base.ws, {
        planId: base.planId, replace,
        register: reg ? { sheet: reg, mapping: maps[reg.name] } : undefined,
        alignment: ali ? { sheet: ali, mapping: maps[ali.name], wide, countryCols: cols, continuation } : undefined,
      }).ws;
    }, 'Import terminé.');
    setDone(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={plan ? `Import dans : ${plan.name}` : 'Import'} title="Import du fichier Excel"
        subtitle="Deux feuilles : le registre OKR (objectifs, KR globaux, engagements des départements et pays) et l’analyse d’alignement (activités globales ↔ activités pays). Les colonnes sont reconnues automatiquement ; vérifiez la correspondance avant d’appliquer." />

      <Card title="1. Fichier">
        <label className="inline-flex min-h-[40px] cursor-pointer items-center rounded-md bg-brand-600 px-3.5 text-[15px] text-white hover:bg-brand-700">
          Choisir le fichier Excel<input type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {fileName && <span className="ml-3 text-sm text-slate-600">{fileName} · {sheets.length} feuille(s)</span>}
        <p className="mt-2 text-xs text-slate-500">Le fichier est lu dans ce navigateur ; rien n’est envoyé sur internet.</p>
      </Card>

      {sheets.length > 0 && (
        <Card title="2. Rôle des feuilles">
          <div className="overflow-x-auto">
            <table className="suivi min-w-[640px]">
              <thead><tr><th>Feuille</th><th>Rôle</th><th>Ligne d’en-tête</th><th>Lignes</th></tr></thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={s.name}>
                    <td className="font-semibold">{s.name}</td>
                    <td>
                      <select className={inputCls} value={roles[s.name]} onChange={(e) => setRole(s.name, e.target.value as RoleKind)} aria-label={`Rôle de ${s.name}`}>
                        <option value="register">Registre OKR</option><option value="alignment">Analyse d’alignement (activités)</option><option value="ignore">Ignorer</option>
                      </select>
                    </td>
                    <td>
                      <select className={inputCls} value={s.headerRow} onChange={(e) => setHeaderRow(s.name, Number(e.target.value))} aria-label="Ligne d'en-tête">
                        {s.grid.slice(0, 30).map((r, i) => <option key={i} value={i}>Ligne {i + 1} : {r.filter(Boolean).slice(0, 4).join(' | ').slice(0, 70)}</option>)}
                      </select>
                    </td>
                    <td className="text-slate-600">{Math.max(0, s.grid.length - s.headerRow - 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {reg && <Card title={`3a. Colonnes du registre OKR · « ${reg.name} »`}><MappingTable sheet={reg} fields={REGISTER_FIELDS} mapping={maps[reg.name]} onChange={(m) => setMaps({ ...maps, [reg.name]: m })} /></Card>}

      {ali && (
        <Card title={`3b. Colonnes de l’analyse d’alignement · « ${ali.name} »`}>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={!wide} onChange={() => setWide(false)} /> Une ligne par lien (colonnes Pays et Activité pays)</label>
            <label className="inline-flex items-center gap-1.5"><input type="radio" checked={wide} onChange={() => setWide(true)} /> Une colonne par pays (la cellule contient l’activité pays)</label>
          </div>
          {wide && (
            <div className="mb-3 rounded-md bg-[#f5f8fb] p-3 text-sm">
              <div className="mb-1 font-semibold text-brand-500">Colonnes pays</div>
              <div className="flex flex-wrap gap-3">
                {ali.headers.map((h, i) => {
                  const on = cols.find((c) => c.col === i);
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={!!on} onChange={(e) => setCols(e.target.checked ? [...cols, { col: i, unitId: ws.units.find((u) => u.type === 'country')?.id ?? '' }] : cols.filter((c) => c.col !== i))} aria-label={`Colonne ${h}`} />
                      {colName(i)} · {h || '(sans titre)'}
                      {on && <select className="rounded border border-[#c9ced4] px-1 text-xs" value={on.unitId} onChange={(e) => setCols(cols.map((c) => (c.col === i ? { ...c, unitId: e.target.value } : c)))} aria-label="Pays">
                        {ws.units.filter((u) => u.type === 'country').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <MappingTable sheet={ali} fields={wide ? ALIGN_FIELDS.filter((f) => !['country', 'countryActivity'].includes(f.id)) : ALIGN_FIELDS} mapping={maps[ali.name]} onChange={(m) => setMaps({ ...maps, [ali.name]: m })} />
          {!wide && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={continuation} onChange={(e) => setContinuation(e.target.checked)} />
              <span>Lignes de suite : une cellule « Activité globale » vide reprend l’activité du dessus quand <b>Ref</b> et <b>Département</b> sont vides aussi et que la ligne n’est pas marquée « non aligné ». Décochez si, dans votre fichier, une activité globale vide signifie toujours « orpheline ».</span>
            </label>
          )}
          <p className="mt-2 text-xs text-slate-500">Une activité pays est <b>orpheline</b> si sa ligne n’a pas d’activité globale (hors ligne de suite), ou si le statut d’alignement indique « non aligné / orphelin ». Les cellules fusionnées sont prises en compte.</p>
        </Card>
      )}

      {(reg || ali) && (
        <Card title="4. Aperçu et application">
          {!plan && (
            <div className="mb-3 flex items-end gap-3">
              <Field label="Aucun plan ouvert : créer le plan de l’année"><input type="number" className={`${inputCls} w-32`} value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
            </div>
          )}
          {plan && <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Remplacer le contenu actuel de « {plan.name} » (sinon : ajout sans doublon)</label>}
          {missing.length > 0 && <p className="mb-3 text-sm text-rag-red">Champs obligatoires non reliés : {missing.join(' · ')}</p>}
          {preview && !('error' in preview) && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <Stat label="Objectifs" value={preview.objectives} /><Stat label="KR globaux" value={preview.krs} /><Stat label="Registre" value={preview.commitments} />
                <Stat label="Act. globales" value={preview.globalActivities} color="#5bc0eb" /><Stat label="Act. pays" value={preview.countryActivities} color="#f28c28" />
                <Stat label="Liées" value={preview.aligned} hint={`dont ${preview.partial} partielles`} color="#2e9e4f" />
                <Stat label="Orphelines" value={<span className={preview.orphans ? 'text-rag-red' : ''}>{preview.orphans}</span>} color="#d64545" />
                <Stat label="Indicateurs" value={preview.indicators} />
              </div>
              {preview.unitsCreated.length > 0 && <p className="mt-3 text-sm text-[#9a4a00]">Unités inconnues créées : {preview.unitsCreated.join(', ')}. Vérifiez-les ensuite dans Paramètres.</p>}
              {preview.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[#9a4a00]">{preview.warnings.slice(0, 15).map((w) => <li key={w}>{w}</li>)}</ul>}
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" disabled={!preview || missing.length > 0 || done} onClick={apply}>{plan ? `Appliquer à ${plan.name}` : `Créer le plan ${year} et importer`}</Button>
            {done && <><span className="self-center text-sm font-semibold text-rag-green">Import appliqué.</span><Button onClick={() => navigate('/alignement')}>Voir l’alignement</Button><Button onClick={() => navigate('/plan')}>Voir le plan</Button></>}
          </div>
        </Card>
      )}
    </div>
  );
}
