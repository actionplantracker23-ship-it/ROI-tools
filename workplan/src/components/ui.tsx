import type React from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { pct } from '../lib/format';
import type { Score } from '../lib/calc';
import { ALIGN_HELP, ALIGN_LABEL, STATUS_LABEL, type ActivityStatus, type AlignStatus, type Objective, type Rag, type Role } from '../types';

// Statuts : pastille colorée + libellé sur fond pâle (lisible, jamais la couleur seule)
export const RAG_STYLE: Record<Rag, { cls: string; label: string; icon: string }> = {
  green: { cls: 'bg-[#eaf6ee] text-[#1f7a3d]', label: 'En bonne voie', icon: '●' },
  amber: { cls: 'bg-[#fdf5e3] text-[#8a5a00]', label: 'À surveiller', icon: '●' },
  red: { cls: 'bg-[#fbeaea] text-[#a23434]', label: 'En difficulté', icon: '●' },
  none: { cls: 'bg-[#eef0f2] text-[#6D6E71]', label: 'Pas encore suivi', icon: '○' },
};
export const RAG_HEX: Record<Rag, string> = { green: '#2E9E4F', amber: '#F7941D', red: '#D64545', none: '#d5dbe1' };

/** Statut RAG (avancement) : pastille + libellé. */
export function RagBadge({ rag, score, compact }: { rag: Rag; score?: number | null; compact?: boolean }) {
  const s = RAG_STYLE[rag];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[14px] ${s.cls}`} title={s.label}>
      <span aria-hidden style={{ color: RAG_HEX[rag] }}>{s.icon}</span>
      {compact ? null : s.label}
      {score !== undefined && <span className="tabular-nums">{pct(score)}</span>}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === 'Lead'
    ? <span className="inline-flex items-center rounded-full bg-[#fff3e6] px-2 py-px text-[13.5px] font-semibold text-[#9a4a00]">Lead</span>
    : <span className="inline-flex items-center rounded-full bg-[#eef4fa] px-2 py-px text-[13.5px] text-brand-500">Contributes</span>;
}

/** Couleurs Living Goods des statuts et priorités (cellules pleines du tableau principal). */
export const STATUS_HEX: Record<ActivityStatus, string> = { not_started: '#A7AAAD', in_progress: '#F7941D', done: '#2E9E4F', late: '#D64545', cancelled: '#6D6E71' };
export const PRIORITY_HEX: Record<'high' | 'medium' | 'low', string> = { high: '#004D84', medium: '#2F80C0', low: '#4FB3E3' };
export const STATUS_STYLE: Record<ActivityStatus, string> = {
  not_started: 'bg-[#eef0f2] text-[#55585b]',
  in_progress: 'bg-[#fef1e1] text-[#9a5300]',
  done: 'bg-[#e8f5ec] text-[#1f7a3d]',
  late: 'bg-[#fbeaea] text-[#a23434]',
  cancelled: 'bg-[#eceeef] text-[#55585b] line-through',
};
export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[14px] ${STATUS_STYLE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_HEX[status] }} />{STATUS_LABEL[status]}
    </span>
  );
}

export function ObjectiveChip({ o, short }: { o: Objective; short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: o.color }}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
      {short ? `O${o.code}` : `O${o.code} · ${o.title}`}
    </span>
  );
}

export function ProgressBar({ value, rag, color }: { value: number | null; rag?: Rag; color?: string }) {
  const fill = color ?? RAG_HEX[rag ?? 'none'];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8ecf0]" role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: fill }} />
    </div>
  );
}

/** Jauge semi-circulaire : avancement au centre, couleur = statut RAG. */
export function Gauge({ score, size = 132 }: { score: Score; size?: number }) {
  const r = 52;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(100, score.progress ?? 0));
  return (
    <div className="relative" style={{ width: size, height: size * 0.62 }}>
      <svg viewBox="0 0 120 70" width={size} height={size * 0.62} aria-hidden>
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="#EEF0F2" strokeWidth="10" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={RAG_HEX[score.rag]} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="font-titre text-[28px] font-semibold tabular-nums leading-none text-brand-500">{pct(score.progress)}</div>
      </div>
    </div>
  );
}

export function Card({ children, className = '', title, action, style }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={style} className={`rounded-2xl border border-[#e5e8ec] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(11,46,89,.04)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[22px] font-semibold text-brand-600">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** En-tête de page : titre Garamond, sur-titre discret, sans cadre. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <div className="mb-1 text-[14px] uppercase tracking-[.14em] text-accent">{eyebrow ?? 'Plan de travail'}</div>
        <h1 className="text-[34px] font-semibold leading-tight text-brand-600 sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[17px] italic text-[#6D6E71]">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Button({ children, onClick, variant = 'secondary', type = 'button', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const v = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-slate-300',
    secondary: 'border border-[#d5dbe1] bg-white text-[#1d2327] hover:border-brand-500 hover:text-brand-600 disabled:text-slate-400',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-full px-4 py-2 text-[16px] transition ${v} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e5e8ec] bg-white p-12 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function NoPlan() {
  return (
    <EmptyState title="Aucun plan de travail sélectionné">
      Créez le plan de l’année depuis la page <Link to="/plans" className="font-semibold text-brand-500 underline">Plans annuels</Link>.
    </EmptyState>
  );
}

/** Fenêtre modale (édition). */
export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-3 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`w-full rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-ligne px-5 py-3">
          <h3 className="text-[24px] font-semibold text-brand-600">{title}</h3>
          <button onClick={onClose} className="rounded-md px-2 text-2xl leading-none text-slate-500 hover:bg-slate-100" aria-label="Fermer">×</button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`block text-[15px] text-[#6D6E71] ${className}`}>{label}<div className="mt-1">{children}</div></label>;
}

/** Badge « orphelin » : tâche pays sans tâche d'équipe globale qui la soutient. */
export function OrphanBadge() {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fbeaea] px-2.5 py-0.5 text-[13.5px] font-semibold text-[#a23434]" title="Aucune équipe globale n’a de tâche qui la soutient"><span aria-hidden>⚠</span> Orpheline · non liée au global</span>;
}

export const ALIGN_STYLE: Record<AlignStatus, string> = {
  aligned: 'bg-[#eaf6ee] text-[#1f7a3d]',
  partial: 'bg-[#fdf5e3] text-[#8a5a00]',
  conflict: 'bg-[#f1ebfb] text-[#5b2bb5]',
  gap: 'bg-[#fbeaea] text-[#a23434]',
  global_only: 'bg-[#eef2f6] text-[#46607a]',
};
export const ALIGN_HEX: Record<AlignStatus, string> = { aligned: '#2e9e4f', partial: '#f2b01e', conflict: '#7c3aed', gap: '#d64545', global_only: '#5b7b9a' };

/** Statut de l'analyse d'alignement (Aligned, Partial, Conflict, Gap, Global only). */
export function AlignBadge({ status }: { status: AlignStatus | null }) {
  if (!status) return <span className="text-xs text-slate-400">non analysé</span>;
  return <span title={ALIGN_HELP[status]} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13.5px] font-semibold ${ALIGN_STYLE[status]}`}>{ALIGN_LABEL[status]}</span>;
}

export function UnitChip({ name, type }: { name: string; type: 'department' | 'country' }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-px text-[14px] ${type === 'department' ? 'bg-[#eef4fa] text-brand-500' : 'bg-[#fdf1e4] text-[#8a4b00]'}`}>{name}</span>
  );
}

export function MiniProgress({ value, rag }: { value: number | null; rag: Rag }) {
  return (
    <span className="inline-flex w-32 items-center gap-1.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8ecf0]"><span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: RAG_HEX[rag] }} /></span>
      <span className="w-11 text-right text-[14px] tabular-nums text-brand-600">{pct(value)}</span>
    </span>
  );
}

/** Chiffre clé : sobre, une pastille de couleur. */
export function Stat({ label, value, hint, color = '#004D84' }: { label: string; value: ReactNode; hint?: ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e8ec] bg-white px-5 py-4">
      <div className="flex items-center gap-2 text-[14px] uppercase tracking-[.08em] text-[#6D6E71]"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</div>
      <div className="mt-1 text-[36px] font-semibold leading-none tabular-nums text-brand-600">{value}</div>
      {hint && <div className="mt-1.5 text-[15px] text-[#6D6E71]">{hint}</div>}
    </div>
  );
}

export const inputCls = 'min-h-[42px] w-full rounded-xl border border-[#d5dbe1] bg-white px-3 py-2 text-[16px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';
