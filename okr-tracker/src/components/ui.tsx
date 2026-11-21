import type React from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { pct } from '../lib/format';
import type { Score } from '../lib/progress';
import { STATUS_LABEL, type GlobalObjective, type MilestoneStatus, type Rag, type Role } from '../types';

// Couleurs de statut du tableau de bord Big Wins
export const RAG_STYLE: Record<Rag, { cls: string; label: string; icon: string }> = {
  green: { cls: 'bg-rag-green text-white', label: 'Vert', icon: '●' },
  amber: { cls: 'bg-rag-amber text-[#2b2100]', label: 'Ambre', icon: '▲' },
  red: { cls: 'bg-rag-red text-white', label: 'Rouge', icon: '■' },
  none: { cls: 'bg-rag-grey text-white', label: 'Sans donnée', icon: '○' },
};
export const RAG_HEX: Record<Rag, string> = { green: '#2e9e4f', amber: '#f2b01e', red: '#d64545', none: '#cfd4da' };

/** Statut RAG : badge plein (style Big Wins) avec forme + libellé, jamais la couleur seule. */
export function RagBadge({ rag, score, compact }: { rag: Rag; score?: number | null; compact?: boolean }) {
  const s = RAG_STYLE[rag];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[13px] ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {compact ? null : s.label}
      {score !== undefined && <span className="tabular-nums">{pct(score)}</span>}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === 'Lead' ? (
    <span className="inline-flex items-center rounded-full border border-[#f7c08b] bg-[#fff3e6] px-2 py-px text-[12px] font-semibold text-[#9a4a00]">Lead</span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-[#9ed8f2] bg-[#eaf7fd] px-2 py-px text-[12px] text-brand-500">Contributes</span>
  );
}

export const STATUS_STYLE: Record<MilestoneStatus, string> = {
  not_started: 'bg-rag-grey text-white',
  in_progress: 'bg-rag-amber text-[#2b2100]',
  achieved: 'bg-rag-green text-white',
  late: 'bg-rag-red text-white',
  cancelled: 'bg-[#2f3640] text-white',
};
export function StatusBadge({ status }: { status: MilestoneStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded px-2.5 py-0.5 text-[13px] ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function ObjectiveChip({ o, short }: { o: GlobalObjective; short?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: o.color }}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
      {short ? o.id : `${o.id} · ${o.title}`}
    </span>
  );
}

export function ProgressBar({ value, rag, color }: { value: number | null; rag?: Rag; color?: string }) {
  const fill = color ?? RAG_HEX[rag ?? 'none'];
  return (
    <div className="h-3 w-full overflow-hidden bg-[#EEF0F2]" role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: fill }} />
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
    <section style={style} className={`rounded-lg border border-ligne bg-white px-5 py-[18px] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-titre text-xl font-semibold text-[#1d2327]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-5 rounded-md border border-ligne bg-white px-5 pb-5 pt-4 font-serif sm:px-8">
      <div className="m-entete"><span>{eyebrow ?? 'OKR 2027 · Living Goods'}</span>{actions && <div className="no-print flex flex-wrap gap-2 font-sans normal-case tracking-normal">{actions}</div>}</div>
      <h1 className="text-[26px] font-bold leading-tight text-brand-500 sm:text-[30px]">{title}</h1>
      {subtitle && <p className="mt-2 text-[14.5px] text-[#6D6E71]">{subtitle}</p>}
    </header>
  );
}

export function Button({ children, onClick, variant = 'secondary', type = 'button', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300',
    secondary: 'border border-[#c9ced4] bg-white text-[#1d2327] hover:border-accent hover:text-brand-600 disabled:text-slate-400',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-md px-3.5 py-2 text-[15px] transition ${v} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-ligne bg-white p-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function NoData() {
  return (
    <EmptyState title="Aucune donnée importée">
      Importez le fichier <em>2027 OKR Consolidated Plans_V2.xlsx</em> depuis la page{' '}
      <Link to="/admin" className="font-medium text-brand-600 underline">Administration</Link>.
    </EmptyState>
  );
}

/** Indicateur clé (carte KPI Big Wins : bordure haute colorée, chiffre en Oswald). */
export function Stat({ label, value, hint, color = '#0b2e59' }: { label: string; value: ReactNode; hint?: ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-ligne bg-white px-4 py-3.5" style={{ borderTop: `4px solid ${color}` }}>
      <div className="text-[13px] uppercase tracking-[.03em] text-slate-500">{label}</div>
      <div className="font-titre text-[30px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint && <div className="text-[13px] text-slate-500">{hint}</div>}
    </div>
  );
}

export const inputCls = 'min-h-[40px] w-full rounded-md border border-[#c9ced4] bg-white px-2.5 py-2 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';
