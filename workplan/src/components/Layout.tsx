/** Mise en page (charte Big Wins) : barre marine, sélecteur de plan annuel et de trimestre, onglets, barre mobile. */
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import type { Quarter } from '../types';

const TABS: { to: string; label: string; short?: string; icon?: string }[] = [
  { to: '/', label: 'Tableau de bord', short: 'Bilan', icon: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z' },
  { to: '/taches', label: 'Liste (WBS)', short: 'Tâches', icon: 'M4 5h3v3H4zm5 0h11v3H9zM4 11h3v3H4zm5 0h11v3H9zm-5 6h3v3H4zm5 0h11v3H9z' },
  { to: '/gantt', label: 'Gantt', short: 'Gantt', icon: 'M3 4h8v3H3zm5 6h10v3H8zm6 6h7v3h-7z' },
  { to: '/kanban', label: 'Kanban', short: 'Kanban', icon: 'M3 3h5v18H3zm7 0h5v12h-5zm7 0h4v8h-4z' },
  { to: '/echeancier', label: 'Échéancier' },
  { to: '/responsables', label: 'Responsables' },
  { to: '/risques', label: 'Risques & actions', short: 'Risques', icon: 'M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z' },
  { to: '/alignement', label: 'Alignement global ↔ pays' },
  { to: '/indicateurs', label: 'Indicateurs' },
  { to: '/import', label: 'Import Excel' },
  { to: '/plans', label: 'Plans annuels', short: 'Plans', icon: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z' },
  { to: '/parametres', label: 'Paramètres' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { ws, plan, update, quarter, setQuarter, notice, error, setError } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  const plans = [...ws.plans].sort((a, b) => b.year - a.year);
  return (
    <div className="min-h-screen pb-[84px] lg:pb-6">
      <header className="sticky top-0 z-20 bg-brand-600 text-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3.5 px-4 py-3">
          <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-white font-titre text-[15px] font-bold text-brand-600">PT</span>
          <h1 className="min-w-0 flex-1 truncate text-[22px] font-normal max-sm:text-lg">
            Plan de travail {plan ? <b className="font-semibold">{plan.year}</b> : null}
            <span className="text-[16px] opacity-80 max-sm:hidden"> · gestion de projet · équipes globales et pays</span>
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-[18px]">
        <div className="no-print mb-3.5 flex flex-wrap items-center gap-2">
          <select aria-label="Plan annuel" value={ws.currentPlanId ?? ''} className="min-h-[40px] rounded-md border border-[#c9ced4] bg-white px-2.5 font-semibold"
            onChange={(e) => e.target.value === '__new' ? navigate('/plans') : update((w) => ({ ...w, currentPlanId: e.target.value }))}>
            {!plans.length && <option value="">Aucun plan</option>}
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ Nouveau plan…</option>
          </select>
          <select aria-label="Trimestre" value={quarter} onChange={(e) => setQuarter(Number(e.target.value) as Quarter)} className="min-h-[40px] rounded-md border border-[#c9ced4] bg-white px-2.5">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}{q === ws.settings.currentQuarter ? ' (en cours)' : ''}</option>)}
          </select>
          {ws.settings.userName && <span className="ml-auto text-sm text-slate-500">Connecté : <b className="text-[#1d2327]">{ws.settings.userName}</b></span>}
        </div>
        <nav className="no-print mb-4 flex flex-wrap gap-1 rounded-lg border border-ligne bg-white p-1 max-lg:hidden" role="tablist">
          {TABS.map((t) => (
            <button key={t.to} role="tab" aria-selected={active(t.to)} onClick={() => navigate(t.to)}
              className={`rounded-md px-3 py-2 text-[15px] ${active(t.to) ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-brand-600'}`}>{t.label}</button>
          ))}
        </nav>
        <nav className="no-print mb-3 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {TABS.filter((t) => !t.icon).map((t) => (
            <button key={t.to} onClick={() => navigate(t.to)} className={`whitespace-nowrap rounded-full border px-3 py-1 text-[13px] ${active(t.to) ? 'border-accent text-accent' : 'border-[#c9d6e2] bg-white text-brand-500'}`}>{t.label}</button>
          ))}
        </nav>
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-[#8a1c2b]">
            <span>{error}</span><button onClick={() => setError(null)} className="font-semibold" aria-label="Fermer">×</button>
          </div>
        )}
        {children}
      </main>

      {notice && <div className="fixed bottom-[100px] left-1/2 z-[60] -translate-x-1/2 rounded-md bg-[#333] px-[18px] py-2.5 text-white shadow-lg lg:bottom-8">{notice}</div>}

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex justify-around bg-brand-600 pb-1 pt-1.5 lg:hidden">
        {TABS.filter((t) => t.icon).map((t) => (
          <button key={t.to} onClick={() => navigate(t.to)} className="relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-1 text-[11px] text-white">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d={t.icon} /></svg>
            {t.short}
            {active(t.to) && <span className="absolute bottom-0 h-1 w-12 rounded-t bg-accent" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
