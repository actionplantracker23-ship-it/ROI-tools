/**
 * Modèle de données de l'outil de gestion du plan de travail.
 *
 * Workspace
 *  ├─ Unit (départements globaux et pays, partagés entre les années)
 *  └─ Plan (un par année : 2027, 2028… ; un nouveau plan peut reprendre la structure du précédent)
 *      └─ Objective (Objective 1…)
 *          └─ KeyResult (KR1.1… ; ou groupe « Team KR · O1 » pour les KR d'équipe sans KR global)
 *              ├─ Activity niveau « global » : KR d'une équipe globale (PEI, PSE, DHGP, GSE, Finance…)
 *              └─ Activity niveau « pays » : KR d'un pays, liée à 0..n activités globales (parentIds)
 *      Une ligne du registre OKR = une activité (rôle Lead / Contributes, objectif d'équipe, KR Lead, scope).
 *      Activité pays sans lien = ORPHELINE (non soutenue par le plan global).
 *      Indicator : attaché à un objectif, un KR, une activité globale ou une activité pays
 *          └─ IndicatorValue (par trimestre, historique)
 *      ActivityUpdate : historique des mises à jour d'activité
 */

export type UnitType = 'department' | 'country';
export type Level = 'global' | 'country';
export type Role = 'Lead' | 'Contributes';
export type Quarter = 1 | 2 | 3 | 4;
export type PlanStatus = 'draft' | 'active' | 'closed';
export type ActivityStatus = 'not_started' | 'in_progress' | 'done' | 'late' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';
export type IssueKind = 'risk' | 'issue';
export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IndicatorKind = 'number' | 'percent' | 'yesno';
export type TargetType = 'objective' | 'kr' | 'activity';
export type Rag = 'green' | 'amber' | 'red' | 'none';
/** Statuts de l'analyse d'alignement (feuille « alignement du OKR »). */
export type AlignStatus = 'aligned' | 'partial' | 'conflict' | 'gap' | 'global_only';

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  group?: string; // ex. « Global Programs »
  order: number;
}

export interface Plan {
  id: string;
  year: number;
  name: string;
  status: PlanStatus;
  createdAt: string;
  sourcePlanId: string | null; // plan de l'année précédente dont la structure a été reprise
  notes: string;
}

export interface Objective {
  id: string;
  planId: string;
  code: string; // « 1 »
  title: string;
  color: string;
  order: number;
}

export interface KeyResult {
  id: string;
  planId: string;
  objectiveId: string;
  code: string; // « KR1.1 »
  title: string;
  order: number;
  /** Groupe de KR d'équipe sans KR global (« Team KR · O1 »). */
  team?: boolean;
}

export interface Activity {
  id: string;
  planId: string;
  level: Level;
  unitId: string; // département (global) ou pays
  krId: string | null; // KR global (Ref)
  parentIds: string[]; // activité pays → activités globales qui la soutiennent ; [] = orpheline
  alignment: AlignStatus | null; // statut de l'analyse d'alignement
  finding: string; // « Finding / gap »
  action: string; // « Recommended action »
  role: Role | null; // registre : Lead / Contributes (null = KR d'équipe)
  unitObjective: string; // registre : Country/Team Objective
  subTeam: string; // ex. « Finance & Admin » pour « Kenya (Finance & Admin) »
  scope: string; // registre : Scope
  code: string;
  title: string; // Country/Team Key Result
  owner: string; // KR Lead
  startQ: Quarter;
  endQ: Quarter;
  /** Gestion de projet : début et échéance (AAAA-MM-JJ), jalon, priorité. Les trimestres en sont déduits. */
  startDate: string;
  dueDate: string;
  milestone: boolean;
  priority: Priority;
  status: ActivityStatus;
  progress: number; // 0–100, avancement d'exécution
  budget: number | null;
  comment: string;
  order: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ActivityUpdate {
  id: string;
  activityId: string;
  status: ActivityStatus;
  progress: number;
  comment: string;
  at: string;
  by: string;
}

export interface Indicator {
  id: string;
  planId: string;
  targetType: TargetType;
  targetId: string;
  name: string;
  kind: IndicatorKind;
  unit: string;
  baseline: number | null;
  quarterTargets: (number | null)[]; // Q1..Q4
  target: number | null; // cible de fin d'année
  source: string; // source de vérification
  order: number;
}

export interface IndicatorValue {
  id: string;
  indicatorId: string;
  quarter: Quarter;
  value: number | null;
  comment: string;
  evidenceUrl: string;
  at: string;
  by: string;
}

/** Registre des risques et actions (alimenté par l'analyse d'alignement, ou saisi). */
export interface Issue {
  id: string;
  planId: string;
  activityId: string | null; // tâche concernée
  kind: IssueKind;
  title: string; // constat
  action: string; // action recommandée
  owner: string;
  dueDate: string;
  status: IssueStatus;
  source: string; // ex. « Analyse d'alignement · Gap »
  createdAt: string;
}

export interface Settings {
  rag: { green: number; amber: number };
  currentQuarter: Quarter;
  userName: string;
}

export interface Workspace {
  version: 2;
  units: Unit[];
  plans: Plan[];
  currentPlanId: string | null;
  objectives: Objective[];
  krs: KeyResult[];
  activities: Activity[];
  activityUpdates: ActivityUpdate[];
  indicators: Indicator[];
  indicatorValues: IndicatorValue[];
  issues: Issue[];
  settings: Settings;
}

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  not_started: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  late: 'En retard',
  cancelled: 'Annulé',
};
export const PRIORITY_LABEL: Record<Priority, string> = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { open: 'Ouvert', in_progress: 'En traitement', closed: 'Clos' };
export const ISSUE_KIND_LABEL: Record<IssueKind, string> = { risk: 'Risque', issue: 'Problème' };

export const ALIGN_LABEL: Record<AlignStatus, string> = {
  aligned: 'Aligned', partial: 'Partial', conflict: 'Conflict', gap: 'Gap', global_only: 'Global only',
};
export const ALIGN_HELP: Record<AlignStatus, string> = {
  aligned: 'Soutenu par le plan global et cohérent',
  partial: 'Soutien partiel ou formulation à préciser',
  conflict: 'Incohérence (dates, seuils, unités, étiquette)',
  gap: 'Lien manquant ou insuffisant',
  global_only: 'KR d’équipe globale sans déclinaison pays (normal)',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = { draft: 'Brouillon', active: 'En cours', closed: 'Clôturé' };
export const KIND_LABEL: Record<IndicatorKind, string> = { number: 'Nombre', percent: 'Pourcentage', yesno: 'Oui / Non' };
/** Couleurs des objectifs : palette Living Goods (bleu, orange, bleu ciel, gris…). */
export const OBJECTIVE_COLORS = ['#004D84', '#F7941D', '#4FB3E3', '#6D6E71', '#2F80C0', '#C9700F'];

/** Unités de départ (modifiables dans Paramètres). */
export const DEFAULT_UNITS: Omit<Unit, 'order'>[] = [
  { id: 'gse', name: 'GSE', type: 'department' },
  { id: 'dhgp', name: 'DHGP', type: 'department' },
  { id: 'innovations', name: 'Innovations', type: 'department', group: 'Global Programs' },
  { id: 'pei', name: 'PEI', type: 'department', group: 'Global Programs' },
  { id: 'pse', name: 'PSE', type: 'department', group: 'Global Programs' },
  { id: 'bdac', name: 'BDAC', type: 'department' },
  { id: 'finance', name: 'Finance', type: 'department' },
  { id: 'dt', name: 'DT', type: 'department' },
  { id: 'pc', name: 'P&C', type: 'department' },
  { id: 'kenya', name: 'Kenya', type: 'country' },
  { id: 'burkina-faso', name: 'Burkina Faso', type: 'country' },
  { id: 'uganda', name: 'Uganda', type: 'country' },
  { id: 'benin', name: 'Benin', type: 'country' },
  { id: 'zambia', name: 'Zambia', type: 'country' },
];

export function emptyWorkspace(): Workspace {
  return {
    version: 2,
    units: DEFAULT_UNITS.map((u, order) => ({ ...u, order })),
    plans: [],
    currentPlanId: null,
    objectives: [],
    krs: [],
    activities: [],
    activityUpdates: [],
    indicators: [],
    indicatorValues: [],
    issues: [],
    settings: { rag: { green: 70, amber: 40 }, currentQuarter: 1, userName: '' },
  };
}
