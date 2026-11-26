/**
 * Mise en page reprise du tableau de bord « Big Wins » : barre du haut bleu marine avec logo rond,
 * onglets horizontaux + filtre trimestre, sous-navigation en pastilles, barre du bas sur mobile,
 * écran de connexion plein écran (mode Supabase).
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ROLE_LABEL, type Quarter } from '../types';
import { RAG_HEX } from './ui';

function Logo({ big }: { big?: boolean }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-titre font-bold ${big ? 'mx-auto h-16 w-16 bg-brand-600 text-xl text-white' : 'h-[42px] w-[42px] bg-white text-[15px] text-brand-600'}`}>
      OKR
    </span>
  );
}

function LoginScreen() {
  const { store, reload, setError, error } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setInfo(await store.signIn(email, password || undefined));
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <section className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-6">
      <form onSubmit={submit} className="grid w-full max-w-[400px] gap-2.5 rounded-xl bg-white px-6 py-7 text-center shadow-2xl">
        <Logo big />
        <h1 className="mt-1 font-titre text-3xl text-brand-600">OKR 2027</h1>
        <p className="text-sm text-slate-500">Living Goods · suivi des OKR · accès réservé.</p>
        <label className="text-left text-sm text-slate-500">E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-[40px] w-full rounded-md border border-[#c9ced4] px-2.5" />
        </label>
        <label className="text-left text-sm text-slate-500">Mot de passe <span className="text-xs">(vide = lien de connexion par e-mail)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 min-h-[40px] w-full rounded-md border border-[#c9ced4] px-2.5" />
        </label>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {info && <p className="text-sm text-brand-500">{info}</p>}
        <button type="submit" className="min-h-[40px] rounded-md bg-brand-600 px-4 text-white hover:bg-brand-700">Se connecter</button>
      </form>
    </section>
  );
}

const TABS: { to: string; label: string; match: string; short: string; icon: string }[] = [
  { to: '/', label: 'Tableau de bord', match: '/', short: 'Bilan', icon: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z' },
  { to: '/plan', label: 'Plan global', match: '/plan', short: 'Plan', icon: 'M3 3h7v4H3zm11 0h7v4h-7zM8 10h8v4H8zm-5 7h7v4H3zm11 0h7v4h-7z' },
  { to: '/pays', label: 'Pays', match: '/pays', short: 'Pays', icon: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z' },
  { to: '/equipe', label: 'Départements', match: '/equipe', short: 'Dépts', icon: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm8 0h-1a4.7 4.7 0 0 1 2 4v3h7v-3c0-2.7-5.3-4-8-4z' },
  { to: '/kr', label: 'KR globaux', match: '/kr', short: 'KR', icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6zm0-9a3 3 0 1 0 3 3 3 3 0 0 0-3-3z' },
  { to: '/check-in', label: 'Mise à jour', match: '/check-in', short: 'Check-in', icon: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z' },
  { to: '/registre', label: 'Registre OKR', match: '/registre', short: 'Registre', icon: '' },
  { to: '/annexes', label: 'Annexes', match: '/annexes', short: 'Annexes', icon: '' },
  { to: '/admin', label: 'Administration', match: '/admin', short: 'Admin', icon: '' },
];

/** Pastilles de sous-navigation (pays, équipes, KR globaux), comme la navigation du rapport Big Wins. */
function SubNav() {
  const { ds, computed } = useApp();
  const { pathname } = useLocation();
  let items: { to: string; label: string; rag: keyof typeof RAG_HEX }[] = [];
  if (pathname.startsWith('/pays')) items = ds.entities.filter((e) => e.type === 'Country').map((e) => ({ to: `/pays/${e.id}`, label: e.name, rag: computed.entity.get(e.id)?.rag ?? 'none' }));
  else if (pathname.startsWith('/equipe')) items = ds.entities.filter((e) => e.type === 'GlobalTeam').map((e) => ({ to: `/equipe/${e.id}`, label: e.name, rag: computed.entity.get(e.id)?.rag ?? 'none' }));
  else if (pathname.startsWith('/kr')) items = ds.globalKrs.map((k) => ({ to: `/kr/${encodeURIComponent(k.id)}`, label: k.id, rag: computed.globalKr.get(k.id)?.rag ?? 'none' }));
  if (!items.length) return null;
  return (
    <nav className="no-print sticky top-[66px] z-10 -mx-1 mb-3.5 flex flex-wrap gap-1.5 bg-fond px-1 py-1.5" aria-label="Sous-navigation">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to}
          className={({ isActive }) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-serif text-[13px] ${isActive ? 'border-accent bg-white text-accent' : 'border-[#c9d6e2] bg-white text-brand-500 hover:border-accent hover:text-accent'}`}>
          <span className="h-2 w-2 rounded-full" style={{ background: RAG_HEX[i.rag] }} />{i.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { ds, quarter, setQuarter, user, store, error, setError, notice, loading, reload } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = (m: string) => (m === '/' ? pathname === '/' : pathname.startsWith(m));
  /** Onglets Pays / Équipes / KR : ouvrent le premier élément. */
  const go = (to: string) => {
    if (to === '/pays') return navigate(`/pays/${ds.entities.find((e) => e.type === 'Country')?.id ?? ''}`);
    if (to === '/equipe') return navigate(`/equipe/${ds.entities.find((e) => e.type === 'GlobalTeam')?.id ?? ''}`);
    if (to === '/kr') return navigate(`/kr/${encodeURIComponent(ds.globalKrs[0]?.id ?? '')}`);
    navigate(to);
  };

  if (store.mode === 'supabase' && !loading && !user) return <LoginScreen />;

  return (
    <div className="min-h-screen pb-[84px] lg:pb-6">
      <header className="app-bar sticky top-0 z-20 bg-brand-600 text-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3.5 px-4 py-3">
          <Logo />
          <h1 className="flex-1 truncate text-[22px] font-normal max-sm:text-lg">
            Tableau de bord <span className="text-[17px] opacity-80 max-sm:hidden">· OKR 2027 · Living Goods</span>
          </h1>
          {store.mode === 'local' && <span className="hidden rounded border border-white/40 px-2 py-0.5 text-xs sm:inline" title="Données dans ce navigateur uniquement">Mode local</span>}
          <button className="rounded-lg p-1.5 hover:bg-white/15" title="Actualiser" aria-label="Actualiser" onClick={() => void reload()}>
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 py-[18px]">
        <div className="no-print mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <nav className="inline-flex flex-wrap gap-1 rounded-lg border border-ligne bg-white p-1 max-lg:hidden" role="tablist">
            {TABS.map((t) => (
              <button key={t.to} role="tab" aria-selected={active(t.match)} onClick={() => go(t.to)}
                className={`rounded-md px-3.5 py-2 text-[15px] ${active(t.match) ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-brand-600'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2 max-lg:w-full">
            <select aria-label="Trimestre" value={quarter} onChange={(e) => setQuarter(Number(e.target.value) as Quarter)}
              className="min-h-[40px] rounded-md border border-[#c9ced4] bg-white px-2.5">
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q} 2027{q === ds.settings.currentQuarter ? ' (en cours)' : ''}</option>)}
            </select>
            <span className="min-w-0 flex-1 truncate text-right text-sm text-slate-500 lg:flex-none">
              {user ? <><b className="font-semibold text-[#1d2327]">{user.name || user.email}</b> · {ROLE_LABEL[user.role]}</> : null}
            </span>
            {store.mode === 'supabase' && user && (
              <button className="min-h-[40px] rounded-md border border-[#c9ced4] bg-white px-3.5 hover:border-accent hover:text-brand-600" onClick={async () => { await store.signOut(); await reload(); }}>
                Se déconnecter
              </button>
            )}
          </div>
        </div>
        <SubNav />
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-[#8a1c2b]">
            <span>{error}</span><button onClick={() => setError(null)} className="font-semibold" aria-label="Fermer">×</button>
          </div>
        )}
        {loading ? <p className="p-10 text-center text-slate-500">Chargement…</p> : children}
      </main>

      {notice && <div className="fixed bottom-[100px] left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#333] px-[18px] py-2.5 text-white shadow-lg lg:bottom-8">{notice}</div>}

      {/* Barre du bas (mobile) */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-20 flex justify-around bg-brand-600 pb-1 pt-1.5 lg:hidden">
        {TABS.filter((t) => t.icon).map((t) => (
          <button key={t.to} onClick={() => go(t.to)} className="relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-1 text-[11px] text-white">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d={t.icon} /></svg>
            {t.short}
            {active(t.match) && <span className="absolute bottom-0 h-1 w-12 rounded-t bg-accent" />}
          </button>
        ))}
        <button onClick={() => navigate('/admin')} className="relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-1 text-[11px] text-white">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm8.9 3-2-.4a7 7 0 0 0-.7-1.7l1.1-1.7-1.5-1.5-1.7 1.1a7 7 0 0 0-1.7-.7L14 2h-4l-.4 2a7 7 0 0 0-1.7.7L6.2 3.6 4.7 5.1l1.1 1.7a7 7 0 0 0-.7 1.7L3 9v4l2 .4a7 7 0 0 0 .7 1.7l-1.1 1.7 1.5 1.5 1.7-1.1a7 7 0 0 0 1.7.7L10 22h4l.4-2a7 7 0 0 0 1.7-.7l1.7 1.1 1.5-1.5-1.1-1.7a7 7 0 0 0 .7-1.7l2-.4z" /></svg>
          Admin
          {active('/admin') && <span className="absolute bottom-0 h-1 w-12 rounded-t bg-accent" />}
        </button>
      </nav>
    </div>
  );
}
