// Synthesized audio for the Matrix takeover — every sound is generated with
// the Web Audio API (no asset files). Lives in the OS iframe's own context,
// created lazily so construction always happens inside a user gesture.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// The finale score's master gain, held while it plays so impacts can DUCK the
// music — the momentary drop makes the crash feel enormous by contrast.
let finaleMaster: GainNode | null = null;
const FINALE_LEVEL = 0.5;

function duckFinale(to = 0.12, holdMs = 260, backMs = 900): void {
  if (!ctx || !finaleMaster) return;
  const g = finaleMaster.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(Math.max(0.0001, FINALE_LEVEL * to), t + 0.05);
  g.setValueAtTime(Math.max(0.0001, FINALE_LEVEL * to), t + 0.05 + holdMs / 1000);
  g.exponentialRampToValueAtTime(FINALE_LEVEL, t + 0.05 + (holdMs + backMs) / 1000);
}

// ── the real glass-break clip (Med's asset) ────────────────────────────────
// Analysis of THIS file (silence-gap + RMS): 0.76s of silence, first smash at
// ~0.78s, a dip, the main shatter at ~1.55s, tail out to ~3.2s. We skip the
// dead lead-in by starting playback at BREAK_OFFSET so the first hit lands the
// instant the visual cracks. The two audio peaks are BREAK_HIT1 / BREAK_HIT2
// (relative to playback start) — the ShatterOverlay times its two visual
// stages (impact-web, catastrophic-collapse) to exactly these.
const BREAK_SRC = '/audio/glass_break.mp3';
export const BREAK_OFFSET = 0.76;        // trim the silent run-in
export const BREAK_HIT1 = 0.0;           // first crack (immediate)
export const BREAK_HIT2 = 0.79;          // main shatter, relative to start
export const BREAK_TAIL_END = 2.45;      // last audible tinkles

let breakBufferPromise: Promise<AudioBuffer | null> | null = null;

/** Fetch + decode the glass clip once; call early so it's ready on the break. */
export function preloadGlassBreak(): Promise<AudioBuffer | null> {
  if (breakBufferPromise) return breakBufferPromise;
  breakBufferPromise = (async () => {
    try {
      const c = ensureCtx();
      const res = await fetch(BREAK_SRC);
      if (!res.ok) return null;
      return await c.decodeAudioData(await res.arrayBuffer());
    } catch {
      breakBufferPromise = null;
      return null;
    }
  })();
  return breakBufferPromise;
}

/** CRT power-down groan: descending saw + sub sine, ~1.6s, fire-and-forget. */
export function playPowerDown(): void {
  const c = ensureCtx();
  const t = c.currentTime;

  const saw = c.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(170, t);
  saw.frequency.exponentialRampToValueAtTime(26, t + 1.35);
  const sawGain = c.createGain();
  sawGain.gain.setValueAtTime(0.0001, t);
  sawGain.gain.exponentialRampToValueAtTime(0.07, t + 0.06);
  sawGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);

  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, t);
  sub.frequency.exponentialRampToValueAtTime(18, t + 1.4);
  const subGain = c.createGain();
  subGain.gain.setValueAtTime(0.0001, t);
  subGain.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.55);

  saw.connect(sawGain).connect(c.destination);
  sub.connect(subGain).connect(c.destination);
  saw.start(t); saw.stop(t + 1.6);
  sub.start(t); sub.stop(t + 1.6);
  saw.onended = () => { saw.disconnect(); sawGain.disconnect(); };
  sub.onended = () => { sub.disconnect(); subGain.disconnect(); };
}

/** Stuttering broadband static for the glitch phase. Returns a stop fn. */
export function startGlitchStatic(): () => void {
  const c = ensureCtx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2);
  src.loop = true;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.1;
  band.frequency.value = 1800;

  const gate = c.createGain();
  gate.gain.value = 0;

  src.connect(band).connect(gate).connect(c.destination);
  src.start();

  // Random gating + band sweeps = torn-signal stutter rather than a hiss bed.
  const stutter = window.setInterval(() => {
    const t = c.currentTime;
    band.frequency.setValueAtTime(350 + Math.random() * 5200, t);
    gate.gain.setValueAtTime(Math.random() < 0.6 ? 0.04 + Math.random() * 0.08 : 0, t);
  }, 75);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(stutter);
    const t = c.currentTime;
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(gate.gain.value, t);
    gate.gain.linearRampToValueAtTime(0, t + 0.09);
    src.stop(t + 0.14);
    src.onended = () => { src.disconnect(); band.disconnect(); gate.disconnect(); };
  };
}

/** Low detuned drone under the rain screen. Returns a stop fn (fades out). */
export function startMatrixDrone(): () => void {
  const c = ensureCtx();
  const t = c.currentTime;

  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.045, t + 1.4);
  master.connect(c.destination);

  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 54;
  const o2 = c.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 54.6; // 0.6 Hz beat against o1 — slow shimmer
  const o3 = c.createOscillator();
  o3.type = 'triangle';
  o3.frequency.value = 108.5;
  const o3Gain = c.createGain();
  o3Gain.gain.value = 0.25;

  // breathing LFO on the master gain
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.13;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.014;
  lfo.connect(lfoDepth).connect(master.gain);

  o1.connect(master);
  o2.connect(master);
  o3.connect(o3Gain).connect(master);
  o1.start(t); o2.start(t); o3.start(t); lfo.start(t);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.35);
    const end = now + 0.4;
    o1.stop(end); o2.stop(end); o3.stop(end); lfo.stop(end);
    o1.onended = () => {
      o1.disconnect(); o2.disconnect(); o3.disconnect(); o3Gain.disconnect();
      lfo.disconnect(); lfoDepth.disconnect(); master.disconnect();
    };
  };
}

/**
 * Original synthesized score for the Matrix screen — a dark, driving electronic
 * loop built entirely from oscillators (no samples, nothing copyrighted). A
 * four-bar i–VI–III–VII progression in A minor (Am–F–C–G) with a pulsing bass,
 * four-on-the-floor kick, off-beat hats, a bright arpeggio and a warm pad.
 * Uses a look-ahead scheduler so timing stays tight. Returns a stop fn.
 */
export function startMatrixMusic(): () => void {
  const c = ensureCtx();

  // master → glue lowpass → compressor (safety limiter) → out
  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(0.55, c.currentTime + 1.4); // fade in
  const glue = c.createBiquadFilter();
  glue.type = 'lowpass';
  glue.frequency.value = 6500;
  const comp = c.createDynamicsCompressor();
  master.connect(glue).connect(comp).connect(c.destination);

  const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

  // bass roots (low octave) + third quality per chord: Am, F, C, G
  const bars = [
    { root: 33, third: 3 }, // Am  (minor 3rd)
    { root: 29, third: 4 }, // F   (major 3rd)
    { root: 36, third: 4 }, // C
    { root: 31, third: 4 }, // G
  ];

  const bpm = 92;
  const step = 60 / bpm / 4;        // 16th-note length
  const STEPS = 16;                 // per bar
  // arp weaves up and down through [root, 3rd, 5th, octave] in a high register
  const arpPattern = [0, 1, 2, 3, 2, 3, 2, 1, 0, 1, 2, 3, 3, 2, 1, 0];

  const kick = (t: number) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.24);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };

  const hat = (t: number) => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.05);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.06);
    src.onended = () => { src.disconnect(); hp.disconnect(); g.disconnect(); };
  };

  const bass = (t: number, midi: number) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.06, t + step * 0.9);
    g.gain.linearRampToValueAtTime(0.0001, t + step * 1.5);
    o.connect(lp).connect(g).connect(master);
    o.start(t); o.stop(t + step * 1.6);
    o.onended = () => { o.disconnect(); lp.disconnect(); g.disconnect(); };
  };

  const arp = (t: number, midi: number) => {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = hz(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.21);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };

  const pad = (t: number, midis: number[], dur: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.setValueAtTime(0.05, t + dur - 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    g.connect(lp).connect(master);
    const oscs = midis.map((m) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = Math.random() * 8 - 4; // slight chorus
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.1);
      return o;
    });
    oscs[oscs.length - 1].onended = () => {
      oscs.forEach((o) => o.disconnect());
      g.disconnect(); lp.disconnect();
    };
  };

  let stopped = false;
  let stepIndex = 0;
  let nextStepTime = c.currentTime + 0.12;

  const scheduleAhead = () => {
    if (stopped) return;
    while (nextStepTime < c.currentTime + 0.2) {
      const bar = Math.floor(stepIndex / STEPS) % bars.length;
      const s = stepIndex % STEPS;
      const ch = bars[bar];
      if (s === 0) pad(nextStepTime, [ch.root + 12, ch.root + 12 + ch.third, ch.root + 19], step * STEPS);
      if (s % 4 === 0) kick(nextStepTime);
      if (s % 4 === 2) hat(nextStepTime);
      if (s % 2 === 0) bass(nextStepTime, ch.root);
      const tones = [ch.root + 36, ch.root + 36 + ch.third, ch.root + 43, ch.root + 48];
      arp(nextStepTime, tones[arpPattern[s]]);
      nextStepTime += step;
      stepIndex++;
    }
  };
  scheduleAhead();
  const timer = window.setInterval(scheduleAhead, 25);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.35); // fade out on exit
    // sever from output after the fade; still-running voices go silent + self-clean
    window.setTimeout(() => {
      try { master.disconnect(); glue.disconnect(); comp.disconnect(); } catch {}
    }, 450);
  };
}

/** Two quick ascending blips — small "clearance granted" cue for stage 1. */
export function playAccessChirp(): void {
  const c = ensureCtx();
  const t = c.currentTime;
  [520, 780].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = c.createGain();
    const st = t + i * 0.09;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.045, st + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
    o.connect(g).connect(c.destination);
    o.start(st);
    o.stop(st + 0.1);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  });
}

/**
 * Stage-3 transition: a 2s noise riser sweeping upward, then an impact —
 * low sine drop + crash — landing as the digitization wave bursts.
 */
export function playFinaleRiser(): void {
  const c = ensureCtx();
  const t = c.currentTime;

  const riser = c.createBufferSource();
  riser.buffer = noiseBuffer(c, 2.2);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + 2.0);
  const rg = c.createGain();
  rg.gain.setValueAtTime(0.0001, t);
  rg.gain.exponentialRampToValueAtTime(0.14, t + 1.9);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 2.15);
  riser.connect(bp).connect(rg).connect(c.destination);
  riser.start(t);
  riser.onended = () => { riser.disconnect(); bp.disconnect(); rg.disconnect(); };

  // impact: sub drop
  const imp = c.createOscillator();
  imp.type = 'sine';
  imp.frequency.setValueAtTime(120, t + 2.0);
  imp.frequency.exponentialRampToValueAtTime(30, t + 2.9);
  const ig = c.createGain();
  ig.gain.setValueAtTime(0.0001, t + 2.0);
  ig.gain.exponentialRampToValueAtTime(0.2, t + 2.03);
  ig.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
  imp.connect(ig).connect(c.destination);
  imp.start(t + 2.0);
  imp.stop(t + 3.5);
  imp.onended = () => { imp.disconnect(); ig.disconnect(); };

  // impact: crash noise
  const crash = c.createBufferSource();
  crash.buffer = noiseBuffer(c, 1.2);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const cg = c.createGain();
  cg.gain.setValueAtTime(0.11, t + 2.0);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
  crash.connect(hp).connect(cg).connect(c.destination);
  crash.start(t + 2.0);
  crash.onended = () => { crash.disconnect(); hp.disconnect(); cg.disconnect(); };
}

/**
 * Original finale score for stage 3 — slower, heavier, more cinematic than the
 * stage-2 groove: D-minor open-fifth pedal, wide detuned pads breathing in slow
 * swells, a huge half-time boom, sparse metallic ticks and a solemn octave
 * bell. Look-ahead scheduler; returns a stop fn.
 */
export function startMatrixFinale(): () => void {
  const c = ensureCtx();

  const master = c.createGain();
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(FINALE_LEVEL, c.currentTime + 2.2);
  finaleMaster = master; // registered so the break impacts can duck the score
  const glue = c.createBiquadFilter();
  glue.type = 'lowpass';
  glue.frequency.value = 5200;
  const comp = c.createDynamicsCompressor();
  master.connect(glue).connect(comp).connect(c.destination);

  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

  // continuous voices: deep pedal (D1 + A1) and a slow-breathing pad (D3 A3 D4)
  const sustained: { osc: OscillatorNode; g: GainNode }[] = [];
  const addSustained = (midi: number, type: OscillatorType, gain: number, lp: number, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi);
    o.detune.value = detune;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(f).connect(g).connect(master);
    o.start();
    sustained.push({ osc: o, g });
  };
  addSustained(26, 'sawtooth', 0.16, 220);        // D1 pedal
  addSustained(33, 'sawtooth', 0.1, 260);         // A1 fifth
  addSustained(50, 'sawtooth', 0.05, 900, -7);    // pad D3
  addSustained(50, 'sawtooth', 0.05, 900, 7);
  addSustained(57, 'sawtooth', 0.04, 900, -5);    // pad A3
  addSustained(62, 'sawtooth', 0.035, 1100, 5);   // pad D4

  // slow swell LFO on the master (8s breathing)
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.125;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.09;
  lfo.connect(lfoDepth).connect(master.gain);
  lfo.start();

  const boom = (t: number) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 1.5);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };

  const tick = (t: number) => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.04);
    const bpF = c.createBiquadFilter();
    bpF.type = 'bandpass';
    bpF.frequency.value = 5200 + Math.random() * 2400;
    bpF.Q.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(bpF).connect(g).connect(master);
    src.start(t); src.stop(t + 0.05);
    src.onended = () => { src.disconnect(); bpF.disconnect(); g.disconnect(); };
  };

  const bell = (t: number, midi: number) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 1.7);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };

  // half-time grid at 64 bpm: boom on beat 1, ticks off-grid, bell each 2 bars
  const beat = 60 / 64;
  const BAR = 4; // beats per bar
  let step = 0;
  let next = c.currentTime + 0.15;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    while (next < c.currentTime + 0.25) {
      const inBar = step % BAR;
      const bar = Math.floor(step / BAR);
      if (inBar === 0) boom(next);
      if (inBar === 2 && Math.random() < 0.8) tick(next + beat * 0.5);
      if (inBar === 0 && bar % 2 === 1) bell(next, bar % 4 === 1 ? 74 : 69); // D5 / A4
      next += beat;
      step++;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 60);

  return () => {
    if (stopped) return;
    stopped = true;
    if (finaleMaster === master) finaleMaster = null;
    clearInterval(timer);
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.5);
    const end = now + 0.55;
    sustained.forEach(({ osc }) => osc.stop(end));
    lfo.stop(end);
    window.setTimeout(() => {
      try {
        sustained.forEach(({ osc, g }) => { osc.disconnect(); g.disconnect(); });
        lfo.disconnect(); lfoDepth.disconnect();
        master.disconnect(); glue.disconnect(); comp.disconnect();
      } catch {}
    }, 700);
  };
}

/** Countdown blip — one per number; the final one hits harder. */
export function playCountdownTick(n: number): void {
  const c = ensureCtx();
  const t = c.currentTime;
  const final = n <= 1;

  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = final ? 1180 : 880;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(final ? 0.13 : 0.085, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (final ? 0.3 : 0.12));
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + 0.32);
  o.onended = () => { o.disconnect(); g.disconnect(); };

  // sub thump under each tick
  const s = c.createOscillator();
  s.type = 'sine';
  s.frequency.setValueAtTime(150, t);
  s.frequency.exponentialRampToValueAtTime(48, t + 0.16);
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  s.connect(sg).connect(c.destination);
  s.start(t); s.stop(t + 0.26);
  s.onended = () => { s.disconnect(); sg.disconnect(); };
}

/**
 * Plays Med's real glass-break clip for the whole shatter. The silent lead-in
 * is trimmed (starts at BREAK_OFFSET) so the first smash lands the instant the
 * visual cracks; the finale score ducks under it in two dips timed to the two
 * audible hits (BREAK_HIT1 / BREAK_HIT2) so each smash punches. Falls back to
 * a synthesized crash only if the clip somehow failed to load.
 */
let lastBreakAt = 0;
export function playGlassBreak(): void {
  const c = ensureCtx();
  // guard against a rapid double-trigger (React StrictMode double-invokes the
  // shatter effect in dev) so the smash never plays twice / phases
  const nowMs = performance.now();
  if (nowMs - lastBreakAt < 700) return;
  lastBreakAt = nowMs;
  const buf = breakBufferPromise;
  // duck the score on both hits regardless of which path plays
  duckFinale(0.12, 260, 700);
  window.setTimeout(() => duckFinale(0.1, 300, 1100), BREAK_HIT2 * 1000);

  if (!buf) { synthCrashFallback(c); preloadGlassBreak(); return; }
  buf.then((b) => {
    if (!b) { synthCrashFallback(c); return; }
    const src = c.createBufferSource();
    src.buffer = b;
    const g = c.createGain();
    g.gain.value = 1.0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    src.connect(g).connect(comp).connect(c.destination);
    src.start(c.currentTime, BREAK_OFFSET); // skip the silent run-in
    src.onended = () => { try { src.disconnect(); g.disconnect(); comp.disconnect(); } catch {} };
  });
}

/** Only used if the MP3 can't be fetched/decoded — a short synth smash. */
function synthCrashFallback(c: AudioContext): void {
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.0);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  src.connect(hp).connect(g).connect(c.destination);
  src.start(t);
  src.onended = () => { src.disconnect(); hp.disconnect(); g.disconnect(); };
}

/** Short rising zap + static tick when re-entering the desktop. */
export function playReenterZap(): void {
  const c = ensureCtx();
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(85, t);
  osc.frequency.exponentialRampToValueAtTime(920, t + 0.2);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t); osc.stop(t + 0.26);
  osc.onended = () => { osc.disconnect(); oscGain.disconnect(); };

  const tick = c.createBufferSource();
  tick.buffer = noiseBuffer(c, 0.09);
  const tickBand = c.createBiquadFilter();
  tickBand.type = 'bandpass';
  tickBand.frequency.value = 2600;
  tickBand.Q.value = 0.8;
  const tickGain = c.createGain();
  tickGain.gain.setValueAtTime(0.06, t);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  tick.connect(tickBand).connect(tickGain).connect(c.destination);
  tick.start(t);
  tick.onended = () => { tick.disconnect(); tickBand.disconnect(); tickGain.disconnect(); };
}
