/**
 * Mise en page épurée : barre marine fine (plan annuel et trimestre à droite), six onglets principaux,
 * les autres pages dans « Plus », barre d'icônes en bas sur mobile.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import type { Quarter } from '../types';

const MAIN: { to: string; label: string; short: string; icon: string }[] = [
  { to: '/', label: 'Tableau de bord', short: 'Bilan', icon: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z' },
  { to: '/plan', label: 'Plan de travail', short: 'Plan', icon: 'M4 5h3v3H4zm5 0h11v3H9zM4 11h3v3H4zm5 0h11v3H9zm-5 6h3v3H4zm5 0h11v3H9z' },
  { to: '/gantt', label: 'Gantt', short: 'Gantt', icon: 'M3 4h8v3H3zm5 6h10v3H8zm6 6h7v3h-7z' },
  { to: '/kanban', label: 'Kanban', short: 'Kanban', icon: 'M3 3h5v18H3zm7 0h5v12h-5zm7 0h4v8h-4z' },
  { to: '/echeancier', label: 'Échéancier', short: 'Dates', icon: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z' },
  { to: '/risques', label: 'Risques & actions', short: 'Risques', icon: 'M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z' },
];
const MORE: { to: string; label: string }[] = [
  { to: '/taches', label: 'Tableau détaillé (WBS)' },
  { to: '/responsables', label: 'Responsables' },
  { to: '/alignement', label: 'Alignement global ↔ pays' },
  { to: '/indicateurs', label: 'Indicateurs' },
  { to: '/import', label: 'Import Excel' },
  { to: '/plans', label: 'Plans annuels' },
  { to: '/parametres', label: 'Paramètres' },
];

function MoreMenu({ active }: { active: (to: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const current = MORE.find((m) => active(m.to));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className={`rounded-full px-4 py-1.5 text-[16px] ${current ? 'bg-brand-600 text-white' : 'text-[#4b5563] hover:bg-white'}`}>
        {current ? current.label : 'Plus'} ▾
      </button>
      {open && (
        <ul className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-[#e7e4dc] bg-white py-1 shadow-xl">
          {MORE.map((m) => (
            <li key={m.to}><button onClick={() => { setOpen(false); navigate(m.to); }} className={`block w-full px-4 py-2 text-left text-[16px] hover:bg-[#f6f5f1] ${active(m.to) ? 'font-semibold text-brand-600' : ''}`}>{m.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { ws, plan, update, quarter, setQuarter, notice, error, setError } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  const plans = [...ws.plans].sort((a, b) => b.year - a.year);
  const sel = 'min-h-[34px] rounded-full border border-white/25 bg-white/10 px-3 text-[15px] text-white focus:outline-none [&>option]:text-[#1d2327]';
  return (
    <div className="min-h-screen pb-[84px] lg:pb-10">
      <header className="sticky top-0 z-30 bg-brand-600 text-white">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-5 py-2.5">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[15px] font-bold text-brand-600">PT</span>
          <span className="min-w-0 flex-1 truncate text-[21px] tracking-wide">
            Plan de travail {plan && <span className="italic text-white/80">{plan.year}</span>}
          </span>
          <select aria-label="Plan annuel" value={ws.currentPlanId ?? ''} className={`${sel} max-sm:hidden`}
            onChange={(e) => (e.target.value === '__new' ? navigate('/plans') : update((w) => ({ ...w, currentPlanId: e.target.value })))}>
            {!plans.length && <option value="">Aucun plan</option>}
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ Nouveau plan…</option>
          </select>
          <select aria-label="Trimestre" value={quarter} onChange={(e) => setQuarter(Number(e.target.value) as Quarter)} className={sel}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
          </select>
        </div>
      </header>

      <div className="no-print sticky top-[56px] z-20 border-b border-[#e7e4dc] bg-[#f6f5f1]/95 backdrop-blur max-lg:hidden">
        <nav className="mx-auto flex max-w-[1280px] items-center gap-1 px-5 py-2" role="tablist">
          {MAIN.map((t) => (
            <button key={t.to} role="tab" aria-selected={active(t.to)} onClick={() => navigate(t.to)}
              className={`rounded-full px-4 py-1.5 text-[16px] transition ${active(t.to) ? 'bg-brand-600 text-white' : 'text-[#4b5563] hover:bg-white'}`}>{t.label}</button>
          ))}
          <span className="flex-1" />
          <MoreMenu active={active} />
        </nav>
      </div>

      <main className="mx-auto max-w-[1280px] px-5 py-7">
        <div className="mb-4 flex justify-end lg:hidden"><MoreMenu active={active} /></div>
        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-[#8a1c2b]">
            <span>{error}</span><button onClick={() => setError(null)} className="font-semibold" aria-label="Fermer">×</button>
          </div>
        )}
        {children}
      </main>

      {notice && <div className="fixed bottom-[100px] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-brand-600 px-5 py-2.5 text-white shadow-lg lg:bottom-8">{notice}</div>}

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex justify-around bg-brand-600 pb-1 pt-1.5 lg:hidden">
        {MAIN.map((t) => (
          <button key={t.to} onClick={() => navigate(t.to)} className="relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-1 text-[13px] text-white">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d={t.icon} /></svg>
            {t.short}
            {active(t.to) && <span className="absolute bottom-0 h-1 w-10 rounded-t bg-accent" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
