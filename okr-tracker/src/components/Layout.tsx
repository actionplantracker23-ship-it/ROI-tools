import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ROLE_LABEL, type Quarter } from '../types';
import { RAG_HEX } from './ui';

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

function Nav() {
  const { ds, computed } = useApp();
  const countries = ds.entities.filter((e) => e.type === 'Country');
  const teams = ds.entities.filter((e) => e.type === 'GlobalTeam');
  const dot = (id: string) => <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RAG_HEX[computed.entity.get(id)?.rag ?? 'none'] }} />;
  return (
    <nav className="space-y-5 p-3">
      <div className="space-y-0.5">
        <NavLink to="/" end className={link}>Tableau de bord global</NavLink>
        <NavLink to="/check-in" className={link}>Mise à jour trimestrielle</NavLink>
        <NavLink to="/registre" className={link}>Registre OKR</NavLink>
        <NavLink to="/annexes" className={link}>Annexes</NavLink>
        <NavLink to="/admin" className={link}>Administration</NavLink>
      </div>
      {countries.length > 0 && (
        <div>
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pays</div>
          {countries.map((e) => <NavLink key={e.id} to={`/pays/${e.id}`} className={link}>{e.name}{dot(e.id)}</NavLink>)}
        </div>
      )}
      {teams.length > 0 && (
        <div>
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Équipes globales</div>
          {teams.map((e) => (
            <NavLink key={e.id} to={`/equipe/${e.id}`} className={link}>
              <span>{e.name}{e.group && <span className="ml-1 text-[11px] text-slate-400">{e.group}</span>}</span>{dot(e.id)}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { quarter, setQuarter, user, store, error, setError, notice, loading } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="min-h-screen lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">Living Goods</div>
          <div className="text-lg font-bold">OKR Tracker 2027</div>
        </div>
        <Nav />
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <header className="app-bar sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3z" /></svg>
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">Trimestre</span>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Trimestre">
              {([1, 2, 3, 4] as Quarter[]).map((q) => (
                <button key={q} onClick={() => setQuarter(q)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${quarter === q ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Q{q}
                </button>
              ))}
            </div>
          </label>
          <div className="ml-auto flex items-center gap-2 text-right text-xs">
            {store.mode === 'local' && <span className="hidden rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200 sm:inline">Mode local</span>}
            {user ? (
              <span className="leading-tight"><span className="font-semibold text-slate-800">{user.name || user.email}</span><br /><span className="text-slate-500">{ROLE_LABEL[user.role]}</span></span>
            ) : <NavLink to="/admin" className="font-medium text-brand-600">Se connecter</NavLink>}
          </div>
        </header>
        {error && (
          <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>{error}</span><button onClick={() => setError(null)} className="font-semibold">×</button>
          </div>
        )}
        {notice && <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{notice}</div>}
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{loading ? <p className="text-sm text-slate-500">Chargement…</p> : children}</main>
      </div>
    </div>
  );
}
