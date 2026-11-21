import type { AppUser, Dataset } from '../types';

/** Admin : tout. Lead pays / Lead équipe : uniquement leurs entités. Lecteur : rien. */
export function canEditEntity(user: AppUser | null, entityId: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'country_lead' || user.role === 'team_lead') return user.entityIds.includes(entityId);
  return false;
}
export const isAdmin = (u: AppUser | null) => u?.role === 'admin';

/** Entités modifiables par l'utilisateur (pour le formulaire de check-in). */
export function editableEntityIds(user: AppUser | null, ds: Dataset): string[] {
  return ds.entities.filter((e) => canEditEntity(user, e.id)).map((e) => e.id);
}
