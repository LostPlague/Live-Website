// SAMPLE data — served ONLY in local dev (the Netlify function isn't running
// there). Clearly labelled in the UI. Mirrors the exact shapes ph.mjs returns
// so every page can be designed and verified offline.

import type { OverviewData, VisitorsData, VisitorDetail, ChallengeData, ContentData, SystemData, Visitor, Row } from './ui';

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const day = 864e5, hr = 36e5, min = 6e4;

const mk = (
  i: number, firstAgo: number, lastAgo: number, o: Partial<Visitor> & { city: string; country: string; lat: number; lon: number },
): Visitor => {
  const base: Visitor = {
    id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
    num: 'Visitor ' + String(i).padStart(3, '0'),
    first: iso(firstAgo), last: iso(lastAgo),
    events: 12, custom: 6, sessions: 1, resume: false, matrix: false, contact: false,
    stages: 0, started: true, dwell: 120, apps: 2,
    device: 'Desktop', browser: 'Chrome', returning: false, score: 18, class: 'explorer',
    ...o,
  } as Visitor;
  return base;
};

const VISITORS: Visitor[] = [
  mk(1, 6 * day, 40_000, { city: 'Austin', country: 'United States', lat: 30.27, lon: -97.74, resume: true, matrix: true, contact: false, stages: 3, sessions: 3, returning: true, events: 84, dwell: 1260, apps: 5, score: 92, class: 'hot', device: 'Desktop', browser: 'Chrome' }),
  mk(2, 5 * day, 3 * hr, { city: 'Casablanca', country: 'Morocco', lat: 33.57, lon: -7.59, contact: true, sessions: 2, returning: true, events: 41, dwell: 610, apps: 3, score: 58, class: 'hot', device: 'Mobile', browser: 'Safari' }),
  mk(3, 4 * day, 9 * hr, { city: 'London', country: 'United Kingdom', lat: 51.5, lon: -0.12, resume: true, events: 29, dwell: 340, apps: 3, score: 61, class: 'hot', device: 'Desktop', browser: 'Firefox' }),
  mk(4, 3 * day, 26 * hr, { city: 'Paris', country: 'France', lat: 48.85, lon: 2.35, stages: 2, events: 33, dwell: 410, apps: 4, score: 34, class: 'explorer' }),
  mk(5, 2 * day, 2 * day, { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.4, events: 9, dwell: 75, apps: 1, score: 9, class: 'passerby', device: 'Mobile', browser: 'Chrome' }),
  mk(6, 30 * hr, 5 * hr, { city: 'San Francisco', country: 'United States', lat: 37.77, lon: -122.42, stages: 1, events: 22, dwell: 300, apps: 3, score: 28, class: 'explorer', browser: 'Edge' }),
  mk(7, 9 * hr, 20 * min, { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2, lon: 55.27, events: 15, dwell: 180, apps: 2, score: 19, class: 'explorer' }),
  mk(8, 2 * hr, 3 * min, { city: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69, events: 7, dwell: 60, apps: 2, score: 12, class: 'passerby', device: 'Mobile', browser: 'Safari' }),
];

const OWNER = {
  num: 'YOU', first: iso(7 * day), last: iso(12 * min), events: 214, sessions: 19,
  dwell: 5400, country: 'Morocco', city: 'Rabat', device: 'Desktop', browser: 'Chrome',
};

const TREND: Row[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(now - (13 - i) * day);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [key, [0, 1, 1, 2, 1, 3, 2, 2, 4, 3, 5, 4, 6, 5][i]];
});

const FUNNEL: Row[] = [
  ['secret_opened', null, 14],
  ['secret_stage_passed', 'hallucination', 9], ['secret_wrong_answer', 'hallucination', 6],
  ['secret_stage_passed', 'turing', 6], ['secret_wrong_answer', 'turing', 8],
  ['secret_stage_passed', 'tokens', 2], ['secret_wrong_answer', 'tokens', 4],
  ['secret_completed', null, 2],
];

const RECENT: Row[] = [
  [iso(40_000), 'resume_downloaded', null, 'United States', VISITORS[0].id, null, null, null],
  [iso(3 * min), 'secret_completed', null, 'United States', VISITORS[0].id, null, null, null],
  [iso(8 * min), 'secret_stage_passed', null, 'United States', VISITORS[0].id, 'turing', null, null],
  [iso(12 * min), 'link_clicked', null, 'Morocco', VISITORS[1].id, null, null, 'linkedin'],
  [iso(20 * min), 'section_viewed', null, 'United Arab Emirates', VISITORS[6].id, null, 'experience', null],
  [iso(26 * min), 'app_opened', 'radio', 'Japan', VISITORS[7].id, null, null, null],
  [iso(50 * min), 'minesweeper_result', 'minesweeper', 'France', VISITORS[3].id, null, null, null],
  [iso(80 * min), 'contact_submitted', null, 'Morocco', VISITORS[1].id, null, null, null],
];

const LIVE: Row[] = [
  [VISITORS[7].id, 'Tokyo', 'Japan', iso(35_000), 6],
  [VISITORS[0].id, 'Austin', 'United States', iso(70_000), 3],
];

export const S_OVERVIEW: OverviewData = {
  days: 7, tz: 'Africa/Casablanca',
  kpis: {
    visitors: 8, visitorsPrev: 5, sessions: 13, sessionsPrev: 7, resume: 2, resumePrev: 0,
    matrix: 1, matrixPrev: 0, contacts: 1, contactsPrev: 1, links: 4, linksPrev: 2, returning: 2,
  },
  trend: TREND, funnel: FUNNEL,
  // 'Direct' is a real row now (people typing the URL off a CV), so the fixture
  // mirrors that — usually the largest source, hence first.
  referrers: [['Direct', 9], ['linkedin.com', 4], ['google.com', 2], ['github.com', 1]],
  recent: RECENT, live: LIVE, visitors: VISITORS, owner: OWNER, botCount: 23,
};

export const S_VISITORS: VisitorsData = {
  visitors: VISITORS, owner: OWNER, botCount: 23,
  bots: [
    ['b1', iso(3 * hr), iso(3 * hr), 1, 'United States', 'Ashburn', 'Desktop', 'Chrome'],
    ['b2', iso(7 * hr), iso(7 * hr), 1, 'United States', 'Boardman', 'Desktop', 'Chrome'],
    ['b3', iso(11 * hr), iso(11 * hr), 2, 'Ireland', 'Dublin', 'Desktop', 'Chrome'],
    ['b4', iso(16 * hr), iso(16 * hr), 1, 'United States', 'Las Vegas', 'Desktop', 'Safari'],
  ],
};

export const S_DETAIL: VisitorDetail = {
  replayBase: 'https://us.posthog.com/project/503872/replay',
  profile: ['United States', 'Austin', 'Texas', 'Desktop', 'Chrome', 'Windows', 1920, 1080,
    'linkedin.com', 'America/Chicago', iso(6 * day), iso(40_000), 84, 3],
  timeline: [
    [iso(6 * day), 'experience_started', null, null, null, null, '/', 's1', null, null],
    [iso(6 * day - 20e3), 'app_opened', 'showcase', null, null, null, '/os', 's1', null, null],
    [iso(6 * day - 25e3), 'section_viewed', null, null, null, 46, '/os', 's1', 'home', null],
    [iso(6 * day - 80e3), 'section_viewed', null, null, null, 95, '/os/about', 's1', 'about', null, null, 100],
    [iso(6 * day - 190e3), 'section_viewed', null, null, null, 120, '/os/experience', 's1', 'experience', null, null, 74],
    [iso(6 * day - 200e3), 'resume_downloaded', null, null, null, null, '/os/experience', 's1', null, null],
    [iso(6 * day - 260e3), 'app_closed', 'showcase', null, null, 240, '/os', 's1', null, null, 205],
    [iso(2 * day), 'app_opened', 'radio', null, null, null, '/os', 's2', null, null],
    [iso(2 * day - 10e3), 'radio_play', null, null, null, null, '/os', 's2', null, null],
    [iso(2 * day - 400e3), 'radio_listened', null, null, null, 390, '/os', 's2', null, null],
    [iso(2 * day - 410e3), 'app_closed', 'radio', null, null, 410, '/os', 's2', null, null],
    [iso(25 * min), 'secret_opened', null, null, null, null, '/os', 's3', null, null],
    [iso(23 * min), 'secret_wrong_answer', null, 'hallucination', null, null, '/os', 's3', null, null],
    [iso(22 * min), 'secret_stage_passed', null, 'hallucination', null, 118, '/os', 's3', null, null],
    [iso(15 * min), 'secret_stage_passed', null, 'turing', null, 430, '/os', 's3', null, null],
    [iso(8 * min), 'secret_wrong_answer', null, 'tokens', 2, null, '/os', 's3', null, null],
    [iso(4 * min), 'secret_stage_passed', null, 'tokens', null, 640, '/os', 's3', null, null],
    [iso(3 * min), 'secret_completed', null, null, null, null, '/os', 's3', null, null],
  ],
};

export const S_CHALLENGE: ChallengeData = {
  stages: [
    ['hallucination', 9, 6, 84], ['turing', 6, 8, 312], ['tokens', 2, 4, 655],
  ],
  totals: { opened: 14, completed: 2, gaveUp: 3, failed: 1, openedPeople: 6, completedPeople: 2 },
  winners: [[VISITORS[0].id, iso(3 * min)], [VISITORS[2].id, iso(2 * day)]],
};

export const S_CONTENT: ContentData = {
  apps: [
    ['showcase', 11, 8, 2900, 264], ['radio', 5, 4, 1400, 280],
    ['minesweeper', 4, 3, 620, 155], ['secret', 6, 6, 540, 90], ['browser', 2, 2, 60, 30],
  ],
  sections: [
    ['experience', 9, 6, 780, 87], ['about', 8, 7, 560, 70],
    ['home', 12, 8, 420, 35], ['contact', 5, 4, 240, 48],
  ],
  links: [['linkedin', 3, 3], ['email', 1, 1], ['job-site', 2, 2]],
  hesitation: [
    ['resume', 5, 14.2], ['start-button', 4, 9.8], ['contact-send', 3, 11.5],
    ['linkedin', 2, 4.1], ['icon-secret', 2, 3.4],
  ],
  hesitationConv: { resume: 2, 'contact-send': 1, linkedin: 3, email: 1, 'start-button': 8 },
  media: { radioPlays: 5, radioSeconds: 1390, mineGames: 4, mineWins: 2, mineAvgWin: 148, mineAvgClicks: 34, mineAvgFlags: 7 },
  room: {
    introAvg: 18, wideAvg: 22, deskAvg: 41, monitorAvg: 210, orbitAvg: 33,
    afkAvg: 12, played: 5, summaries: 8, starts: 8, abandons: 3,
  },
};

export const S_SYSTEM: SystemData = {
  devices: [['Desktop', 5], ['Mobile', 3]],
  browsers: [['Chrome', 4], ['Safari', 2], ['Firefox', 1], ['Edge', 1]],
  oses: [['Windows', 4], ['iOS', 2], ['macOS', 1], ['Android', 1]],
  screens: [['1920×1080', 4], ['390×844', 2], ['1440×900', 1], ['2560×1440', 1]],
  heat: Array.from({ length: 30 }, () => [1 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 24), 1 + Math.floor(Math.random() * 9)]),
  tz: 'Africa/Casablanca',
  vitals: { lcp: 1860, fcp: 940, cls: 0.021, inp: 130, samples: 26 },
  perf: { fpsAvg: 58, fpsMin: 41, fpsSamples: 7, rage: 1, dead: 3, errors: 0, webglFails: 0 },
  topErrors: [],
};

export const SAMPLE: Record<string, unknown> = {
  overview: S_OVERVIEW, visitors: S_VISITORS, visitor: S_DETAIL,
  challenge: S_CHALLENGE, content: S_CONTENT, system: S_SYSTEM,
};
