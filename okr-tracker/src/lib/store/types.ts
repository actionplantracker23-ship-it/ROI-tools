import type { AppUser, Dataset, Initiative, MilestoneUpdate, Settings } from '../../types';

/** Interface commune aux deux modes de stockage : localStorage (v1) et Supabase. */
export interface Store {
  mode: 'local' | 'supabase';
  load(): Promise<Dataset>;
  /** Remplace la structure (import Excel déjà fusionné avec l'existant). Admin uniquement. */
  saveDataset(ds: Dataset): Promise<void>;
  /** Ajoute un check-in à l'historique et met à jour l'état courant du jalon. */
  checkIn(u: MilestoneUpdate): Promise<void>;
  updateSettings(s: Settings): Promise<void>;
  updateContributionWeight(id: string, weight: number | null): Promise<void>;
  updateInitiative(id: string, patch: Partial<Pick<Initiative, 'target' | 'targetCountryIds'>>): Promise<void>;

  currentUser(): Promise<AppUser | null>;
  signIn(email: string, password?: string): Promise<string | null>; // message d'information ou null
  signOut(): Promise<void>;
  listUsers(): Promise<AppUser[]>;
  saveUser(u: AppUser): Promise<void>;
  deleteUser(id: string): Promise<void>;
}
