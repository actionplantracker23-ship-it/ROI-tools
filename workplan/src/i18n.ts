/**
 * Traduction de l'interface français ↔ anglais.
 * - t('Texte en français') renvoie la traduction anglaise si la langue est EN (dictionnaire EN ci-dessous),
 *   sinon le texte d'origine. Paramètres : t('{n} tâches', { n: 3 }).
 * - localized(fr, en) : tables de libellés (statuts, priorités…) qui suivent la langue courante.
 * La langue est enregistrée dans les paramètres ; changer de langue réaffiche toute l'application.
 * Les données (intitulés des tâches, objectifs) ne sont pas traduites.
 */
import { EN } from './i18n.en';

export type Lang = 'fr' | 'en';
let current: Lang = 'fr';
export const getLang = () => current;
export const setLang = (l: Lang) => { current = l === 'en' ? 'en' : 'fr'; };
export const locale = () => (current === 'en' ? 'en-GB' : 'fr-FR');

export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? EN[fr] ?? EN[fr.trim()] ?? fr : fr;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Table de libellés bilingue : lecture selon la langue courante. */
export function localized<K extends string>(fr: Record<K, string>, en: Record<K, string>): Record<K, string> {
  return new Proxy(fr, { get: (target, k: string) => (current === 'en' ? en : target)[k as K] ?? (target as Record<string, string>)[k] });
}
