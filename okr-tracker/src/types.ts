/**
 * Modèle de données de l'OKR Tracker 2027.
 *
 * GlobalObjective (4)
 *  └─ GlobalKR (20)
 *      └─ Contribution (lien) : { entity, role: Lead | Contributes, weight }
 *          └─ EntityKR (KR pays ou équipe, ~100)
 *              ├─ EntityObjective (objectif propre au pays / à l'équipe)
 *              └─ Initiative (1..n)
 *                  └─ Milestone (Q1..Q4) + historique des check-ins
 *
 * Les identifiants sont stables (dérivés du contenu) : un réimport de l'Excel
 * retrouve les mêmes jalons et conserve les statuts déjà saisis.
 * Ces types reflètent une à une les tables de supabase/migrations/001_schema.sql.
 */

export type EntityType = 'Country' | 'GlobalTeam';
export type Role = 'Lead' | 'Contributes';
export type Scope = 'Pays' | 'Global';
export type MetricType = 'Numeric' | 'Percentage' | 'Yes/No' | 'Date' | 'Other';
export type Quarter = 1 | 2 | 3 | 4;
export type MilestoneStatus = 'not_started' | 'in_progress' | 'achieved' | 'late' | 'cancelled';
export type Rag = 'green' | 'amber' | 'red' | 'none';
export type UserRole = 'admin' | 'country_lead' | 'team_lead' | 'viewer';

export interface Entity {
  id: string; // slug stable : "kenya", "gp-pei", "gse"…
  name: string; // "Kenya", "PEI"…
  type: EntityType;
  /** Regroupement d'origine : "Global Programs" pour Innovations / PEI / PSE. */
  group?: string;
  /** Onglet Excel d'origine. */
  sheet?: string;
}

export interface GlobalObjective {
  id: string; // "O1"
  code: string; // "Objective 1"
  title: string;
  color: string; // code couleur de l'objectif
}

export interface GlobalKR {
  id: string; // "KR1.1"
  objectiveId: string;
  title: string;
}

export interface EntityObjective {
  id: string;
  entityId: string;
  title: string;
}

export interface EntityKR {
  id: string;
  entityId: string;
  objectiveId: string | null; // EntityObjective
  title: string;
  lead: string;
  /** Unité / sous-équipe telle qu'écrite dans la colonne Team/Unit. */
  teamUnit?: string;
  /** true si le KR n'existe que dans le registre (aucune ligne dans l'onglet de plan). */
  registerOnly?: boolean;
}

export interface Contribution {
  id: string;
  globalKrId: string;
  entityKrId: string;
  entityId: string;
  role: Role;
  /** Poids dans la consolidation ; null = poids par défaut du rôle (Lead 2, Contributes 1). */
  weight: number | null;
  scope: Scope;
  /** true si le lien vient uniquement de la colonne Ref d'un onglet (absent du registre). */
  inferred?: boolean;
}

export interface Initiative {
  id: string;
  entityKrId: string;
  entityId: string;
  title: string;
  lead: string;
  teamUnit?: string;
  baseline: string; // texte brut de "Current Baseline"
  baselineValue: number | null; // valeur numérique extraite si possible
  target: number | null; // cible numérique (extraite du jalon Q4, modifiable)
  metric: MetricType;
  evidenceRule: string;
  budget: string; // texte brut de "Indicative Budget"
  budgetValue: number | null;
  /** Pays visés (initiatives des équipes globales). */
  targetCountryIds: string[];
  order: number;
}

export interface Milestone {
  id: string; // `${initiativeId}-q${quarter}`
  initiativeId: string;
  entityId: string;
  quarter: Quarter;
  description: string;
  status: MilestoneStatus;
  actualValue: number | null;
  evidenceUrl: string;
  comment: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Historique des check-ins (insertion seule). */
export interface MilestoneUpdate {
  id: string;
  milestoneId: string;
  status: MilestoneStatus;
  actualValue: number | null;
  evidenceUrl: string;
  comment: string;
  at: string;
  by: string;
}

export interface AnnexTable {
  id: string;
  sheet: string;
  rows: string[][];
}

export interface Settings {
  weights: Record<Role, number>;
  rag: { green: number; amber: number };
  /** Score d'un jalon « En retard » dans la moyenne (0 par défaut, le jalon est aussi signalé). */
  lateScore: number;
  currentQuarter: Quarter;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Entités que l'utilisateur peut modifier (Lead pays / équipe). */
  entityIds: string[];
}

export interface SheetReport {
  sheet: string;
  found: boolean;
  rows: number;
  sectionHeaders: number;
  krs: number;
  initiatives: number;
  milestones: number;
  warnings: string[];
}

export interface ImportReport {
  fileName: string;
  importedAt: string;
  sheets: SheetReport[];
  totals: {
    globalObjectives: number;
    globalKrs: number;
    entityKrs: number;
    initiatives: number;
    milestones: number;
    contributions: number;
  };
  checks: { label: string; ok: boolean; detail: string }[];
  warnings: string[];
}

export interface Dataset {
  version: 1;
  entities: Entity[];
  globalObjectives: GlobalObjective[];
  globalKrs: GlobalKR[];
  entityObjectives: EntityObjective[];
  entityKrs: EntityKR[];
  contributions: Contribution[];
  initiatives: Initiative[];
  milestones: Milestone[];
  updates: MilestoneUpdate[];
  annexes: AnnexTable[];
  settings: Settings;
  lastImport: ImportReport | null;
}

export const DEFAULT_SETTINGS: Settings = {
  weights: { Lead: 2, Contributes: 1 },
  rag: { green: 70, amber: 40 },
  lateScore: 0,
  currentQuarter: 1,
};

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: 'Non démarré',
  in_progress: 'En cours',
  achieved: 'Atteint',
  late: 'En retard',
  cancelled: 'Annulé',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin global (Strategy/PMO)',
  country_lead: 'Lead pays',
  team_lead: 'Lead équipe globale',
  viewer: 'Lecteur',
};

export function emptyDataset(): Dataset {
  return {
    version: 1,
    entities: [],
    globalObjectives: [],
    globalKrs: [],
    entityObjectives: [],
    entityKrs: [],
    contributions: [],
    initiatives: [],
    milestones: [],
    updates: [],
    annexes: [],
    settings: { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights }, rag: { ...DEFAULT_SETTINGS.rag } },
    lastImport: null,
  };
}
