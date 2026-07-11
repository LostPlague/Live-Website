import React, { useEffect, useRef, useState } from 'react';

// CONTROL CENTER ui kit — types, formatting, icons, and dependency-free SVG
// charts. Design rules (validated): categorical palette in fixed order, values
// and labels always in ink (never series color), thin marks with 2px gaps,
// hover tooltips on every plot, sequential ramps are one hue.

// ── types ────────────────────────────────────────────────────────────────────
export type Row = (string | number | null)[];

export interface Visitor {
  id: string; num: string; first: string; last: string;
  events: number; custom: number; sessions: number;
  resume: boolean; matrix: boolean; contact: boolean;
  stages: number; started: boolean; dwell: number; apps: number;
  country: string | null; city: string | null; device: string | null; browser: string | null;
  lat: number | null; lon: number | null;
  returning: boolean; score: number; class: 'hot' | 'explorer' | 'passerby';
}
export interface OwnerInfo {
  num: string; first: string; last: string; events: number; sessions: number;
  dwell: number; country: string | null; city: string | null;
  device: string | null; browser: string | null;
}
export interface Kpis {
  visitors: number; visitorsPrev: number; sessions: number; sessionsPrev: number;
  resume: number; resumePrev: number; matrix: number; matrixPrev: number;
  contacts: number; contactsPrev: number; links: number; linksPrev: number;
  returning: number;
}
export interface OverviewData {
  days: number; tz: string; kpis: Kpis;
  trend: Row[]; funnel: Row[]; referrers: Row[]; recent: Row[]; live: Row[];
  visitors: Visitor[]; owner: OwnerInfo | null; botCount: number;
}
export interface VisitorsData { visitors: Visitor[]; owner: OwnerInfo | null; botCount: number; bots: Row[]; }
export interface VisitorDetail { profile: Row; timeline: Row[]; replayBase: string; }
export interface ChallengeData {
  stages: Row[];
  totals: { opened: number; completed: number; gaveUp: number; failed: number; openedPeople: number; completedPeople: number };
  winners: Row[];
}
export interface ContentData {
  apps: Row[]; sections: Row[]; links: Row[]; hesitation: Row[];
  media: {
    radioPlays: number; radioSeconds: number; mineGames: number; mineWins: number;
    mineAvgWin: number; mineAvgClicks: number; mineAvgFlags: number;
  };
  room: {
    introAvg: number; wideAvg: number; deskAvg: number; monitorAvg: number; orbitAvg: number;
    afkAvg: number; played: number; summaries: number; starts: number; abandons: number;
  };
  hesitationConv: Record<string, number>;
}
export interface SystemData {
  devices: Row[]; browsers: Row[]; oses: Row[]; screens: Row[]; heat: Row[]; tz: string; topErrors: Row[];
  vitals: { lcp: number; fcp: number; cls: number; inp: number; samples: number };
  perf: { fpsAvg: number; fpsMin: number; fpsSamples: number; rage: number; dead: number; errors: number; webglFails: number };
}

// ── palette (validated against #0b1626, dark band, CVD-safe order) ──────────
export const CAT = ['#3b82f6', '#d97706', '#8b5cf6', '#059669', '#ec4899'];
export const SEQ = (t: number) => `rgba(59, 130, 246, ${0.10 + 0.85 * Math.max(0, Math.min(1, t))})`;
export const GOOD = '#34d399';
export const BAD = '#fb7185';

// ── formatting ───────────────────────────────────────────────────────────────
export const fmt = (n: number) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n));
export const secs = (s: number) => {
  s = Math.round(s);
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
};
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function useCountUp(target: number, ms = 800): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    // reduced motion: numbers are state, not theater — render final value at once
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setV(target); from.current = target;
        return;
      }
    } catch { /* ignore */ }
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

// ── icons (inline SVG, stroke style — no emoji anywhere) ────────────────────
const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><path d="M16 5.4a3.5 3.5 0 0 1 0 5.2" /><path d="M18.4 15.6c1.6.8 2.7 2.3 3.1 4.4" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="10" y="10" width="4" height="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" /></>,
  download: <><path d="M12 3v11" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4.5a0 0 0 0 0 0 0c0 2.8 1 4.5 2.9 5M17 5h2.5c0 2.8-1 4.5-2.9 5" /><path d="M12 14v4M8 21h8M10 18h4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  play: <path d="M7 4.5 19 12 7 19.5V4.5Z" />,
  bomb: <><circle cx="10" cy="14" r="7" /><path d="m15 9 2-2M17 7l1.5-1.5M17 7l1 1M17 7l-1-1" /></>,
  puzzle: <><path d="M9 4h6v4a2 2 0 1 0 4 0h1v12H4V8h3a2 2 0 1 0 2-2V4Z" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  door: <><path d="M4 21V4a1 1 0 0 1 1-1h9v18" /><path d="M14 21h6" /><circle cx="11" cy="12" r="1" /></>,
  skull: <><path d="M12 3a8 8 0 0 0-8 8c0 2.5 1 4.4 3 5.6V20h10v-3.4c2-1.2 3-3.1 3-5.6a8 8 0 0 0-8-8Z" /><circle cx="9" cy="11" r="1.4" /><circle cx="15" cy="11" r="1.4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.7 2.6 4 5.6 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.6-4-9s1.3-6.4 4-9Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M9 21h6M12 17v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></>,
  export: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 15v4h16v-4" /></>,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  down: <path d="M12 5v14M5 12l7 7 7-7" />,
  pulse: <path d="M3 12h4l2.5-7 5 14L17 12h4" />,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7 0l2.5-2.5a5 5 0 0 0-7-7L11 6" /><path d="M14 10a5 5 0 0 0-7 0l-2.5 2.5a5 5 0 0 0 7 7L13 18" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  refresh: <><path d="M20 8A8.5 8.5 0 0 0 5 7L3 9" /><path d="M3 4v5h5" /><path d="M4 16a8.5 8.5 0 0 0 15 1l2-2" /><path d="M21 20v-5h-5" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6" /></>,
  flame: <path d="M12 3s5.5 4.5 5.5 10a5.5 5.5 0 0 1-11 0c0-2 .8-3.7 1.8-5 .3 1.3 1 2.3 2.2 2.7C10 8.5 10.6 5.5 12 3Z" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  foot: <><path d="M8 4c2 0 3 1.6 3 3.5S9.8 12 8.5 12 6 10.5 6 8.5 6.5 4 8 4Z" /><path d="M7 14.5c1.7 0 3 1 3 2.7S8.8 20 7.8 20 5.5 19 5.5 17.5 5.8 14.5 7 14.5Z" /><path d="M16 8c1.5 0 2.5 1.4 2.5 3s-1 4-2.2 4S14 13.5 14 11.7 14.5 8 16 8Z" /></>,
  pin: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8Z" />,
  window: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></>,
  bot: <><rect x="5" y="8" width="14" height="11" rx="2" /><circle cx="9.5" cy="13" r="1.3" /><circle cx="14.5" cy="13" r="1.3" /><path d="M12 8V4M12 4h3" /></>,
  key: <><circle cx="8" cy="14" r="4.5" /><path d="m11.5 10.5 8-8M17 4l3 3M14.5 6.5l3 3" /></>,
  spark: <path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />,
};

export const Icon: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 16, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name] || <circle cx="12" cy="12" r="4" />}
  </svg>
);

export const EV_ICON: Record<string, string> = {
  resume_downloaded: 'download', secret_completed: 'trophy', contact_submitted: 'mail',
  app_opened: 'window', app_closed: 'x', experience_started: 'play',
  radio_play: 'music', radio_listened: 'music', minesweeper_result: 'bomb',
  secret_opened: 'lock', secret_stage_passed: 'puzzle', secret_wrong_answer: 'x',
  secret_gave_up: 'door', secret_failed: 'skull', section_viewed: 'file',
  link_clicked: 'link', $pageview: 'eye', $pageleave: 'out',
  element_hovered: 'eye', room_summary: 'globe', experience_abandoned: 'door',
  fps_sample: 'pulse', js_error: 'skull', webgl_failed: 'x',
  start_menu_opened: 'window', shutdown_clicked: 'out',
  $rageclick: 'x', $dead_click: 'x',
};
export const TROPHY_EV = new Set(['resume_downloaded', 'secret_completed', 'contact_submitted', 'link_clicked']);
export const STAGE_NO: Record<string, number> = { hallucination: 1, turing: 2, tokens: 3 };
export const CLASS_META: Record<string, { label: string; icon: string }> = {
  hot: { label: 'Hot lead', icon: 'flame' },
  explorer: { label: 'Explorer', icon: 'compass' },
  passerby: { label: 'Passerby', icon: 'foot' },
};

// ── layout primitives ────────────────────────────────────────────────────────
export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; span?: number; className?: string; children: React.ReactNode }> =
  ({ title, right, span = 12, className, children }) => (
    <section className={`cc-card cc-col-${span} ${className || ''}`}>
      {title != null && <header className="cc-card-title"><span>{title}</span>{right && <span className="cc-card-right">{right}</span>}</header>}
      {children}
    </section>
  );

export const Empty: React.FC<{ icon?: string; text: string; sub?: string }> = ({ icon = 'pulse', text, sub }) => (
  <div className="cc-empty">
    <Icon name={icon} size={22} />
    <p>{text}</p>
    {sub && <p className="cc-empty-sub">{sub}</p>}
  </div>
);

export const ClassChip: React.FC<{ k: string }> = ({ k }) => {
  const m = CLASS_META[k] || CLASS_META.passerby;
  return <span className={`cc-class cc-class-${k}`}><Icon name={m.icon} size={11} />{m.label}</span>;
};

const Delta: React.FC<{ cur: number; prev: number }> = ({ cur, prev }) => {
  if (prev === 0 && cur === 0) return <span className="cc-delta flat">—</span>;
  if (prev === 0) return <span className="cc-delta up"><Icon name="up" size={10} />new</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="cc-delta flat">±0%</span>;
  return (
    <span className={`cc-delta ${pct > 0 ? 'up' : 'down'}`}>
      <Icon name={pct > 0 ? 'up' : 'down'} size={10} />{Math.abs(pct)}%
    </span>
  );
};

export const Kpi: React.FC<{ label: string; icon: string; value: number; prev?: number; sub?: string }> =
  ({ label, icon, value, prev, sub }) => {
    const v = useCountUp(value);
    return (
      <div className="cc-card cc-kpi">
        <div className="cc-kpi-head"><Icon name={icon} size={14} /><span>{label}</span></div>
        <p className="cc-kpi-val">{fmt(v)}</p>
        <div className="cc-kpi-foot">
          {prev != null ? <Delta cur={value} prev={prev} /> : <span />}
          {sub && <span className="cc-kpi-sub">{sub}</span>}
        </div>
      </div>
    );
  };

// ── trend chart: area + line, ghost previous period, crosshair tooltip ──────
export const Trend: React.FC<{ rows: Row[]; days: number }> = ({ rows, days }) => {
  const [hover, setHover] = useState<number | null>(null);
  const byDate = new Map(rows.map((r) => [String(r[0]), Number(r[1]) || 0]));
  const today = new Date();
  const dates: string[] = [];
  for (let i = days * 2 - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const prev = dates.slice(0, days).map((d) => byDate.get(d) ?? 0);
  const cur = dates.slice(days).map((d) => byDate.get(d) ?? 0);
  const curDates = dates.slice(days);
  const W = 840, H = 240, padX = 10, padT = 14, padB = 26;
  const max = Math.max(...cur, ...prev, 1);
  const x = (i: number) => padX + (i / Math.max(1, days - 1)) * (W - padX * 2);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const pts = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const gridY = [0.25, 0.5, 0.75, 1].map((t) => padT + (1 - t) * (H - padT - padB));
  const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const tickEvery = Math.max(1, Math.ceil(days / 7));

  return (
    <div className="cc-trend-wrap">
      <svg className="cc-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(days - 1, Math.round(((px - padX) / (W - padX * 2)) * (days - 1)))));
        }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ccFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridY.map((gy, i) => <line key={i} x1={padX} x2={W - padX} y1={gy} y2={gy} className="cc-grid-line" />)}
        {days > 1 && <polyline points={pts(prev)} fill="none" className="cc-ghost-line" />}
        {days > 1 && <polygon points={`${x(0)},${H - padB} ${pts(cur)} ${x(days - 1)},${H - padB}`} fill="url(#ccFill)" />}
        {days > 1 && <polyline points={pts(cur)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {cur.map((v, i) => (days <= 31 || i === hover) && <circle key={i} cx={x(i)} cy={y(v)} r={i === hover ? 4.5 : 2.5} className={i === hover ? 'cc-dot-hot' : 'cc-dot'} />)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className="cc-crosshair" />}
        {curDates.map((d, i) => (i % tickEvery === 0) &&
          <text key={d} x={x(i)} y={H - 8} className="cc-axis-label" textAnchor="middle">{label(d)}</text>)}
      </svg>
      {hover != null && (
        <div className="cc-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <p className="cc-tooltip-title">{label(curDates[hover])}</p>
          <p><span className="cc-swatch" style={{ background: '#3b82f6' }} />{cur[hover]} visitor{cur[hover] === 1 ? '' : 's'}</p>
          <p className="cc-tooltip-muted"><span className="cc-swatch cc-swatch-ghost" />{prev[hover] ?? 0} previous period</p>
        </div>
      )}
      <div className="cc-legend">
        <span><span className="cc-swatch" style={{ background: '#3b82f6' }} />This period</span>
        <span><span className="cc-swatch cc-swatch-ghost" />Previous {days}d</span>
      </div>
    </div>
  );
};

// ── horizontal bars (thin marks, ink values, hover) ──────────────────────────
export const HBars: React.FC<{ rows: Row[]; format?: (v: number) => string; color?: string; emptyText?: string }> =
  ({ rows, format, color = '#3b82f6', emptyText = 'No data in this range yet.' }) => {
    if (!rows.length) return <Empty text={emptyText} />;
    const max = Math.max(...rows.map((r) => Number(r[1]) || 0), 1);
    return (
      <div className="cc-bars">
        {rows.map((r, i) => {
          const v = Number(r[1]) || 0;
          return (
            <div className="cc-bar" key={i} title={`${r[0]} — ${format ? format(v) : v}`}>
              <span className="cc-bar-label">{String(r[0])}</span>
              <span className="cc-bar-track"><span className="cc-bar-fill" style={{ width: `${(v / max) * 100}%`, background: color }} /></span>
              <span className="cc-bar-val">{format ? format(v) : fmt(v)}</span>
            </div>
          );
        })}
      </div>
    );
  };

// ── donut (categorical, 2px gaps, direct-labeled legend) ─────────────────────
export const Donut: React.FC<{ rows: Row[]; size?: number }> = ({ rows, size = 132 }) => {
  const [hot, setHot] = useState<number | null>(null);
  const data = rows.map((r) => ({ label: String(r[0]), v: Number(r[1]) || 0 })).filter((d) => d.v > 0);
  if (!data.length) return <Empty text="No data in this range yet." />;
  const total = data.reduce((a, b) => a + b.v, 0);
  const R = 44, C = 2 * Math.PI * R, gap = data.length > 1 ? 2.5 : 0;
  let acc = 0;
  return (
    <div className="cc-donut">
      <svg width={size} height={size} viewBox="0 0 110 110">
        {data.map((d, i) => {
          const len = (d.v / total) * C;
          const seg = (
            <circle key={i} cx="55" cy="55" r={R} fill="none"
              stroke={CAT[i % CAT.length]} strokeWidth={hot === i ? 15 : 12}
              strokeDasharray={`${Math.max(0.1, len - gap)} ${C - len + gap}`}
              strokeDashoffset={-acc + C / 4}
              onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <title>{d.label}: {d.v} ({Math.round((d.v / total) * 100)}%)</title>
            </circle>
          );
          acc += len;
          return seg;
        })}
        <text x="55" y="52" textAnchor="middle" className="cc-donut-total">{fmt(hot != null ? data[hot].v : total)}</text>
        <text x="55" y="66" textAnchor="middle" className="cc-donut-sub">{hot != null ? data[hot].label : 'total'}</text>
      </svg>
      <div className="cc-donut-legend">
        {data.map((d, i) => (
          <div key={i} className={`cc-donut-key ${hot === i ? 'on' : ''}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
            <span className="cc-swatch" style={{ background: CAT[i % CAT.length] }} />
            <span className="cc-donut-key-label">{d.label}</span>
            <span className="cc-donut-key-val">{d.v} · {Math.round((d.v / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 7×24 heatmap (sequential single hue) ─────────────────────────────────────
const DAYS_LBL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const Heatmap: React.FC<{ cells: Row[]; tz: string }> = ({ cells, tz }) => {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let max = 1;
  cells.forEach((r) => {
    const d = Number(r[0]) - 1, h = Number(r[1]), n = Number(r[2]) || 0;
    if (d >= 0 && d < 7 && h >= 0 && h < 24) { grid[d][h] = n; if (n > max) max = n; }
  });
  const any = cells.length > 0;
  if (!any) return <Empty text="No activity recorded in this range yet." />;
  return (
    <div>
      <div className="cc-heat">
        {grid.map((row, d) => (
          <React.Fragment key={d}>
            <span className="cc-heat-day">{DAYS_LBL[d]}</span>
            {row.map((n, h) => (
              <span key={h} className="cc-heat-cell" style={{ background: n ? SEQ(n / max) : 'rgba(255,255,255,0.04)' }}
                title={`${DAYS_LBL[d]} ${String(h).padStart(2, '0')}:00 — ${n} event${n === 1 ? '' : 's'}`} />
            ))}
          </React.Fragment>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="cc-heat-hour">{h % 6 === 0 ? String(h).padStart(2, '0') : ''}</span>
        ))}
      </div>
      <p className="cc-hint">Local time · {tz.replace(/_/g, ' ')}</p>
    </div>
  );
};

// ── world map: dot-matrix land + visitor markers ─────────────────────────────
const LAND = [
  '0000000000000000000111111011111110000000000000000000000000000000000000000000',
  '0000000000000001111111011111111111000000111000000000000000110000000000000000',
  '0000000000000111101110000111111111000000000000000010000011111100000110000000',
  '0000110000011111011111100011111110000000000100000100111111111111111111110000',
  '1101111111111111111111111011111000000000011111111111101111111111111111111111',
  '0001111111111111111010110001100001100000110111111111111111111111111111111111',
  '0011111111111111110001101000100000000001111111111111111111111111111111101000',
  '0000100000111111111100111000000000000101101111111111111111111111111000010000',
  '0000000000011111111111111100000000001101111111111111111111111111111100000000',
  '0000000000011111111111110110000000000111111111111111111111111111111100000000',
  '0000000000001111111111111000000000000111111100110111111111111111111010000000',
  '0000000000001111111111100000000000001100011111110111111111111111100100000000',
  '0000000000001111111111000000000000001111001011111111111111111111100100000000',
  '0000000000000111111110000000000000001111101001111111111111111111010000000000',
  '0000000000000111111010000000000000001111111111111111111111111111000000000000',
  '0000000000000011100001000000000000011111111111111011111111111110000000000000',
  '0000000000000001100101000000000000111111111111111110111111111100000000000000',
  '0000000000000000111001110000000000111111111111011100011100111001000000000000',
  '0000000000000000001100000000000000111111111111110000011000111001000000000000',
  '0000000000000000000010111000000000011111111111111000001000001000100000000000',
  '0000000000000000000001111110000000011111111111110000000000010010000000000000',
  '0000000000000000000001111110000000000000111111110000000000110110000000000000',
  '0000000000000000000001111111100000000000111111100000000000010111010000000000',
  '0000000000000000000001111111111000000000111111000000000000000001000111000000',
  '0000000000000000000001111111111000000000011111000000000000000011100101010000',
  '0000000000000000000001111111110000000000011111101000000000000000011000000000',
  '0000000000000000000000111111110000000000111111011000000000000000111010000000',
  '0000000000000000000000011111110000000000111110010000000000000001111110000000',
  '0000000000000000000000011111000000000000011111010000000000000011111111000000',
  '0000000000000000000000011111000000000000011110000000000000000011111111000000',
  '0000000000000000000000011110000000000000001100000000000000000011111111000000',
  '0000000000000000000000111100000000000000000000000000000000000000000111000010',
  '0000000000000000000000111000000000000000000000000000000000000000000000000001',
  '0000000000000000000000110000000000000000000000000000000000000000000010000010',
  '0000000000000000000000110000000000000000000000000000000000000000000000000000',
  '0000000000000000000000100000000000000000000000000000000000000000000000000000',
  '0000000000000000000000110000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000000000000000',
];
const MAP_W = 760, MAP_H = 380, CELL = 10;
const proj = (lat: number, lon: number) => ({
  x: ((lon + 180) / 360) * MAP_W,
  y: ((85 - lat) / 145) * MAP_H,
});

export const WorldMap: React.FC<{ visitors: Visitor[]; liveIds: Set<string> }> = ({ visitors, liveIds }) => {
  const dots = visitors.filter((v) => v.lat != null && v.lon != null);
  return (
    <div className="cc-map-wrap">
      <svg className="cc-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        {LAND.map((row, r) => {
          const out: React.ReactNode[] = [];
          for (let c = 0; c < row.length; c++) {
            if (row[c] === '1') out.push(<circle key={c} cx={c * CELL + CELL / 2} cy={r * CELL + CELL / 2} r="2.4" className="cc-map-land" />);
          }
          return <g key={r}>{out}</g>;
        })}
        {dots.map((v) => {
          const { x, y } = proj(v.lat as number, v.lon as number);
          const live = liveIds.has(v.id);
          return (
            <g key={v.id} className={live ? 'cc-map-live' : 'cc-map-visitor'}>
              <circle cx={x} cy={y} r={live ? 7 : 5.5} className="cc-map-halo" />
              <circle cx={x} cy={y} r="3.2" className="cc-map-dot" />
              <title>{v.num} · {[v.city, v.country].filter(Boolean).join(', ') || 'Unknown'}{live ? ' · ON SITE NOW' : ''}</title>
            </g>
          );
        })}
      </svg>
      <div className="cc-legend">
        <span><span className="cc-swatch" style={{ background: '#3b82f6' }} />Visitor</span>
        <span><span className="cc-swatch" style={{ background: GOOD }} />Live now</span>
        {dots.length === 0 && <span className="cc-legend-note">Locations appear when real visitors arrive</span>}
      </div>
    </div>
  );
};

// ── score ring ───────────────────────────────────────────────────────────────
export const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 56 }) => {
  const R = 24, C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="cc-score">
      <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle cx="28" cy="28" r={R} fill="none" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * C} ${C}`} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" className="cc-score-val">{score}</text>
    </svg>
  );
};

// ── secret-files funnel ──────────────────────────────────────────────────────
export const SecretFunnel: React.FC<{ funnel: Row[] }> = ({ funnel }) => {
  const get = (ev: string, st?: string) => {
    const r = funnel.find((x) => x[0] === ev && (st === undefined || x[1] === st));
    return r ? Number(r[2]) : 0;
  };
  const steps = [
    { name: 'Opened', n: get('secret_opened'), wrong: 0 },
    { name: 'L1 · Hallucination', n: get('secret_stage_passed', 'hallucination'), wrong: get('secret_wrong_answer', 'hallucination') },
    { name: 'L2 · Turing', n: get('secret_stage_passed', 'turing'), wrong: get('secret_wrong_answer', 'turing') },
    { name: 'L3 · Tokens', n: get('secret_stage_passed', 'tokens'), wrong: get('secret_wrong_answer', 'tokens') },
    { name: 'Matrix beaten', n: get('secret_completed'), wrong: 0 },
  ];
  const top = Math.max(steps[0].n, 1);
  if (steps.every((s) => s.n === 0)) return <Empty icon="lock" text="No one has opened the Secret Files yet." />;
  return (
    <div className="cc-funnel">
      {steps.map((s, i) => (
        <div className="cc-funnel-bar" key={s.name} style={{ width: `${Math.max(12, (s.n / top) * 100)}%` }}>
          <span className="cc-funnel-name">{s.name}</span>
          <span className="cc-funnel-meta">
            {s.n}
            {s.wrong > 0 && <em>{s.wrong} wrong</em>}
            {i > 0 && <em>{Math.round((s.n / top) * 100)}%</em>}
          </span>
        </div>
      ))}
    </div>
  );
};
