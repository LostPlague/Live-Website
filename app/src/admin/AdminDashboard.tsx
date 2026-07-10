import React, { useCallback, useEffect, useRef, useState } from 'react';
import './admin.css';
import { Icon } from './ui';
import type {
  Visitor, OverviewData, VisitorsData, VisitorDetail, ChallengeData, ContentData, SystemData,
} from './ui';
import { OverviewPage, VisitorsPage, DossierView, ChallengePage, ContentPage, SystemPage } from './pages';
import { SAMPLE, S_DETAIL } from './sample';

// CONTROL CENTER — private /admin mission deck. Never holds the PostHog key;
// it POSTs { password, mode, … } to the Netlify function which validates
// server-side and returns shaped results. In local dev the function isn't
// running, so it falls back to clearly-labelled SAMPLE data.

type PageId = 'overview' | 'visitors' | 'challenge' | 'content' | 'system';

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'visitors', label: 'Visitors', icon: 'users' },
  { id: 'challenge', label: 'Challenge', icon: 'lock' },
  { id: 'content', label: 'Content', icon: 'layers' },
  { id: 'system', label: 'System', icon: 'cpu' },
];
const RANGES = [{ d: 1, label: '24H' }, { d: 7, label: '7D' }, { d: 30, label: '30D' }, { d: 90, label: '90D' }];
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();

interface Store {
  overview?: OverviewData; visitors?: VisitorsData; challenge?: ChallengeData;
  content?: ContentData; system?: SystemData;
}

// ── access gate ──────────────────────────────────────────────────────────────
const Gate: React.FC<{ onSubmit: (pw: string) => void; error: string; busy: boolean }> = ({ onSubmit, error, busy }) => {
  const [pw, setPw] = useState('');
  return (
    <div className="cc-gate">
      <form className="cc-gate-card" onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }}>
        <span className="cc-gate-icon"><Icon name="key" size={20} /></span>
        <p className="cc-gate-badge">Restricted</p>
        <h1 className="cc-gate-title">CONTROL CENTER</h1>
        <input className="cc-input" type="password" placeholder="ACCESS KEY" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="cc-btn" type="submit" disabled={busy}>{busy ? 'AUTHORIZING…' : 'ENTER'}</button>
        <p className="cc-gate-err">{error}</p>
      </form>
    </div>
  );
};

// ── shell ────────────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const [pw, setPw] = useState<string>(() => sessionStorage.getItem('cc_pw') || '');
  const [authed, setAuthed] = useState(false);
  const [granted, setGranted] = useState(false); // "ACCESS GRANTED" splash
  const [page, setPage] = useState<PageId>('overview');
  const [days, setDays] = useState(7);
  const [store, setStore] = useState<Store>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [showBots, setShowBots] = useState(false);
  const [dossier, setDossier] = useState<Visitor | null>(null);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const pwRef = useRef(pw);
  pwRef.current = pw;

  // dashboard typography (loaded here so the fonts never weigh down the portfolio)
  useEffect(() => {
    if (document.getElementById('cc-fonts')) return;
    const l = document.createElement('link');
    l.id = 'cc-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap';
    document.head.appendChild(l);
  }, []);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/.netlify/functions/ph', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwRef.current, tz: TZ, ...body }),
    });
    if (res.status === 401) throw { kind: 'auth' };
    if (!res.ok) {
      const detail = await res.json().then((b) => (b && b.error) || '').catch(() => '');
      throw { kind: 'server', message: `Server error ${res.status}${detail ? ` — ${detail}` : ''}` };
    }
    return res.json();
  }, []);

  const loadPage = useCallback(async (p: PageId, d: number, opts: { silent?: boolean; bots?: boolean } = {}) => {
    if (!opts.silent) setBusy(true);
    try {
      const data = await api({ mode: p, days: d, showBots: p === 'visitors' ? (opts.bots ?? showBots) : undefined });
      setStore((s) => ({ ...s, [p]: data }));
      setAuthed(true); setError(''); setSample(false); setUpdated(new Date());
      sessionStorage.setItem('cc_pw', pwRef.current);
      return true;
    } catch (e) {
      const err = e as { kind?: string; message?: string };
      if (err.kind === 'auth') {
        setError('Wrong access key.'); setAuthed(false); sessionStorage.removeItem('cc_pw');
      } else if (err.kind === 'server') {
        if (import.meta.env.DEV) { devFallback(p); return true; }
        setError(err.message || 'Server error.');
      } else {
        if (import.meta.env.DEV) { devFallback(p); return true; }
        setError('Could not reach the server. Confirm you are on mohamedtabari.com/admin and hard-refresh (Ctrl+Shift+R).');
      }
      return false;
    } finally { setBusy(false); }
    function devFallback(pp: PageId) {
      setStore((s) => ({ ...s, [pp]: SAMPLE[pp] }));
      setAuthed(true); setSample(true); setError(''); setUpdated(new Date());
    }
  }, [api, showBots]);

  const auth = (candidate: string) => {
    setPw(candidate); pwRef.current = candidate;
    void loadPage('overview', days).then((ok) => {
      if (ok) { setGranted(true); window.setTimeout(() => setGranted(false), 1100); }
    });
  };

  // restore session
  useEffect(() => { if (pw) void loadPage('overview', days, { silent: true }); /* eslint-disable-next-line */ }, []);

  // auto-refresh the active page
  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => void loadPage(page, days, { silent: true }), 60_000);
    return () => window.clearInterval(id);
  }, [authed, page, days, loadPage]);

  const go = (p: PageId) => {
    setPage(p); setDossier(null); setDetail(null);
    if (!store[p]) void loadPage(p, days, { silent: true });
  };

  const changeDays = (d: number) => {
    setDays(d); setStore({});
    void loadPage(page, d, { silent: true });
  };

  const openVisitor = useCallback((v: Visitor) => {
    setPage('visitors'); setDossier(v); setDetail(null);
    api({ mode: 'visitor', personId: v.id })
      .then((d) => setDetail(d as VisitorDetail))
      .catch(() => { if (import.meta.env.DEV) setDetail(S_DETAIL); });
  }, [api]);

  const toggleBots = () => {
    const nx = !showBots;
    setShowBots(nx);
    void loadPage('visitors', days, { silent: true, bots: nx });
  };

  if (!authed) return <div className="cc-root"><Gate onSubmit={auth} error={error} busy={busy} /></div>;

  const roster = store.visitors?.visitors ?? store.overview?.visitors ?? [];

  return (
    <div className="cc-root">
      <h2 className="sr-only">Mohamed Tabari portfolio — private analytics control center</h2>
      {granted && <div className="cc-granted"><p>ACCESS GRANTED</p></div>}

      <aside className="cc-side">
        <div className="cc-brand">
          <span className="cc-brand-dot" />
          <span className="cc-brand-name">CONTROL<b>CENTER</b></span>
        </div>
        <nav className="cc-nav">
          {NAV.map((n) => (
            <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={16} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="cc-side-foot">
          {sample && <p className="cc-sample-chip">SAMPLE DATA · dev</p>}
          <p className="cc-sync cc-mono">{updated ? `synced ${updated.toLocaleTimeString()}` : ''}</p>
          <button className="cc-btn-ghost" onClick={() => { sessionStorage.removeItem('cc_pw'); setAuthed(false); setStore({}); }}>
            <Icon name="out" size={13} />Lock
          </button>
        </div>
      </aside>

      <main className="cc-main">
        <header className="cc-topbar">
          <h1 className="cc-page-title">{dossier ? dossier.num : NAV.find((n) => n.id === page)?.label}</h1>
          <div className="cc-topbar-right">
            {error && <span className="cc-error-chip" title={error}>{error.slice(0, 60)}</span>}
            <div className="cc-range">
              {RANGES.map((r) => (
                <button key={r.d} className={days === r.d ? 'on' : ''} onClick={() => changeDays(r.d)}>{r.label}</button>
              ))}
            </div>
            <button className="cc-btn-ghost" title="Refresh now" onClick={() => void loadPage(page, days, { silent: true })}>
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </header>

        <div className="cc-content" key={dossier ? `d-${dossier.id}` : page}>
          {dossier ? (
            <DossierView visitor={dossier} detail={detail} onBack={() => { setDossier(null); setDetail(null); }} />
          ) : page === 'overview' && store.overview ? (
            <OverviewPage d={store.overview} onOpenVisitor={openVisitor} />
          ) : page === 'visitors' && store.visitors ? (
            <VisitorsPage d={store.visitors} onOpen={openVisitor} showBots={showBots} onToggleBots={toggleBots} />
          ) : page === 'challenge' && store.challenge ? (
            <ChallengePage d={store.challenge} visitors={roster} onOpen={openVisitor} />
          ) : page === 'content' && store.content ? (
            <ContentPage d={store.content} />
          ) : page === 'system' && store.system ? (
            <SystemPage d={store.system} />
          ) : (
            <div className="cc-loading"><span className="cc-spinner" />Loading {page}…</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
