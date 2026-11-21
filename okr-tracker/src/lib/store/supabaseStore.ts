/**
 * Mode Supabase : Postgres + Auth + Row Level Security (supabase/migrations/001_schema.sql).
 * La RLS fait foi pour les droits ; l'interface ne fait que masquer ce qui n'est pas autorisé.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_SETTINGS, emptyDataset, type Contribution, type Dataset, type Entity, type EntityKR,
  type Initiative, type Milestone, type MilestoneUpdate,
} from '../../types';
import type { Store } from './types';

type Row = Record<string, any>;

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toRow = (o: object): Row => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v ?? null]));
const fromRow = <T>(r: Row): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v])) as T;

/** Lecture paginée (Supabase renvoie 1000 lignes maximum par requête). */
async function fetchAll(sb: SupabaseClient, table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const check = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

/** Format attendu par la fonction SQL import_dataset() (colonnes en snake_case). */
export function toImportPayload(ds: Dataset) {
  return {
    entities: ds.entities.map((e) => toRow({ group: null, sheet: null, ...e })),
    global_objectives: ds.globalObjectives.map(toRow),
    global_krs: ds.globalKrs.map(toRow),
    entity_objectives: ds.entityObjectives.map(toRow),
    entity_krs: ds.entityKrs.map((k) => toRow({ registerOnly: false, teamUnit: null, ...k })),
    contributions: ds.contributions.map((c) => toRow({ inferred: false, ...c })),
    initiatives: ds.initiatives.map((i) => toRow({ teamUnit: null, ...i })),
    milestones: ds.milestones.map(toRow),
    annex_tables: ds.annexes.map(toRow),
    report: ds.lastImport,
  };
}

export function createSupabaseStore(url: string, anonKey: string): Store {
  const sb = createClient(url, anonKey);
  return {
    mode: 'supabase',
    async load() {
      const ds = emptyDataset();
      const [ent, go, gk, eo, ek, co, ini, ms, up, an, st] = await Promise.all(
        ['entities', 'global_objectives', 'global_krs', 'entity_objectives', 'entity_krs', 'contributions',
          'initiatives', 'milestones', 'milestone_updates', 'annex_tables', 'settings'].map((t) => fetchAll(sb, t)),
      );
      ds.entities = ent.map((r) => fromRow<Entity>(r));
      ds.globalObjectives = go.map((r) => fromRow(r));
      ds.globalKrs = gk.map((r) => fromRow(r));
      ds.entityObjectives = eo.map((r) => fromRow(r));
      ds.entityKrs = ek.map((r) => fromRow<EntityKR>(r));
      ds.contributions = co.map((r) => ({ ...fromRow<Contribution>(r), weight: r.weight === null ? null : Number(r.weight) }));
      ds.initiatives = ini.map((r) => fromRow<Initiative>(r));
      ds.milestones = ms.map((r) => fromRow<Milestone>(r));
      ds.updates = up.map((r) => ({ ...fromRow<MilestoneUpdate>(r), at: r.created_at, by: r.author }));
      ds.annexes = an.map((r) => fromRow(r));
      const s = st[0];
      if (s) {
        ds.settings = {
          weights: { Lead: Number(s.weight_lead), Contributes: Number(s.weight_contrib) },
          rag: { green: Number(s.rag_green), amber: Number(s.rag_amber) },
          lateScore: Number(s.late_score),
          currentQuarter: s.current_quarter,
        };
        ds.lastImport = s.last_import;
      } else ds.settings = DEFAULT_SETTINGS;
      return ds;
    },
    async saveDataset(ds: Dataset) {
      check(await sb.rpc('import_dataset', { payload: toImportPayload(ds) }));
    },
    async checkIn(u) {
      // le trigger apply_milestone_update recopie l'état dans milestones
      check(await sb.from('milestone_updates').insert({
        milestone_id: u.milestoneId, status: u.status, actual_value: u.actualValue, evidence_url: u.evidenceUrl,
        comment: u.comment, created_at: u.at, author: u.by,
      }));
    },
    async updateSettings(s) {
      check(await sb.from('settings').update({
        weight_lead: s.weights.Lead, weight_contrib: s.weights.Contributes, rag_green: s.rag.green,
        rag_amber: s.rag.amber, late_score: s.lateScore, current_quarter: s.currentQuarter,
      }).eq('id', 1));
    },
    async updateContributionWeight(id, weight) {
      check(await sb.from('contributions').update({ weight }).eq('id', id));
    },
    async updateInitiative(id, patch) {
      check(await sb.from('initiatives').update(toRow(patch)).eq('id', id));
    },
    async currentUser() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      const { data: ue } = await sb.from('user_entities').select('entity_id').eq('user_id', data.user.id);
      return {
        id: data.user.id, email: data.user.email ?? '', name: p?.name ?? '', role: p?.role ?? 'viewer',
        entityIds: (ue ?? []).map((r) => r.entity_id),
      };
    },
    async signIn(email, password) {
      if (password) {
        check(await sb.auth.signInWithPassword({ email, password }));
        return null;
      }
      check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } }));
      return `Un lien de connexion a été envoyé à ${email}.`;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async listUsers() {
      const [profiles, links] = await Promise.all([fetchAll(sb, 'profiles'), fetchAll(sb, 'user_entities')]);
      return profiles.map((p) => ({
        id: p.id, email: p.email, name: p.name, role: p.role,
        entityIds: links.filter((l) => l.user_id === p.id).map((l) => l.entity_id),
      }));
    },
    async saveUser(u) {
      // les comptes sont créés par inscription (lien magique) ; l'admin attribue rôle et périmètre
      check(await sb.from('profiles').update({ name: u.name, role: u.role }).eq('id', u.id));
      check(await sb.from('user_entities').delete().eq('user_id', u.id));
      if (u.entityIds.length) check(await sb.from('user_entities').insert(u.entityIds.map((e) => ({ user_id: u.id, entity_id: e }))));
    },
    async deleteUser(id) {
      // retire les droits ; la suppression du compte Auth se fait dans le tableau de bord Supabase
      check(await sb.from('user_entities').delete().eq('user_id', id));
      check(await sb.from('profiles').update({ role: 'viewer' }).eq('id', id));
    },
  };
}
