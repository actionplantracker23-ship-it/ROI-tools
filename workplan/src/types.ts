/**
 * Modèle de données de l'outil de gestion du plan de travail.
 *
 * Workspace
 *  ├─ Unit (départements globaux et pays, partagés entre les années)
 *  └─ Plan (un par année : 2027, 2028… ; un nouveau plan peut reprendre la structure du précédent)
 *      └─ Objective (Objective 1…)
 *          └─ KeyResult (KR1.1…)                            ← KR global
 *              ├─ Commitment (registre OKR) : unité, rôle Lead | Contributes, KR de l'unité, KR Lead, scope
 *              └─ Activity niveau « global » (département)
 *                  └─ Activity niveau « pays », liée par parentId
 *      Activity pays sans parentId = ORPHELINE (non liée au plan global)
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
export type IndicatorKind = 'number' | 'percent' | 'yesno';
export type TargetType = 'objective' | 'kr' | 'activity';
export type Rag = 'green' | 'amber' | 'red' | 'none';
/** Qualité du lien pays → global (renseignée par l'analyse d'alignement ou à la main). */
export type AlignmentQuality = 'full' | 'partial';

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
}

/** Ligne du registre OKR : engagement d'une unité sur un KR global. */
export interface Commitment {
  id: string;
  planId: string;
  krId: string;
  unitId: string;
  role: Role;
  unitObjective: string;
  unitKr: string;
  krLead: string;
  scope: string;
  planRef: string; // « Go to plan »
}

export interface Activity {
  id: string;
  planId: string;
  level: Level;
  unitId: string; // département (global) ou pays
  krId: string | null; // KR global ; pour une activité pays, hérité de l'activité globale si vide
  parentId: string | null; // activité pays → activité globale ; null = orpheline
  alignment: AlignmentQuality | null;
  code: string;
  title: string;
  owner: string;
  startQ: Quarter;
  endQ: Quarter;
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
  commitments: Commitment[];
  activities: Activity[];
  activityUpdates: ActivityUpdate[];
  indicators: Indicator[];
  indicatorValues: IndicatorValue[];
  settings: Settings;
}

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  not_started: 'Non démarrée',
  in_progress: 'En cours',
  done: 'Réalisée',
  late: 'En retard',
  cancelled: 'Annulée',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = { draft: 'Brouillon', active: 'En cours', closed: 'Clôturé' };
export const KIND_LABEL: Record<IndicatorKind, string> = { number: 'Nombre', percent: 'Pourcentage', yesno: 'Oui / Non' };
export const OBJECTIVE_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0891b2', '#4f46e5'];

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
    commitments: [],
    activities: [],
    activityUpdates: [],
    indicators: [],
    indicatorValues: [],
    settings: { rag: { green: 70, amber: 40 }, currentQuarter: 1, userName: '' },
  };
}
