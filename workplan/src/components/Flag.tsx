/**
 * Drapeaux des pays (SVG intégrés, rendus identiques sur tous les ordinateurs ; les drapeaux emoji ne
 * s'affichent pas sous Windows). Format 3:2, dessin simplifié lisible en petite taille.
 */
import { key } from '../lib/util';

const FLAGS: Record<string, JSX.Element> = {
  kenya: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6" fill="#000" />
      <rect y="7" width="30" height="6" fill="#BB0000" />
      <rect y="14" width="30" height="6" fill="#006600" />
      <ellipse cx="15" cy="10" rx="3.2" ry="5.6" fill="#BB0000" stroke="#000" strokeWidth=".6" />
      <ellipse cx="15" cy="10" rx="1" ry="4.6" fill="#000" />
    </>
  ),
  'burkina-faso': (
    <>
      <rect width="30" height="10" fill="#EF2B2D" />
      <rect y="10" width="30" height="10" fill="#009E49" />
      <polygon points="15,6.2 16.1,9.4 19.4,9.4 16.7,11.4 17.7,14.6 15,12.6 12.3,14.6 13.3,11.4 10.6,9.4 13.9,9.4" fill="#FCD116" />
    </>
  ),
  uganda: (
    <>
      {['#000', '#FCDC04', '#D90000', '#000', '#FCDC04', '#D90000'].map((c, i) => <rect key={i} y={(i * 20) / 6} width="30" height={20 / 6 + 0.05} fill={c} />)}
      <circle cx="15" cy="10" r="3.6" fill="#fff" />
      <path d="M14 8.2c.8-.6 1.8-.4 2.1.3l-.9.4.2 2.4-1.2.9-.4-1.6z" fill="#000" />
    </>
  ),
  benin: (
    <>
      <rect width="12" height="20" fill="#008751" />
      <rect x="12" width="18" height="10" fill="#FCD116" />
      <rect x="12" y="10" width="18" height="10" fill="#E8112D" />
    </>
  ),
  zambia: (
    <>
      <rect width="30" height="20" fill="#198A00" />
      <rect x="19" y="8" width="3.6" height="12" fill="#DE2010" />
      <rect x="22.6" y="8" width="3.6" height="12" fill="#000" />
      <rect x="26.2" y="8" width="3.8" height="12" fill="#EF7D00" />
      <path d="M21.5 4.5c1.5-1 3.5-1 5 0-.8.2-1.5.6-2 1.2-.5-.6-1.2-1-2-1.2z" fill="#EF7D00" />
    </>
  ),
};

const ALIASES: Record<string, string> = { burkina: 'burkina-faso', 'burkina faso': 'burkina-faso', ouganda: 'uganda', zambie: 'zambia' };

export function flagKey(unitIdOrName: string): string | null {
  const k = key(unitIdOrName);
  const id = FLAGS[unitIdOrName] ? unitIdOrName : FLAGS[k.replace(/ /g, '-')] ? k.replace(/ /g, '-') : ALIASES[k] ?? null;
  return id && FLAGS[id] ? id : null;
}

/** Drapeau d'un pays (rien si le pays n'a pas de drapeau défini). */
export function Flag({ country, size = 20, className = '' }: { country: string; size?: number; className?: string }) {
  const id = flagKey(country);
  if (!id) return null;
  return (
    <svg viewBox="0 0 30 20" width={size} height={(size * 2) / 3} className={`inline-block shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,.12)] ${className}`} role="img" aria-label={`Drapeau ${country}`}>
      {FLAGS[id]}
    </svg>
  );
}
