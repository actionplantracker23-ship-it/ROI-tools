import type React from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { pct } from '../lib/format';
import type { Score } from '../lib/progress';
import { STATUS_LABEL, type GlobalObjective, type MilestoneStatus, type Rag, type Role } from '../types';

export const RAG_STYLE: Record<Rag, { bg: string; text: string; dot: string; label: string; icon: string }> = {
  green: { bg: 'bg-green-50 ring-green-200', text: 'text-green-800', dot: 'bg-rag-green', label: 'Vert', icon: '●' },
  amber: { bg: 'bg-amber-50 ring-amber-200', text: 'text-amber-800', dot: 'bg-rag-amber', label: 'Ambre', icon: '▲' },
  red: { bg: 'bg-red-50 ring-red-200', text: 'text-red-800', dot: 'bg-rag-red', label: 'Rouge', icon: '■' },
  none: { bg: 'bg-slate-50 ring-slate-200', text: 'text-slate-500', dot: 'bg-rag-grey', label: 'Sans donnée', icon: '○' },
};
export const RAG_HEX: Record<Rag, string> = { green: '#15803d', amber: '#d97706', red: '#dc2626', none: '#cbd5e1' };

/** Statut RAG : couleur + forme + libellé (jamais la couleur seule). */
export function RagBadge({ rag, score, compact }: { rag: Rag; score?: number | null; compact?: boolean }) {
  const s = RAG_STYLE[rag];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.bg} ${s.text}`}>
      <span aria-hidden>{s.icon}</span>
      {compact ? null : s.label}
      {score !== undefined && <span className="tabular-nums">{pct(score)}</span>}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return role === 'Lead' ? (
    <span className="inline-flex items-center rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Lead</span>
  ) : (
    <span className="inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">Contrib.</span>
  );
}

const STATUS_STYLE: Record<MilestoneStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  achieved: 'bg-green-50 text-green-800',
  late: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-50 text-slate-400 line-through',
};
export function StatusBadge({ status }: { status: MilestoneStatus }) {
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
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
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={RAG_HEX[score.rag]} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-2xl font-bold tabular-nums leading-none">{pct(score.progress)}</div>
      </div>
    </div>
  );
}

export function Card({ children, className = '', title, action, style }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={style} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-slate-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{eyebrow}</div>}
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Button({ children, onClick, variant = 'secondary', type = 'button', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${v} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
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

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';
