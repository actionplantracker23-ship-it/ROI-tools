import { createLocalStore } from './localStore';
import { createSupabaseStore } from './supabaseStore';
import type { Store } from './types';

/** Supabase si les variables d'environnement sont définies, sinon mode local (localStorage). */
export function createStore(): Store {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? createSupabaseStore(url, key) : createLocalStore();
}
export type { Store };
