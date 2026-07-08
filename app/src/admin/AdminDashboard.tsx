import React, { useCallback, useEffect, useRef, useState } from 'react';
import './admin.css';

// CONTROL CENTER — private /admin dashboard. Never holds the PostHog key; it
// POSTs { password, mode, days, personId? } to the Netlify function which
// validates server-side and returns results. In local dev the function isn't
// running, so it falls back to clearly-labelled SAMPLE data.

type Row = (string | number | null)[];
interface Data {
  days: number;
  kpis: { visitors: number; sessions: number; resume: number; matrix: number; contacts: number; secretOpened: number };
  trend: Row[]; geo: Row[]; devices: Row[]; browsers: Row[]; os: Row[]; referrers: Row[];
  appOpens: Row[]; appTime: Row[]; funnel: Row[]; attempts: Row[]; hours: Row[]; recent: Row[]; visitorList: Row[];
}
interface VisitorData { profile: Row; timeline: Row[]; }

const RANGES = [{ d: 1, label: '24H' }, { d: 7, label: '7D' }, { d: 30, label: '30D' }, { d: 90, label: '90D' }];
const STAGE_NO: Record<string, number> = { hallucination: 1, turing: 2, tokens: 3 };

// ── sample data (DEV only) ───────────────────────────────────────────────
const SAMPLE: Data = {
  days: 7,
  kpis: { visitors: 1284, sessions: 1512, resume: 37, matrix: 9, contacts: 6, secretOpened: 61 },
  trend: [['Mon', 120], ['Tue', 168], ['Wed', 143], ['Thu', 205], ['Fri', 262], ['Sat', 188], ['Sun', 198]],
  geo: [['United States', 512], ['Morocco', 341], ['United Kingdom', 122], ['Germany', 98], ['Canada', 76], ['France', 61]],
  devices: [['Desktop', 903], ['Mobile', 341], ['Tablet', 40]],
  browsers: [['Chrome', 812], ['Safari', 288], ['Edge', 121], ['Firefox', 63]],
  os: [['Windows', 690], ['macOS', 300], ['iOS', 210], ['Android', 84]],
  referrers: [['linkedin.com', 322], ['github.com', 141], ['google.com', 96], ['t.co', 44]],
  appOpens: [['showcase', 1180], ['radio', 233], ['minesweeper', 174], ['browser', 88], ['secret', 61]],
  appTime: [['radio', 214], ['minesweeper', 132], ['showcase', 96], ['secret', 71], ['browser', 34]],
  funnel: [['secret_opened', null, 61], ['secret_stage_passed', 'hallucination', 44], ['secret_stage_passed', 'turing', 27], ['secret_stage_passed', 'tokens', 12], ['secret_completed', null, 9]],
  attempts: [['hallucination', 22], ['turing', 31], ['tokens', 40]],
  hours: Array.from({ length: 24 }, (_, h) => [h, Math.round(20 + 60 * Math.sin((h - 6) / 24 * Math.PI) ** 2)]),
  recent: [
    [new Date(Date.now() - 40_000).toISOString(), 'resume_downloaded', null, 'United States', 'p1'],
    [new Date(Date.now() - 5 * 60_000).toISOString(), 'secret_completed', null, 'Morocco', 'p2'],
    [new Date(Date.now() - 12 * 60_000).toISOString(), 'app_opened', 'radio', 'Germany', 'p3'],
  ],
  visitorList: [
    ['aaaaaaaa-0000-4000-8000-000000000001', new Date(Date.now() - 6 * 864e5).toISOString(), new Date(Date.now() - 40_000).toISOString(), 34, 'United States', 'Austin', 'Desktop', 'Chrome', 1, 1, 0, 1],
    ['aaaaaaaa-0000-4000-8000-000000000002', new Date(Date.now() - 5 * 864e5).toISOString(), new Date(Date.now() - 3 * 36e5).toISOString(), 12, 'Morocco', 'Casablanca', 'Mobile', 'Safari', 0, 0, 1, 1],
    ['aaaaaaaa-0000-4000-8000-000000000003', new Date(Date.now() - 2 * 864e5).toISOString(), new Date(Date.now() - 9 * 36e5).toISOString(), 5, 'United Kingdom', 'London', 'Desktop', 'Firefox', 0, 0, 0, 1],
  ],
};
const SAMPLE_VISITOR: VisitorData = {
  profile: ['United States', 'Austin', 'Texas', 'Desktop', 'Chrome', 'Windows', 1920, 1080, 'linkedin.com', 'America/Chicago',
    new Date(Date.now() - 6 * 864e5).toISOString(), new Date(Date.now() - 40_000).toISOString(), 34, 2],
  timeline: [
    [new Date(Date.now() - 6 * 864e5).toISOString(), 'experience_started', null, null, null, null, '/', 's1'],
    [new Date(Date.now() - 6 * 864e5 + 20000).toISOString(), 'app_opened', 'showcase', null, null, null, '/os', 's1'],
    [new Date(Date.now() - 6 * 864e5 + 95000).toISOString(), 'app_closed', 'showcase', null, null, 75, '/os', 's1'],
    [new Date(Date.now() - 6 * 864e5 + 100000).toISOString(), 'resume_downloaded', null, null, null, null, '/os', 's1'],
    [new Date(Date.now() - 40_000).toISOString(), 'secret_opened', null, null, null, null, '/os', 's2'],
    [new Date(Date.now() - 38_000).toISOString(), 'secret_wrong_answer', null, 'hallucination', null, null, '/os', 's2'],
    [new Date(Date.now() - 35_000).toISOString(), 'secret_stage_passed', null, 'hallucination', null, null, '/os', 's2'],
    [new Date(Date.now() - 30_000).toISOString(), 'secret_stage_passed', null, 'turing', null, null, '/os', 's2'],
    [new Date(Date.now() - 20_000).toISOString(), 'secret_stage_passed', null, 'tokens', null, null, '/os', 's2'],
    [new Date(Date.now() - 18_000).toISOString(), 'secret_completed', null, null, null, null, '/os', 's2'],
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDay = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const pretty = (ev: string) => ev.replace(/_/g, ' ');

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    const safety = window.setTimeout(() => { setV(target); from.current = target; }, ms + 200);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(safety); };
  }, [target, ms]);
  return v;
}

const EV_ICON: Record<string, string> = {
  resume_downloaded: '⬇', secret_completed: '🏆', contact_submitted: '✉',
  app_opened: '🪟', app_closed: '✖', experience_started: '▶',
  radio_play: '♪', minesweeper_result: '💣', secret_opened: '🔓',
  secret_stage_passed: '🧩', secret_wrong_answer: '✗', secret_gave_up: '🚪', secret_failed: '☠',
};
const TROPHY = new Set(['resume_downloaded', 'secret_completed', 'contact_submitted']);

// ── charts ─────────────────────────────────────────────────────────────────
const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
  return (
    <svg className="cc-spark" width="90" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const AreaChart: React.FC<{ trend: Row[] }> = ({ trend }) => {
  const W = 820, H = 220, pad = 8;
  const vals = trend.map((r) => Number(r[1]) || 0);
  if (vals.length < 2) return <div className="cc-empty">Not enough data yet — check back once visitors roll in.</div>;
  const max = Math.max(...vals, 1);
  const x = (i: number) => pad + (i / (vals.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2 - 16);
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="cc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="ccStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${H - pad} ${line} ${W - pad},${H - pad}`} fill="url(#ccFill)" />
      <polyline points={line} fill="none" stroke="url(#ccStroke)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#fff" stroke="#38bdf8" strokeWidth="1.5" />)}
    </svg>
  );
};

const Bars: React.FC<{ rows: Row[]; suffix?: (v: number) => string }> = ({ rows, suffix }) => {
  if (!rows.length) return <div className="cc-empty">No data yet.</div>;
  const max = Math.max(...rows.map((r) => Number(r[1]) || 0), 1);
  return (
    <div className="cc-bar-row">
      {rows.map((r, i) => {
        const v = Number(r[1]) || 0;
        return (
          <div className="cc-bar" key={i}>
            <span className="cc-bar-label">{String(r[0])}</span>
            <span className="cc-bar-track"><span className="cc-bar-fill" style={{ width: `${(v / max) * 100}%` }} /></span>
            <span className="cc-bar-val">{suffix ? suffix(v) : fmt(v)}</span>
          </div>
        );
      })}
    </div>
  );
};

const Funnel: React.FC<{ funnel: Row[]; attempts: Row[]; fallbackOpened: number; fallbackDone: number }> = ({ funnel, attempts, fallbackOpened, fallbackDone }) => {
  const stage = (name: string) => { const r = funnel.find((x) => x[0] === 'secret_stage_passed' && x[1] === name); return r ? Number(r[2]) : 0; };
  const wrong = (name: string) => { const r = attempts.find((x) => x[0] === name); return r ? Number(r[1]) : 0; };
  const openedRow = funnel.find((x) => x[0] === 'secret_opened');
  const doneRow = funnel.find((x) => x[0] === 'secret_completed');
  const steps = [
    { name: 'Opened', n: openedRow ? Number(openedRow[2]) : fallbackOpened, wrong: 0 },
    { name: 'L1 · Hallucination', n: stage('hallucination'), wrong: wrong('hallucination') },
    { name: 'L2 · Turing', n: stage('turing'), wrong: wrong('turing') },
    { name: 'L3 · Tokens', n: stage('tokens'), wrong: wrong('tokens') },
    { name: 'Completed', n: doneRow ? Number(doneRow[2]) : fallbackDone, wrong: 0 },
  ];
  const top = Math.max(steps[0].n, 1);
  return (
    <div className="cc-funnel">
      {steps.map((s, i) => (
        <div className="cc-funnel-bar" key={s.name} style={{ width: `${Math.max(9, (s.n / top) * 100)}%` }}>
          <span className="cc-funnel-name">{s.name}</span>
          <span className="cc-funnel-meta">
            {s.n}
            {i > 0 && i < 4 && s.wrong > 0 && <span className="cc-funnel-pct">{s.wrong} wrong</span>}
            {i > 0 && <span className="cc-funnel-pct">{Math.round((s.n / top) * 100)}%</span>}
          </span>
        </div>
      ))}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number; tone?: 'blue' | 'cyan'; spark?: number[] }> = ({ label, value, tone, spark }) => {
  const v = useCountUp(value);
  return (
    <div className="cc-card cc-kpi">
      <p className="cc-kpi-label">{label}</p>
      <p className={`cc-kpi-val ${tone || ''}`}>{fmt(v)}</p>
      <div className="cc-kpi-foot">{spark && spark.length > 1 ? <Sparkline values={spark} color={tone === 'cyan' ? '#22d3ee' : '#38bdf8'} /> : <span />}</div>
    </div>
  );
};

// ── visitor drill-down drawer ──────────────────────────────────────────────
const Drawer: React.FC<{ num: string; data: VisitorData | null; onClose: () => void }> = ({ num, data, onClose }) => {
  const p = data?.profile || [];
  const tl = data?.timeline || [];
  const fact = (i: number) => (p[i] != null && p[i] !== '' ? String(p[i]) : '—');
  const wrongByStage: Record<string, number> = {};
  const appTime: Record<string, number> = {};
  tl.forEach((r) => {
    if (r[1] === 'secret_wrong_answer' && r[3]) wrongByStage[String(r[3])] = (wrongByStage[String(r[3])] || 0) + 1;
    if (r[1] === 'app_closed' && r[5]) appTime[String(r[2])] = (appTime[String(r[2])] || 0) + Number(r[5]);
  });
  const stagesPassed = tl.filter((r) => r[1] === 'secret_stage_passed').map((r) => String(r[3]));
  const did = (ev: string) => tl.some((r) => r[1] === ev);

  return (
    <>
      <div className="cc-drawer-scrim" onClick={onClose} />
      <aside className="cc-drawer">
        <div className="cc-drawer-head">
          <div>
            <div className="cc-drawer-id">{num}</div>
            <div className="cc-sub">{[fact(1), fact(0)].filter((x) => x !== '—').join(', ') || 'Unknown location'}</div>
          </div>
          <button className="cc-drawer-close" onClick={onClose}>✕</button>
        </div>

        {!data ? <div className="cc-empty">Loading visitor…</div> : (
          <>
            <div className="cc-drawer-badges">
              {did('resume_downloaded') && <span className="cc-badge dl">⬇ Resume</span>}
              {did('secret_completed') && <span className="cc-badge mx">🏆 Beat the Matrix</span>}
              {did('contact_submitted') && <span className="cc-badge ct">✉ Contacted</span>}
              {stagesPassed.map((s, i) => <span key={i} className="cc-badge">L{STAGE_NO[s] || '?'} {s}✓</span>)}
            </div>

            <div className="cc-facts">
              <div><div className="cc-fact-k">Region</div><div className="cc-fact-v">{[fact(2), fact(0)].filter((x) => x !== '—').join(', ') || '—'}</div></div>
              <div><div className="cc-fact-k">Timezone</div><div className="cc-fact-v">{fact(9)}</div></div>
              <div><div className="cc-fact-k">Device</div><div className="cc-fact-v">{fact(3)} · {fact(5)}</div></div>
              <div><div className="cc-fact-k">Browser</div><div className="cc-fact-v">{fact(4)}</div></div>
              <div><div className="cc-fact-k">Screen</div><div className="cc-fact-v">{p[6] ? `${p[6]}×${p[7]}` : '—'}</div></div>
              <div><div className="cc-fact-k">Referrer</div><div className="cc-fact-v">{fact(8)}</div></div>
              <div><div className="cc-fact-k">Sessions</div><div className="cc-fact-v">{fact(13)}</div></div>
              <div><div className="cc-fact-k">Total events</div><div className="cc-fact-v">{fact(12)}</div></div>
              <div><div className="cc-fact-k">First seen</div><div className="cc-fact-v">{p[10] ? fmtDay(String(p[10])) : '—'}</div></div>
              <div><div className="cc-fact-k">Last seen</div><div className="cc-fact-v">{p[11] ? fmtDay(String(p[11])) : '—'}</div></div>
            </div>

            {Object.keys(appTime).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p className="cc-tl-title">Time per app</p>
                <Bars rows={Object.entries(appTime).sort((a, b) => b[1] - a[1]).map(([a, s]) => [a, s])} suffix={(v) => secs(v)} />
              </div>
            )}

            <p className="cc-tl-title">Timeline · {tl.length} events</p>
            <div className="cc-timeline">
              {tl.length === 0 && <div className="cc-empty">No events.</div>}
              {tl.map((r, i) => {
                const ev = String(r[1]);
                const stageName = r[3] ? String(r[3]) : '';
                let meta = '';
                if (ev === 'app_opened' || ev === 'app_closed') meta = String(r[2] || '');
                if (ev === 'app_closed' && r[5]) meta += ` · ${secs(Number(r[5]))}`;
                if (ev === 'secret_stage_passed') meta = `Level ${STAGE_NO[stageName] || '?'} · ${stageName}`;
                if (ev === 'secret_wrong_answer') meta = `Level ${STAGE_NO[stageName] || '?'} · wrong answer`;
                return (
                  <div className={`cc-tl-row ${TROPHY.has(ev) ? 'trophy' : ''}`} key={i}>
                    <div className="cc-tl-ev">{EV_ICON[ev] || '•'} {pretty(ev)}</div>
                    {meta && <div className="cc-tl-meta">{meta}</div>}
                    <div className="cc-tl-time">{fmtTime(String(r[0]))}</div>
                  </div>
                );
              })}
            </div>
            <p className="cc-hint">Watch the actual recording: <a className="cc-link" href="https://us.posthog.com/replay" target="_blank" rel="noreferrer">Session replays →</a></p>
          </>
        )}
      </aside>
    </>
  );
};

const Gate: React.FC<{ onSubmit: (pw: string) => void; error: string; busy: boolean }> = ({ onSubmit, error, busy }) => {
  const [pw, setPw] = useState('');
  return (
    <div className="cc-gate">
      <form className="cc-gate-card" onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }}>
        <p className="cc-gate-badge">Restricted</p>
        <h1 className="cc-gate-title">CONTROL CENTER</h1>
        <input className="cc-input" type="password" placeholder="ACCESS KEY" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="cc-btn" type="submit" disabled={busy}>{busy ? 'AUTHORIZING…' : 'ENTER'}</button>
        <p className="cc-gate-err">{error}</p>
      </form>
    </div>
  );
};

// ── main ─────────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const [pw, setPw] = useState<string>(() => sessionStorage.getItem('cc_pw') || '');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [openNum, setOpenNum] = useState<string | null>(null);
  const [visitor, setVisitor] = useState<VisitorData | null>(null);

  const load = useCallback(async (password: string, d: number, silent = false) => {
    if (!silent) setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/ph', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, mode: 'overview', days: d }),
      });
      if (res.status === 401) { setError('Wrong access key.'); setAuthed(false); sessionStorage.removeItem('cc_pw'); return; }
      if (!res.ok) throw new Error(`server ${res.status}`);
      setData((await res.json()) as Data);
      setAuthed(true); setError(''); setSample(false); setUpdated(new Date());
      sessionStorage.setItem('cc_pw', password);
    } catch {
      if (import.meta.env.DEV) { setData({ ...SAMPLE, days: d }); setAuthed(true); setSample(true); setError(''); setUpdated(new Date()); sessionStorage.setItem('cc_pw', password); }
      else setError('Could not reach the analytics server. Make sure the Netlify env vars are set, then redeploy.');
    } finally { setBusy(false); }
  }, []);

  const openVisitor = useCallback(async (personId: string, num: string) => {
    setOpenNum(num); setVisitor(null);
    try {
      const res = await fetch('/.netlify/functions/ph', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, mode: 'visitor', personId }),
      });
      if (!res.ok) throw new Error('x');
      setVisitor((await res.json()) as VisitorData);
    } catch {
      if (import.meta.env.DEV) setVisitor(SAMPLE_VISITOR);
    }
  }, [pw]);

  useEffect(() => { if (pw) load(pw, days, true); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => load(pw, days, true), 60000);
    return () => window.clearInterval(id);
  }, [authed, pw, days, load]);

  if (!authed || !data) return <div className="cc-root"><Gate onSubmit={(p) => { setPw(p); load(p, days); }} error={error} busy={busy} /></div>;

  const k = data.kpis;
  const trendVals = data.trend.map((r) => Number(r[1]) || 0);
  const resumeConv = k.visitors ? ((k.resume / k.visitors) * 100).toFixed(1) : '0';
  const maxHour = Math.max(...data.hours.map((h) => Number(h[1]) || 0), 1);

  // stable "Visitor 001" numbering by first-seen order; display newest-active first
  const byFirst = [...data.visitorList].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const numOf = new Map<string, string>();
  byFirst.forEach((r, i) => numOf.set(String(r[0]), 'Visitor ' + String(i + 1).padStart(3, '0')));
  const rows = [...data.visitorList].sort((a, b) => String(b[2]).localeCompare(String(a[2])));

  return (
    <div className="cc-root">
      <h2 className="sr-only">Mohamed Tabari portfolio — private analytics control center</h2>
      <div className="cc-wrap">
        <header className="cc-header">
          <span className="cc-live" />
          <div>
            <h1 className="cc-title">CONTROL <span>CENTER</span></h1>
            <p className="cc-sub">mohamedtabari.com {sample && '· SAMPLE DATA (dev)'}</p>
          </div>
          <div className="cc-header-right">
            <span className="cc-refresh cc-mono">{updated ? `synced ${updated.toLocaleTimeString()}` : ''}</span>
            <div className="cc-range">
              {RANGES.map((r) => <button key={r.d} className={days === r.d ? 'on' : ''} onClick={() => { setDays(r.d); load(pw, r.d, true); }}>{r.label}</button>)}
            </div>
          </div>
        </header>

        <div className="cc-kpis">
          <Kpi label="Visitors" value={k.visitors} tone="blue" spark={trendVals} />
          <Kpi label="Sessions" value={k.sessions} />
          <Kpi label="Resume Downloads" value={k.resume} tone="cyan" />
          <Kpi label="Matrix Beaten" value={k.matrix} tone="blue" />
          <Kpi label="Messages" value={k.contacts} />
        </div>

        <div className="cc-grid">
          <div className="cc-card cc-col-8">
            <p className="cc-card-title">Visitors over time <span className="cc-count">resume conversion {resumeConv}%</span></p>
            <AreaChart trend={data.trend} />
          </div>
          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Secret Files funnel</p>
            <Funnel funnel={data.funnel} attempts={data.attempts} fallbackOpened={k.secretOpened} fallbackDone={k.matrix} />
          </div>

          {/* VISITOR TABLE — click a row to drill in */}
          <div className="cc-card cc-col-12">
            <p className="cc-card-title">Visitors <span className="cc-count">{rows.length} profiles · click any row</span></p>
            {rows.length === 0 ? <div className="cc-empty">No visitors in this range yet.</div> : (
              <div className="cc-table-scroll">
                <table className="cc-table">
                  <thead><tr><th>ID</th><th>Location</th><th>Device</th><th>First seen</th><th>Last seen</th><th>Events</th><th>Flags</th></tr></thead>
                  <tbody>
                    {rows.map((r) => {
                      const id = String(r[0]);
                      return (
                        <tr className="cc-row" key={id} onClick={() => openVisitor(id, numOf.get(id) || 'Visitor')}>
                          <td className="cc-vid">{numOf.get(id)}</td>
                          <td>{[r[5], r[4]].filter(Boolean).join(', ') || '—'}</td>
                          <td>{[r[6], r[7]].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="cc-mono">{r[1] ? fmtDay(String(r[1])) : '—'}</td>
                          <td className="cc-mono">{r[2] ? fmtDay(String(r[2])) : '—'}</td>
                          <td>{r[3]}</td>
                          <td><div className="cc-badges">
                            {Number(r[8]) > 0 && <span className="cc-badge dl">⬇</span>}
                            {Number(r[9]) > 0 && <span className="cc-badge mx">🏆</span>}
                            {Number(r[10]) > 0 && <span className="cc-badge ct">✉</span>}
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="cc-card cc-col-4"><p className="cc-card-title">Top countries</p><Bars rows={data.geo} /></div>
          <div className="cc-card cc-col-4"><p className="cc-card-title">Time spent per app</p><Bars rows={data.appTime} suffix={(v) => secs(v)} /></div>
          <div className="cc-card cc-col-4"><p className="cc-card-title">App opens</p><Bars rows={data.appOpens} /></div>
          <div className="cc-card cc-col-4"><p className="cc-card-title">Devices</p><Bars rows={data.devices} /></div>
          <div className="cc-card cc-col-4"><p className="cc-card-title">Operating systems</p><Bars rows={data.os} /></div>
          <div className="cc-card cc-col-4"><p className="cc-card-title">Referrers</p><Bars rows={data.referrers} /></div>

          <div className="cc-card cc-col-8">
            <p className="cc-card-title">Live activity</p>
            <div className="cc-feed">
              {data.recent.length === 0 && <div className="cc-empty">No custom events yet.</div>}
              {data.recent.map((r, i) => {
                const ev = String(r[1]); const trophy = TROPHY.has(ev);
                return (
                  <div className="cc-feed-row" key={i}>
                    <span className={`cc-feed-ico ${trophy ? 'cc-trophy' : ''}`}>{EV_ICON[ev] || '•'}</span>
                    <div className="cc-feed-main">
                      <div className="cc-feed-ev">{pretty(ev)}{r[2] ? ` · ${r[2]}` : ''}</div>
                      <div className="cc-feed-sub">{r[3] || 'Unknown location'}</div>
                    </div>
                    <span className="cc-feed-time cc-mono">{fmtTime(String(r[0]))}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Busiest hours (UTC)</p>
            <div className="cc-hours">
              {data.hours.map((h, i) => (
                <div key={i} className="cc-hour" title={`${h[0]}:00 — ${h[1]} events`}
                  style={{ background: `rgba(56,189,248,${0.08 + 0.9 * ((Number(h[1]) || 0) / maxHour)})` }}>
                  {i % 6 === 0 && <span>{h[0]}</span>}
                </div>
              ))}
            </div>
            <p className="cc-hint">Darker = more activity.</p>
          </div>
        </div>
      </div>

      {openNum && <Drawer num={openNum} data={visitor} onClose={() => { setOpenNum(null); setVisitor(null); }} />}
    </div>
  );
};

export default AdminDashboard;
