import React, { useCallback, useEffect, useRef, useState } from 'react';
import './admin.css';

// CONTROL CENTER — the private /admin dashboard. It never holds the PostHog
// key; it POSTs { password, days } to the Netlify function, which validates
// the password server-side and returns the analytics bundle. In local dev the
// function isn't running, so we fall back to clearly-labelled SAMPLE data so
// the visuals can still be seen.

type Row = (string | number | null)[];
interface Data {
  days: number;
  kpis: { visitors: number; sessions: number; resume: number; matrix: number; contacts: number; secretOpened: number };
  trend: Row[]; geo: Row[]; devices: Row[]; browsers: Row[]; referrers: Row[];
  appOpens: Row[]; appTime: Row[]; funnel: Row[]; hours: Row[]; recent: Row[]; recentResume: Row[];
}

const RANGES = [
  { d: 1, label: '24H' },
  { d: 7, label: '7D' },
  { d: 30, label: '30D' },
  { d: 90, label: '90D' },
];

// ── sample data (DEV only, so the design is viewable without the backend) ────
const SAMPLE: Data = {
  days: 7,
  kpis: { visitors: 1284, sessions: 1512, resume: 37, matrix: 9, contacts: 6, secretOpened: 61 },
  trend: [['Mon', 120], ['Tue', 168], ['Wed', 143], ['Thu', 205], ['Fri', 262], ['Sat', 188], ['Sun', 198]],
  geo: [['United States', 512], ['Morocco', 341], ['United Kingdom', 122], ['Germany', 98], ['Canada', 76], ['France', 61], ['UAE', 44], ['India', 30]],
  devices: [['Desktop', 903], ['Mobile', 341], ['Tablet', 40]],
  browsers: [['Chrome', 812], ['Safari', 288], ['Edge', 121], ['Firefox', 63]],
  referrers: [['linkedin.com', 322], ['github.com', 141], ['google.com', 96], ['t.co', 44]],
  appOpens: [['showcase', 1180], ['secret', 61], ['radio', 233], ['minesweeper', 174], ['browser', 88]],
  appTime: [['radio', 214], ['minesweeper', 132], ['showcase', 96], ['secret', 71], ['browser', 34]],
  funnel: [['secret_opened', null, 61], ['secret_stage_passed', 'hallucination', 44], ['secret_stage_passed', 'turing', 27], ['secret_stage_passed', 'tokens', 12], ['secret_completed', null, 9]],
  hours: Array.from({ length: 24 }, (_, h) => [h, Math.round(20 + 60 * Math.sin((h - 6) / 24 * Math.PI) ** 2)]),
  recent: [
    [new Date(Date.now() - 40_000).toISOString(), 'resume_downloaded', null, 'United States'],
    [new Date(Date.now() - 5 * 60_000).toISOString(), 'secret_completed', null, 'Morocco'],
    [new Date(Date.now() - 12 * 60_000).toISOString(), 'app_opened', 'radio', 'Germany'],
    [new Date(Date.now() - 26 * 60_000).toISOString(), 'contact_submitted', null, 'United Kingdom'],
    [new Date(Date.now() - 44 * 60_000).toISOString(), 'minesweeper_result', null, 'Canada'],
  ],
  recentResume: [
    [new Date(Date.now() - 40_000).toISOString(), 'Austin', 'United States'],
    [new Date(Date.now() - 3 * 3600_000).toISOString(), 'Casablanca', 'Morocco'],
    [new Date(Date.now() - 9 * 3600_000).toISOString(), 'London', 'United Kingdom'],
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
function rel(iso: string): string {
  const t = new Date(iso).getTime();
  const d = Math.max(0, Date.now() - t);
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    // safety: if rAF is throttled (e.g. a backgrounded tab), still land the
    // final value so a number is never stuck mid-animation
    const safety = window.setTimeout(() => { setV(target); from.current = target; }, ms + 200);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(safety); };
  }, [target, ms]);
  return v;
}

const EV_ICON: Record<string, string> = {
  resume_downloaded: '⬇', secret_completed: '🏆', contact_submitted: '✉',
  app_opened: '🪟', app_closed: '✖', experience_started: '▶',
  radio_play: '♪', minesweeper_result: '💣', secret_opened: '🔓',
  secret_stage_passed: '🧩', secret_gave_up: '🚪', secret_failed: '☠',
};
const TROPHY = new Set(['resume_downloaded', 'secret_completed', 'contact_submitted']);

// ── mini charts (dependency-free SVG) ────────────────────────────────────
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
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
  return (
    <svg className="cc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff3be0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="ccStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ff3be0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ccFill)" />
      <polyline points={line} fill="none" stroke="url(#ccStroke)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#fff" stroke="#ff3be0" strokeWidth="1.5" />
      ))}
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

const Funnel: React.FC<{ funnel: Row[]; fallbackOpened: number; fallbackDone: number }> = ({ funnel, fallbackOpened, fallbackDone }) => {
  const stage = (name: string) => {
    const r = funnel.find((x) => x[0] === 'secret_stage_passed' && x[1] === name);
    return r ? Number(r[2]) : 0;
  };
  const openedRow = funnel.find((x) => x[0] === 'secret_opened');
  const doneRow = funnel.find((x) => x[0] === 'secret_completed');
  const steps = [
    { name: 'Opened', n: openedRow ? Number(openedRow[2]) : fallbackOpened },
    { name: 'Hallucination', n: stage('hallucination') },
    { name: 'Turing', n: stage('turing') },
    { name: 'Tokens', n: stage('tokens') },
    { name: 'Completed', n: doneRow ? Number(doneRow[2]) : fallbackDone },
  ];
  const top = Math.max(steps[0].n, 1);
  return (
    <div className="cc-funnel">
      {steps.map((s, i) => (
        <div className="cc-funnel-step" key={s.name}>
          <div className="cc-funnel-bar" style={{ width: `${Math.max(8, (s.n / top) * 100)}%` }}>
            <span className="cc-funnel-name">{s.name}</span>
            <span className="cc-funnel-meta">
              {s.n}
              {i > 0 && <span className="cc-funnel-pct">{top ? Math.round((s.n / top) * 100) : 0}%</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── KPI card ─────────────────────────────────────────────────────────────
const Kpi: React.FC<{ label: string; value: number; tone?: 'mag' | 'cyan'; spark?: number[] }> = ({ label, value, tone, spark }) => {
  const v = useCountUp(value);
  return (
    <div className="cc-card cc-kpi">
      <p className="cc-kpi-label">{label}</p>
      <p className={`cc-kpi-val ${tone || ''}`}>{fmt(v)}</p>
      <div className="cc-kpi-foot">
        {spark && spark.length > 1 ? <Sparkline values={spark} color={tone === 'cyan' ? '#22d3ee' : '#ff3be0'} /> : <span />}
      </div>
    </div>
  );
};

// ── gate ─────────────────────────────────────────────────────────────────
const Gate: React.FC<{ onSubmit: (pw: string) => void; error: string; busy: boolean }> = ({ onSubmit, error, busy }) => {
  const [pw, setPw] = useState('');
  return (
    <div className="cc-gate">
      <form className="cc-gate-card" onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }}>
        <p className="cc-gate-badge">Restricted</p>
        <h1 className="cc-gate-title">CONTROL CENTER</h1>
        <input
          className="cc-input" type="password" placeholder="ACCESS KEY" autoFocus
          value={pw} onChange={(e) => setPw(e.target.value)}
        />
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

  const load = useCallback(async (password: string, d: number, silent = false) => {
    if (!silent) setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/ph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, days: d }),
      });
      if (res.status === 401) { setError('Wrong access key.'); setAuthed(false); sessionStorage.removeItem('cc_pw'); return; }
      if (!res.ok) throw new Error(`server ${res.status}`);
      const payload = (await res.json()) as Data;
      setData(payload); setAuthed(true); setError(''); setSample(false); setUpdated(new Date());
      sessionStorage.setItem('cc_pw', password);
    } catch {
      // dev / backend-not-deployed: show sample so the design is visible
      if (import.meta.env.DEV) {
        setData({ ...SAMPLE, days: d }); setAuthed(true); setSample(true); setError(''); setUpdated(new Date());
        sessionStorage.setItem('cc_pw', password);
      } else {
        setError('Could not reach the analytics server. Make sure the Netlify env vars are set.');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // auto-login if a key is already stored this session
  useEffect(() => {
    if (pw) load(pw, days, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-refresh every 60s while authed
  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => load(pw, days, true), 60000);
    return () => window.clearInterval(id);
  }, [authed, pw, days, load]);

  const pickRange = (d: number) => { setDays(d); load(pw, d, true); };
  const onGate = (password: string) => { setPw(password); load(password, days); };

  if (!authed || !data) return <div className="cc-root"><Gate onSubmit={onGate} error={error} busy={busy} /></div>;

  const k = data.kpis;
  const trendVals = data.trend.map((r) => Number(r[1]) || 0);
  const resumeConv = k.visitors ? ((k.resume / k.visitors) * 100).toFixed(1) : '0';
  const maxHour = Math.max(...data.hours.map((h) => Number(h[1]) || 0), 1);

  return (
    <div className="cc-root">
      <h2 className="sr-only">Mohamed Tabari portfolio — private analytics control center</h2>
      <div className="cc-wrap">
        <header className="cc-header">
          <span className="cc-live" />
          <div className="cc-brand">
            <div>
              <h1 className="cc-title">CONTROL <span>CENTER</span></h1>
              <p className="cc-sub">mohamedtabari.com {sample && '· SAMPLE DATA (dev)'}</p>
            </div>
          </div>
          <div className="cc-header-right">
            <span className="cc-refresh cc-mono">{updated ? `synced ${updated.toLocaleTimeString()}` : ''}</span>
            <div className="cc-range">
              {RANGES.map((r) => (
                <button key={r.d} className={days === r.d ? 'on' : ''} onClick={() => pickRange(r.d)}>{r.label}</button>
              ))}
            </div>
          </div>
        </header>

        <div className="cc-kpis">
          <Kpi label="Visitors" value={k.visitors} tone="mag" spark={trendVals} />
          <Kpi label="Sessions" value={k.sessions} />
          <Kpi label="Resume Downloads" value={k.resume} tone="cyan" />
          <Kpi label="Matrix Beaten" value={k.matrix} tone="mag" />
          <Kpi label="Messages" value={k.contacts} />
        </div>

        <div className="cc-grid">
          <div className="cc-card cc-col-8">
            <p className="cc-card-title">Visitors over time · resume conversion {resumeConv}%</p>
            <AreaChart trend={data.trend} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Secret Files funnel</p>
            <Funnel funnel={data.funnel} fallbackOpened={k.secretOpened} fallbackDone={k.matrix} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Top countries</p>
            <Bars rows={data.geo} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Time spent per app</p>
            <Bars rows={data.appTime} suffix={(v) => secs(v)} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">App opens</p>
            <Bars rows={data.appOpens} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Devices</p>
            <Bars rows={data.devices} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Referrers</p>
            <Bars rows={data.referrers} />
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Busiest hours (UTC)</p>
            <div className="cc-hours">
              {data.hours.map((h, i) => (
                <div key={i} className="cc-hour" title={`${h[0]}:00 — ${h[1]}`}
                  style={{ background: `rgba(255,59,224,${0.08 + 0.9 * ((Number(h[1]) || 0) / maxHour)})` }}>
                  {i % 6 === 0 && <span>{h[0]}</span>}
                </div>
              ))}
            </div>
            <p className="cc-hint">Darker = more activity.</p>
          </div>

          <div className="cc-card cc-col-8">
            <p className="cc-card-title">Live activity</p>
            <div className="cc-feed">
              {data.recent.length === 0 && <div className="cc-empty">No custom events yet.</div>}
              {data.recent.map((r, i) => {
                const ev = String(r[1]);
                const trophy = TROPHY.has(ev);
                return (
                  <div className="cc-feed-row" key={i}>
                    <span className={`cc-feed-ico ${trophy ? 'cc-trophy' : ''}`}>{EV_ICON[ev] || '•'}</span>
                    <div className="cc-feed-main">
                      <div className="cc-feed-ev">{ev.replace(/_/g, ' ')}{r[2] ? ` · ${r[2]}` : ''}</div>
                      <div className="cc-feed-sub">{r[3] || 'Unknown location'}</div>
                    </div>
                    <span className="cc-feed-time cc-mono">{rel(String(r[0]))}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cc-card cc-col-4">
            <p className="cc-card-title">Recent resume downloads</p>
            <div className="cc-feed">
              {data.recentResume.length === 0 && <div className="cc-empty">None yet.</div>}
              {data.recentResume.map((r, i) => (
                <div className="cc-feed-row" key={i}>
                  <span className="cc-feed-ico cc-trophy">{'⬇'}</span>
                  <div className="cc-feed-main">
                    <div className="cc-feed-ev">{[r[1], r[2]].filter(Boolean).join(', ') || 'Unknown'}</div>
                  </div>
                  <span className="cc-feed-time cc-mono">{rel(String(r[0]))}</span>
                </div>
              ))}
            </div>
            <p className="cc-hint">
              Want the video of a visit? <a className="cc-link" href="https://us.posthog.com/replay" target="_blank" rel="noreferrer">Session replays →</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
