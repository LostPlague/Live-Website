import React, { useMemo, useState } from 'react';
import type {
  Row, Visitor, OwnerInfo, OverviewData, VisitorsData, VisitorDetail, ChallengeData, ContentData, SystemData,
} from './ui';
import {
  Icon, Card, Empty, Kpi, Trend, HBars, Donut, Heatmap, WorldMap, ScoreRing, SecretFunnel, ClassChip,
  EV_ICON, TROPHY_EV, STAGE_NO, secs, fmtTime, fmtDay, ago,
} from './ui';

// ── shared bits ──────────────────────────────────────────────────────────────
const pretty = (ev: string) => ev.replace(/^\$/, '').replace(/_/g, ' ');

const eventMeta = (r: Row): string => {
  const ev = String(r[1]);
  const app = r[2] ? String(r[2]) : '';
  const stage = r[3] ? String(r[3]) : '';
  const seconds = r[5] != null ? Number(r[5]) : null;
  if (ev === 'app_opened') return app;
  if (ev === 'app_closed') {
    let m = app + (seconds != null ? ` · ${secs(seconds)}` : '');
    if (r[10] != null) m += ` · ${secs(Number(r[10]))} focused`;
    return m;
  }
  if (ev === 'secret_stage_passed') return `Level ${STAGE_NO[stage] || '?'} · ${stage}` + (seconds != null ? ` · ${secs(seconds)}` : '');
  if (ev === 'secret_wrong_answer') return `Level ${STAGE_NO[stage] || '?'} · wrong answer` + (r[4] != null ? ` · ${r[4]} tries left` : '');
  if (ev === 'section_viewed') {
    let m = String(r[8] || '') + (seconds != null ? ` · read ${secs(seconds)}` : '');
    if (r[11] != null) m += ` · ${r[11]}% deep`;
    return m;
  }
  if (ev === 'link_clicked') return String(r[9] || '');
  if (ev === 'radio_listened') return seconds != null ? `listened ${secs(seconds)}` : '';
  if (ev === 'minesweeper_result') return seconds != null ? `${secs(seconds)}` : '';
  if (ev === 'element_hovered') return `${r[9] || ''}${seconds != null ? ` · lingered ${seconds}s` : ''}`;
  if (ev === 'experience_abandoned') return seconds != null ? `left after ${secs(seconds)}` : '';
  if (ev === 'room_summary') return 'room visit recap';
  if (ev === 'js_error') return 'error in page';
  if (ev === '$pageview' && r[6]) { try { return new URL(String(r[6])).pathname; } catch { return ''; } }
  return '';
};

const FlagIcons: React.FC<{ v: Visitor }> = ({ v }) => (
  <span className="cc-flags">
    {v.resume && <span className="cc-flag dl" title="Downloaded the resume"><Icon name="download" size={12} /></span>}
    {v.matrix && <span className="cc-flag mx" title="Beat the Matrix"><Icon name="trophy" size={12} /></span>}
    {v.contact && <span className="cc-flag ct" title="Sent a message"><Icon name="mail" size={12} /></span>}
    {!v.resume && !v.matrix && !v.contact && v.stages > 0 && (
      <span className="cc-flag st" title={`Passed ${v.stages} secret level${v.stages > 1 ? 's' : ''}`}><Icon name="puzzle" size={12} /></span>
    )}
  </span>
);

const OwnerStrip: React.FC<{ owner: OwnerInfo | null }> = ({ owner }) => (
  <div className="cc-owner">
    <span className="cc-owner-crown"><Icon name="crown" size={16} /></span>
    {owner ? (
      <p>
        <b>You</b> · {owner.sessions} visit{owner.sessions === 1 ? '' : 's'} · {secs(owner.dwell)} in apps ·
        last {fmtDay(owner.last)} · excluded from every stat
      </p>
    ) : (
      <p><b>Tag yourself:</b> open <code>mohamedtabari.com/?me=k9Xm2Q7p</code> once on each of your devices —
        your visits then collapse into this strip and never pollute the numbers. <code>/?me=off</code> untags.</p>
    )}
  </div>
);

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
export const OverviewPage: React.FC<{ d: OverviewData; onOpenVisitor: (v: Visitor) => void }> = ({ d, onOpenVisitor }) => {
  const k = d.kpis;
  const numOf = useMemo(() => new Map(d.visitors.map((v) => [v.id, v])), [d.visitors]);
  const liveIds = new Set(d.live.map((r) => String(r[0])));
  return (
    <>
      <div className="cc-kpis">
        <Kpi label="Real visitors" icon="users" value={k.visitors} prev={k.visitorsPrev} />
        <Kpi label="Sessions" icon="pulse" value={k.sessions} prev={k.sessionsPrev} />
        <Kpi label="Resume downloads" icon="download" value={k.resume} prev={k.resumePrev} />
        <Kpi label="Matrix beaten" icon="trophy" value={k.matrix} prev={k.matrixPrev} />
        <Kpi label="Messages" icon="mail" value={k.contacts} prev={k.contactsPrev} />
        <Kpi label="Returning" icon="refresh" value={k.returning} sub={`of ${d.visitors.length} all-time`} />
      </div>

      <OwnerStrip owner={d.owner} />

      <div className="cc-grid">
        <Card span={8} title={`Visitors — last ${d.days} day${d.days > 1 ? 's' : ''}`}
          right={<span className="cc-count">vs previous period</span>}>
          <Trend rows={d.trend} days={d.days} />
        </Card>

        <Card span={4} title="Live right now" right={<span className={`cc-live-dot ${d.live.length ? 'on' : ''}`} />}>
          {d.live.length === 0 ? (
            <Empty icon="eye" text="Nobody on the site right now" sub="Updates every minute" />
          ) : (
            <div className="cc-feed">
              {d.live.map((r, i) => {
                const known = numOf.get(String(r[0]));
                return (
                  <div className="cc-feed-row" key={i}>
                    <span className="cc-feed-ico cc-feed-live"><Icon name="user" size={13} /></span>
                    <div className="cc-feed-main">
                      <div className="cc-feed-ev">{known ? known.num : 'New visitor'}</div>
                      <div className="cc-feed-sub">{[r[1], r[2]].filter(Boolean).join(', ') || 'Unknown location'} · {r[4]} events</div>
                    </div>
                    <span className="cc-feed-time cc-mono">{ago(String(r[3]))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card span={8} title="Where visitors are" right={<span className="cc-count">{d.visitors.length} located</span>}>
          <WorldMap visitors={d.visitors} liveIds={liveIds} />
        </Card>

        <Card span={4} title="Secret Files funnel">
          <SecretFunnel funnel={d.funnel} />
        </Card>

        <Card span={4} title="Traffic sources">
          <HBars rows={d.referrers} emptyText="All direct so far — no referrers yet." />
        </Card>

        <Card span={8} title="Latest activity" right={<span className="cc-count">exact times · your clock</span>}>
          {d.recent.length === 0 ? <Empty text="No visitor activity in this range yet." /> : (
            <div className="cc-feed cc-feed-tall">
              {d.recent.map((r, i) => {
                const ev = String(r[1]);
                const v = numOf.get(String(r[4]));
                const meta = eventMeta([r[0], r[1], r[2], r[5], null, null, null, null, r[6], r[7]]);
                return (
                  <div className="cc-feed-row" key={i}>
                    <span className={`cc-feed-ico ${TROPHY_EV.has(ev) ? 'cc-feed-trophy' : ''}`}><Icon name={EV_ICON[ev] || 'pulse'} size={13} /></span>
                    <div className="cc-feed-main">
                      <div className="cc-feed-ev">
                        {v ? (
                          <button className="cc-inline-link" onClick={() => onOpenVisitor(v)}>{v.num}</button>
                        ) : <span>Visitor</span>}
                        {' '}· {pretty(ev)}{meta ? ` · ${meta}` : ''}
                      </div>
                      <div className="cc-feed-sub">{String(r[3] || 'Unknown location')}</div>
                    </div>
                    <span className="cc-feed-time cc-mono">{fmtTime(String(r[0]))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <p className="cc-noise-note"><Icon name="bot" size={12} /> {d.botCount} bot{d.botCount === 1 ? '' : 's'} &amp; crawlers
        detected and excluded from everything above — inspect them in Visitors → Filtered noise.</p>
    </>
  );
};

// ── VISITORS ─────────────────────────────────────────────────────────────────
export const VisitorsPage: React.FC<{
  d: VisitorsData; onOpen: (v: Visitor) => void;
  showBots: boolean; onToggleBots: () => void;
}> = ({ d, onOpen, showBots, onToggleBots }) => {
  const [q, setQ] = useState('');
  const [klass, setKlass] = useState<'all' | 'hot' | 'explorer' | 'passerby'>('all');
  const [sort, setSort] = useState<'last' | 'score' | 'first'>('last');

  const rows = useMemo(() => {
    let out = [...d.visitors];
    if (klass !== 'all') out = out.filter((v) => v.class === klass);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter((v) =>
        v.num.toLowerCase().includes(s) ||
        (v.city || '').toLowerCase().includes(s) ||
        (v.country || '').toLowerCase().includes(s) ||
        (v.device || '').toLowerCase().includes(s) ||
        (v.browser || '').toLowerCase().includes(s));
    }
    out.sort((a, b) =>
      sort === 'score' ? b.score - a.score :
      sort === 'first' ? a.first.localeCompare(b.first) :
      b.last.localeCompare(a.last));
    return out;
  }, [d.visitors, q, klass, sort]);

  const exportCsv = () => {
    const head = 'number,score,class,city,country,device,browser,sessions,first_seen,last_seen,events,seconds_in_apps,resume,matrix,contact';
    const lines = d.visitors.map((v) => [
      v.num, v.score, v.class, v.city || '', v.country || '', v.device || '', v.browser || '',
      v.sessions, v.first, v.last, v.events, Math.round(v.dwell), v.resume ? 1 : 0, v.matrix ? 1 : 0, v.contact ? 1 : 0,
    ].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([head + '\n' + lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'visitors.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <OwnerStrip owner={d.owner} />
      <div className="cc-grid">
        <Card span={12}
          title={<>Visitor roster <span className="cc-count">{rows.length} of {d.visitors.length} · numbers are permanent</span></>}
          right={
            <span className="cc-toolbar">
              <span className="cc-search"><Icon name="search" size={13} />
                <input placeholder="Search city, country, number…" value={q} onChange={(e) => setQ(e.target.value)} />
              </span>
              <span className="cc-seg">
                {(['all', 'hot', 'explorer', 'passerby'] as const).map((c) => (
                  <button key={c} className={klass === c ? 'on' : ''} onClick={() => setKlass(c)}>
                    {c === 'all' ? 'All' : c === 'hot' ? 'Hot' : c === 'explorer' ? 'Explorers' : 'Passersby'}
                  </button>
                ))}
              </span>
              <select className="cc-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="last">Newest activity</option>
                <option value="score">Highest score</option>
                <option value="first">First arrived</option>
              </select>
              <button className="cc-btn-ghost" onClick={exportCsv} title="Export all visitors as CSV"><Icon name="export" size={13} />CSV</button>
            </span>
          }>
          {rows.length === 0 ? (
            <Empty icon="users" text={d.visitors.length === 0 ? 'No real visitors yet — the clean slate started today.' : 'No visitors match this filter.'}
              sub={d.visitors.length === 0 ? 'Share the link; humans will appear here, bots will not.' : undefined} />
          ) : (
            <div className="cc-table-scroll">
              <table className="cc-table">
                <thead><tr>
                  <th>ID</th><th>Score</th><th>Class</th><th>Location</th><th>Device</th>
                  <th>First seen</th><th>Last seen</th><th>Visits</th><th>Time in apps</th><th>Flags</th>
                </tr></thead>
                <tbody>
                  {rows.map((v) => (
                    <tr
                      className="cc-row" key={v.id} tabIndex={0}
                      aria-label={`Open dossier for ${v.num}`}
                      onClick={() => onOpen(v)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(v); } }}
                    >
                      <td className="cc-vid">{v.num}{v.returning && <span className="cc-ret" title={`${v.sessions} separate visits`}><Icon name="refresh" size={10} />{v.sessions}</span>}</td>
                      <td><span className="cc-score-cell"><span className="cc-score-bar"><span style={{ width: `${v.score}%` }} /></span>{v.score}</span></td>
                      <td><ClassChip k={v.class} /></td>
                      <td>{[v.city, v.country].filter(Boolean).join(', ') || '—'}</td>
                      <td>{[v.device, v.browser].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="cc-mono">{fmtDay(v.first)}</td>
                      <td className="cc-mono">{fmtDay(v.last)}</td>
                      <td>{v.sessions}</td>
                      <td>{v.dwell > 0 ? secs(v.dwell) : '—'}</td>
                      <td><FlagIcons v={v} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card span={12}
          title={<>Filtered noise <span className="cc-count">{d.botCount} bot{d.botCount === 1 ? '' : 's'} &amp; crawlers excluded from all stats</span></>}
          right={<button className="cc-btn-ghost" onClick={onToggleBots}><Icon name="bot" size={13} />{showBots ? 'Hide' : 'Inspect'}</button>}>
          {!showBots ? (
            <p className="cc-hint">Single-hit crawlers, link-preview bots and datacenter traffic (Ashburn, Boardman, …) fail the
              engagement gate automatically. Click Inspect to audit what was filtered.</p>
          ) : d.bots.length === 0 ? <Empty icon="bot" text="No bot traffic in the book yet." /> : (
            <div className="cc-table-scroll">
              <table className="cc-table">
                <thead><tr><th>Location</th><th>Device</th><th>Browser</th><th>Events</th><th>First</th><th>Last</th></tr></thead>
                <tbody>
                  {d.bots.map((b, i) => (
                    <tr key={i} className="cc-row-dim">
                      <td>{[b[5], b[4]].filter(Boolean).join(', ') || '—'}</td>
                      <td>{String(b[6] || '—')}</td>
                      <td>{String(b[7] || '—')}</td>
                      <td>{String(b[3])}</td>
                      <td className="cc-mono">{fmtDay(String(b[1]))}</td>
                      <td className="cc-mono">{fmtDay(String(b[2]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

// ── VISITOR DOSSIER ──────────────────────────────────────────────────────────
export const DossierView: React.FC<{ visitor: Visitor; detail: VisitorDetail | null; onBack: () => void }> =
  ({ visitor, detail, onBack }) => {
    const [allEvents, setAllEvents] = useState(false);
    const p = detail?.profile || [];
    const fact = (i: number) => (p[i] != null && p[i] !== '' ? String(p[i]) : '—');

    const timeline = useMemo(() => {
      const tl = detail?.timeline || [];
      return allEvents ? tl : tl.filter((r) => !String(r[1]).startsWith('$') || r[1] === '$pageview');
    }, [detail, allEvents]);

    const sessions = useMemo(() => {
      const by = new Map<string, Row[]>();
      timeline.forEach((r) => {
        const sid = String(r[7] || 'no-session');
        if (!by.has(sid)) by.set(sid, []);
        (by.get(sid) as Row[]).push(r);
      });
      return [...by.entries()]
        .map(([sid, rows]) => ({ sid, rows, start: String(rows[0][0]), end: String(rows[rows.length - 1][0]) }))
        .sort((a, b) => a.start.localeCompare(b.start));
    }, [timeline]);

    const appTime = useMemo(() => {
      const t: Record<string, number> = {};
      (detail?.timeline || []).forEach((r) => {
        if (r[1] === 'app_closed' && r[2] && r[5] != null) t[String(r[2])] = (t[String(r[2])] || 0) + Number(r[5]);
      });
      return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([a, s]) => [a, s] as Row);
    }, [detail]);

    const durOf = (s: { start: string; end: string }) => Math.round((+new Date(s.end) - +new Date(s.start)) / 1000);

    return (
      <>
        <div className="cc-dossier-head">
          <button className="cc-btn-ghost" onClick={onBack}><Icon name="back" size={14} />All visitors</button>
          <div className="cc-dossier-id">
            <h2>{visitor.num}</h2>
            <p className="cc-sub"><Icon name="pin" size={12} /> {[visitor.city, visitor.country].filter(Boolean).join(', ') || 'Unknown location'}
              {visitor.returning && <> · <Icon name="refresh" size={11} /> {visitor.sessions} visits</>}</p>
          </div>
          <div className="cc-dossier-score">
            <ScoreRing score={visitor.score} />
            <ClassChip k={visitor.class} />
          </div>
        </div>

        <div className="cc-badge-row">
          {visitor.resume && <span className="cc-badge dl"><Icon name="download" size={11} />Resume downloaded</span>}
          {visitor.matrix && <span className="cc-badge mx"><Icon name="trophy" size={11} />Beat the Matrix</span>}
          {visitor.contact && <span className="cc-badge ct"><Icon name="mail" size={11} />Sent a message</span>}
          {visitor.stages > 0 && <span className="cc-badge"><Icon name="puzzle" size={11} />{visitor.stages} secret level{visitor.stages > 1 ? 's' : ''} passed</span>}
          {visitor.started && <span className="cc-badge"><Icon name="play" size={11} />Entered the experience</span>}
        </div>

        {!detail ? <Empty text="Loading dossier…" /> : (
          <div className="cc-grid">
            <Card span={4} title="Profile">
              <div className="cc-facts">
                <div><span className="cc-fact-k">Region</span><span className="cc-fact-v">{[fact(2), fact(0)].filter((x) => x !== '—').join(', ') || '—'}</span></div>
                <div><span className="cc-fact-k">Timezone</span><span className="cc-fact-v">{fact(9).replace(/_/g, ' ')}</span></div>
                <div><span className="cc-fact-k">Device</span><span className="cc-fact-v">{fact(3)} · {fact(5)}</span></div>
                <div><span className="cc-fact-k">Browser</span><span className="cc-fact-v">{fact(4)}</span></div>
                <div><span className="cc-fact-k">Screen</span><span className="cc-fact-v">{p[6] ? `${p[6]}×${p[7]}` : '—'}</span></div>
                <div><span className="cc-fact-k">Came from</span><span className="cc-fact-v">{fact(8)}</span></div>
                <div><span className="cc-fact-k">First seen</span><span className="cc-fact-v">{p[10] ? fmtDay(String(p[10])) : '—'}</span></div>
                <div><span className="cc-fact-k">Last seen</span><span className="cc-fact-v">{p[11] ? fmtDay(String(p[11])) : '—'}</span></div>
                <div><span className="cc-fact-k">Total events</span><span className="cc-fact-v">{fact(12)}</span></div>
                <div><span className="cc-fact-k">Sessions</span><span className="cc-fact-v">{fact(13)}</span></div>
              </div>
              {appTime.length > 0 && (
                <>
                  <p className="cc-mini-title">Time per app</p>
                  <HBars rows={appTime} format={(v) => secs(v)} />
                </>
              )}
            </Card>

            <Card span={8}
              title={<>Journey — {sessions.length} session{sessions.length === 1 ? '' : 's'}</>}
              right={
                <label className="cc-toggle-label">
                  <input type="checkbox" checked={allEvents} onChange={() => setAllEvents(!allEvents)} />
                  every raw event
                </label>
              }>
              {sessions.length === 0 ? <Empty text="No events for this visitor yet." /> : sessions.map((s, si) => (
                <div className="cc-session" key={s.sid}>
                  <div className="cc-session-head">
                    <span className="cc-session-n">Session {si + 1}</span>
                    <span className="cc-session-meta cc-mono">{fmtDay(s.start)} → {fmtTime(s.end).split(', ')[1] || fmtTime(s.end)} · {secs(durOf(s))}</span>
                    {s.sid !== 'no-session' && (
                      <a className="cc-replay" href={`${detail.replayBase}/${s.sid}`} target="_blank" rel="noreferrer"
                        title="Watch the actual screen recording of this session">
                        <Icon name="play" size={11} />Watch replay
                      </a>
                    )}
                  </div>
                  <div className="cc-timeline">
                    {s.rows.map((r, i) => {
                      const ev = String(r[1]);
                      const meta = eventMeta(r);
                      return (
                        <div className={`cc-tl-row ${TROPHY_EV.has(ev) ? 'trophy' : ''}`} key={i}>
                          <span className="cc-tl-ico"><Icon name={EV_ICON[ev] || 'pulse'} size={12} /></span>
                          <span className="cc-tl-ev">{pretty(ev)}</span>
                          {meta && <span className="cc-tl-meta">{meta}</span>}
                          <span className="cc-tl-time cc-mono">{fmtTime(String(r[0]))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </>
    );
  };

// ── CHALLENGE ────────────────────────────────────────────────────────────────
export const ChallengePage: React.FC<{ d: ChallengeData; visitors: Visitor[]; onOpen: (v: Visitor) => void }> =
  ({ d, visitors, onOpen }) => {
    const t = d.totals;
    const rate = t.openedPeople ? Math.round((t.completedPeople / t.openedPeople) * 100) : 0;
    const stageRow = (name: string) => d.stages.find((s) => s[0] === name);
    const byId = new Map(visitors.map((v) => [v.id, v]));
    const order: [string, string][] = [['hallucination', 'Level 1 · Hallucination'], ['turing', 'Level 2 · Turing'], ['tokens', 'Level 3 · Tokens']];
    return (
      <div className="cc-grid">
        <div className="cc-kpis cc-col-12">
          <Kpi label="Opened the files" icon="lock" value={t.openedPeople} sub={`${t.opened} opens`} />
          <Kpi label="Beat the Matrix" icon="trophy" value={t.completedPeople} />
          <Kpi label="Completion rate" icon="pulse" value={rate} sub="%" />
          <Kpi label="Gave up" icon="door" value={t.gaveUp} />
          <Kpi label="Access revoked" icon="skull" value={t.failed} sub="3 wrong at L3" />
        </div>

        <Card span={7} title="Level by level">
          {d.stages.length === 0 ? <Empty icon="lock" text="No challenge attempts in this range." /> : (
            <table className="cc-table">
              <thead><tr><th>Level</th><th>Passed</th><th>Wrong answers</th><th>Avg time to crack</th></tr></thead>
              <tbody>
                {order.map(([key, label]) => {
                  const s = stageRow(key);
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>{s ? String(s[1]) : 0}</td>
                      <td>{s ? String(s[2]) : 0}</td>
                      <td>{s && s[3] != null ? secs(Number(s[3])) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card span={5} title="Roll of honor" right={<span className="cc-count">beat all 3 levels</span>}>
          {d.winners.length === 0 ? <Empty icon="trophy" text="Nobody has beaten the Matrix yet." sub="The machine remains undefeated." /> : (
            <div className="cc-feed">
              {d.winners.map((w, i) => {
                const v = byId.get(String(w[0]));
                return (
                  <div className="cc-feed-row" key={i}>
                    <span className="cc-feed-ico cc-feed-trophy"><Icon name="trophy" size={13} /></span>
                    <div className="cc-feed-main">
                      <div className="cc-feed-ev">
                        {v ? <button className="cc-inline-link" onClick={() => onOpen(v)}>{v.num}</button> : 'Visitor'}
                      </div>
                      <div className="cc-feed-sub">{v ? [v.city, v.country].filter(Boolean).join(', ') : ''}</div>
                    </div>
                    <span className="cc-feed-time cc-mono">{fmtDay(String(w[1]))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  };

// ── CONTENT ──────────────────────────────────────────────────────────────────
const HOVER_LABEL: Record<string, string> = {
  'start-button': 'Start button', resume: 'Resume link', 'contact-send': 'Send message',
  linkedin: 'LinkedIn', email: 'Email address',
  'icon-showcase': 'Showcase icon', 'icon-browser': 'Browser icon', 'icon-radio': 'Radio icon',
  'icon-minesweeper': 'Minesweeper icon', 'icon-secret': 'Secret Files icon',
};

export const ContentPage: React.FC<{ d: ContentData }> = ({ d }) => {
  const m = d.media;
  const r = d.room;
  const loaded = r.starts + r.abandons;
  const startRate = loaded ? Math.round((r.starts / loaded) * 100) : 0;
  const playedRate = r.summaries ? Math.round((r.played / r.summaries) * 100) : 0;
  const roomBars: Row[] = [
    ['At the desk', Math.round(r.deskAvg)], ['On the monitor (OS)', Math.round(r.monitorAvg)],
    ['Wide view', Math.round(r.wideAvg)], ['Free-look orbit', Math.round(r.orbitAvg)],
  ].filter((row) => Number(row[1]) > 0) as Row[];
  return (
    <div className="cc-grid">
      <Card span={7} title="The 3D room" right={<span className="cc-count">camera journey · averages per visit</span>}>
        {r.summaries === 0 && loaded === 0 ? (
          <Empty icon="globe" text="No room visits in this range yet." sub="Tracks intro dwell, camera views, orbit play and AFK time." />
        ) : (
          <>
            <div className="cc-stat-pair" style={{ marginBottom: 14 }}>
              <div><p className="cc-stat-big">{startRate}<span className="cc-stat-of">%</span></p><p className="cc-stat-sub">clicked Start · {r.abandons} left at the intro</p></div>
              <div><p className="cc-stat-big">{r.introAvg > 0 ? secs(r.introAvg) : '—'}</p><p className="cc-stat-sub">avg wait before Start</p></div>
              <div><p className="cc-stat-big">{playedRate}<span className="cc-stat-of">%</span></p><p className="cc-stat-sub">played with the room</p></div>
              <div><p className="cc-stat-big">{r.afkAvg > 0 ? secs(r.afkAvg) : '0s'}</p><p className="cc-stat-sub">avg AFK time</p></div>
            </div>
            {roomBars.length > 0 && <HBars rows={roomBars} format={(v) => secs(v)} />}
          </>
        )}
      </Card>

      <Card span={5} title="Hesitation" right={<span className="cc-count">lingered on it — did they act?</span>}>
        {d.hesitation.length === 0 ? (
          <Empty icon="eye" text="No lingering hovers recorded yet." sub="A hover counts after 600ms on a meaningful button." />
        ) : (
          <table className="cc-table">
            <thead><tr><th>Element</th><th>Hovered</th><th>Dwell</th><th>Acted</th></tr></thead>
            <tbody>
              {d.hesitation.map((h, i) => {
                const t = String(h[0]);
                const conv = d.hesitationConv[t];
                return (
                  <tr key={i}>
                    <td className="cc-strong">{HOVER_LABEL[t] || t}</td>
                    <td>{String(h[1])} {Number(h[1]) === 1 ? 'person' : 'people'}</td>
                    <td>{secs(Number(h[2]))}</td>
                    <td>{conv != null ? `${conv} did` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <Card span={7} title="Apps" right={<span className="cc-count">opens · people · time inside</span>}>
        {d.apps.length === 0 ? <Empty icon="window" text="No app activity in this range yet." /> : (
          <table className="cc-table">
            <thead><tr><th>App</th><th>Opens</th><th>People</th><th>Total time</th><th>Avg per open</th></tr></thead>
            <tbody>
              {d.apps.map((a, i) => (
                <tr key={i}>
                  <td className="cc-strong">{String(a[0])}</td>
                  <td>{String(a[1])}</td>
                  <td>{String(a[2])}</td>
                  <td>{Number(a[3]) > 0 ? secs(Number(a[3])) : '—'}</td>
                  <td>{a[4] != null ? secs(Number(a[4])) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card span={5} title="Portfolio sections" right={<span className="cc-count">reading time</span>}>
        {d.sections.length === 0 ? (
          <Empty icon="file" text="No section reads yet." sub="Tracks Home / About / Experience / Contact reading time." />
        ) : (
          <HBars rows={d.sections.map((s) => [String(s[0]), Number(s[3])])} format={(v) => secs(v)} />
        )}
      </Card>

      <Card span={5} title="Outbound clicks" right={<span className="cc-count">LinkedIn · email · employers</span>}>
        {d.links.length === 0 ? <Empty icon="link" text="No outbound clicks yet." sub="LinkedIn, email and employer-site clicks land here." /> : (
          <HBars rows={d.links.map((l) => [String(l[0]), Number(l[1])])} color="#d97706" />
        )}
      </Card>

      <Card span={4} title="Hit Radio">
        <div className="cc-stat-pair">
          <div><p className="cc-stat-big">{m.radioPlays}</p><p className="cc-stat-sub">plays</p></div>
          <div><p className="cc-stat-big">{m.radioSeconds > 0 ? secs(m.radioSeconds) : '0s'}</p><p className="cc-stat-sub">total airtime</p></div>
        </div>
      </Card>

      <Card span={3} title="Minesweeper">
        <div className="cc-stat-pair">
          <div><p className="cc-stat-big">{m.mineWins}<span className="cc-stat-of">/{m.mineGames}</span></p><p className="cc-stat-sub">games won</p></div>
          <div><p className="cc-stat-big">{m.mineAvgWin > 0 ? secs(m.mineAvgWin) : '—'}</p><p className="cc-stat-sub">avg winning time</p></div>
        </div>
        {m.mineAvgClicks > 0 && (
          <p className="cc-hint">{Math.round(m.mineAvgClicks)} clicks · {Math.round(m.mineAvgFlags)} flags per game on average.</p>
        )}
      </Card>
    </div>
  );
};

// ── SYSTEM ───────────────────────────────────────────────────────────────────
const VITAL_RATING: Record<string, (v: number) => 'good' | 'mid' | 'bad'> = {
  lcp: (v) => (v <= 2500 ? 'good' : v <= 4000 ? 'mid' : 'bad'),
  fcp: (v) => (v <= 1800 ? 'good' : v <= 3000 ? 'mid' : 'bad'),
  cls: (v) => (v <= 0.1 ? 'good' : v <= 0.25 ? 'mid' : 'bad'),
  inp: (v) => (v <= 200 ? 'good' : v <= 500 ? 'mid' : 'bad'),
};

export const SystemPage: React.FC<{ d: SystemData }> = ({ d }) => {
  const v = d.vitals;
  const p = d.perf;
  const vital = (key: 'lcp' | 'fcp' | 'cls' | 'inp', label: string, val: number, shown: string) => (
    <div className="cc-vital">
      <p className="cc-stat-sub">{label}</p>
      <p className={`cc-stat-big cc-vital-${v.samples ? VITAL_RATING[key](val) : 'none'}`}>{v.samples ? shown : '—'}</p>
    </div>
  );
  const fpsTone = (fps: number) => (fps >= 50 ? 'good' : fps >= 30 ? 'mid' : 'bad');
  const countTone = (n: number) => (n === 0 ? 'good' : 'bad');
  return (
    <div className="cc-grid">
      <Card span={4} title="Devices"><Donut rows={d.devices} /></Card>
      <Card span={4} title="Browsers"><Donut rows={d.browsers} /></Card>
      <Card span={4} title="Operating systems"><Donut rows={d.oses} /></Card>

      <Card span={5} title="Screen sizes"><HBars rows={d.screens} /></Card>

      <Card span={7} title="Page performance" right={<span className="cc-count">{v.samples} samples · avg</span>}>
        <div className="cc-vitals">
          {vital('lcp', 'Largest paint', v.lcp, `${(v.lcp / 1000).toFixed(1)}s`)}
          {vital('fcp', 'First paint', v.fcp, `${(v.fcp / 1000).toFixed(1)}s`)}
          {vital('cls', 'Layout shift', v.cls, v.cls.toFixed(3))}
          {vital('inp', 'Input delay', v.inp, `${Math.round(v.inp)}ms`)}
        </div>
        <p className="cc-hint">Green = good per Google Web Vitals thresholds; amber = needs improvement; red = poor.</p>
      </Card>

      <Card span={7} title="3D stability &amp; frustration" right={<span className="cc-count">{p.fpsSamples} FPS samples</span>}>
        <div className="cc-vitals">
          <div className="cc-vital"><p className="cc-stat-sub">Avg frame rate</p>
            <p className={`cc-stat-big cc-vital-${p.fpsSamples ? fpsTone(p.fpsAvg) : 'none'}`}>{p.fpsSamples ? `${p.fpsAvg} fps` : '—'}</p></div>
          <div className="cc-vital"><p className="cc-stat-sub">Worst second</p>
            <p className={`cc-stat-big cc-vital-${p.fpsSamples ? fpsTone(p.fpsMin) : 'none'}`}>{p.fpsSamples ? `${p.fpsMin} fps` : '—'}</p></div>
          <div className="cc-vital"><p className="cc-stat-sub">Rage clicks</p>
            <p className={`cc-stat-big cc-vital-${countTone(p.rage)}`}>{p.rage}</p></div>
          <div className="cc-vital"><p className="cc-stat-sub">Dead clicks</p>
            <p className={`cc-stat-big cc-vital-${countTone(p.dead)}`}>{p.dead}</p></div>
        </div>
        <p className="cc-hint">Rage = 3+ fast clicks in one spot (frustration). Dead = a click that visibly did nothing.</p>
      </Card>

      <Card span={5} title="Errors" right={<span className="cc-count">{p.webglFails} WebGL failures</span>}>
        {p.errors === 0 ? (
          <Empty icon="spark" text="Zero JavaScript errors in this range." sub="The site is running clean." />
        ) : (
          <>
            <p className="cc-stat-big cc-vital-bad" style={{ marginBottom: 10 }}>{p.errors}</p>
            {d.topErrors.map((e, i) => (
              <p key={i} className="cc-hint cc-mono" style={{ marginTop: 4 }}>{String(e[1])}× — {String(e[0]).slice(0, 90)}</p>
            ))}
          </>
        )}
      </Card>

      <Card span={12} title="When people visit" right={<span className="cc-count">events by hour × weekday</span>}>
        <Heatmap cells={d.heat} tz={d.tz} />
      </Card>
    </div>
  );
};
