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

/** 1.4s stereo decaying-noise impulse — the "room" the big breaks ring in. */
let impulseBuf: AudioBuffer | null = null;
function impulse(c: AudioContext): AudioBuffer {
  if (impulseBuf && impulseBuf.sampleRate === c.sampleRate) return impulseBuf;
  const len = Math.ceil(c.sampleRate * 1.4);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  impulseBuf = buf;
  return buf;
}

function distortionCurve(k: number): Float32Array {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
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

/**
 * Impact bus: local compressor to hold peaks + a convolver send for the tail.
 * Returns the entry gain; everything self-severs after `life` ms.
 */
function impactBus(c: AudioContext, wetLevel: number, life: number): GainNode {
  const bus = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 7;
  const verb = c.createConvolver();
  verb.buffer = impulse(c);
  const wet = c.createGain();
  wet.gain.value = wetLevel;
  bus.connect(comp).connect(c.destination);
  bus.connect(verb).connect(wet).connect(comp);
  window.setTimeout(() => {
    try { bus.disconnect(); verb.disconnect(); wet.disconnect(); comp.disconnect(); } catch {}
  }, life);
  return bus;
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
 * The break is THREE hits matched to the visuals:
 *   playImpactPop        — the first strike: snap, glass ping, sub thump.
 *   playCatastrophicBreak— the web races out: deep sub DROP, distorted crunch,
 *                          crackle train, metallic shriek, slapback echo,
 *                          reverb tail — and the music ducks out of its way.
 *   playCollapseCascade  — the glass lets go: body thumps, rumble, whoosh,
 *                          26 stereo shard tinkles raining down.
 */
export function playImpactPop(): void {
  const c = ensureCtx();
  const t = c.currentTime;
  const bus = impactBus(c, 0.18, 1600);

  // snap click
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.07);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  src.connect(hp).connect(g).connect(bus);
  src.start(t);
  src.onended = () => { src.disconnect(); hp.disconnect(); g.disconnect(); };

  // stressed-glass ping
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 3300;
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.1, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(og).connect(bus);
  o.start(t); o.stop(t + 0.35);
  o.onended = () => { o.disconnect(); og.disconnect(); };

  // sub thump so the strike has a body
  const s = c.createOscillator();
  s.type = 'sine';
  s.frequency.setValueAtTime(120, t);
  s.frequency.exponentialRampToValueAtTime(48, t + 0.14);
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  s.connect(sg).connect(bus);
  s.start(t); s.stop(t + 0.3);
  s.onended = () => { s.disconnect(); sg.disconnect(); };

  // tension creak — the pane is about to lose
  const cr = c.createOscillator();
  cr.type = 'sawtooth';
  cr.frequency.setValueAtTime(150, t + 0.05);
  cr.frequency.exponentialRampToValueAtTime(84, t + 0.4);
  const crg = c.createGain();
  crg.gain.setValueAtTime(0.0001, t + 0.05);
  crg.gain.exponentialRampToValueAtTime(0.05, t + 0.09);
  crg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  cr.connect(crg).connect(bus);
  cr.start(t + 0.05); cr.stop(t + 0.46);
  cr.onended = () => { cr.disconnect(); crg.disconnect(); };
}

export function playCatastrophicBreak(): void {
  const c = ensureCtx();
  const t = c.currentTime;
  duckFinale(0.1, 300, 1000);
  const bus = impactBus(c, 0.34, 2600);

  // deep sub DROP — the floor falls out
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(140, t);
  sub.frequency.exponentialRampToValueAtTime(26, t + 0.55);
  const subG = c.createGain();
  subG.gain.setValueAtTime(0.0001, t);
  subG.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
  subG.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
  sub.connect(subG).connect(bus);
  sub.start(t); sub.stop(t + 1.4);
  sub.onended = () => { sub.disconnect(); subG.disconnect(); };

  // distorted crunch — waveshaped noise swept down through the wreck
  const cr = c.createBufferSource();
  cr.buffer = noiseBuffer(c, 0.55);
  const shaper = c.createWaveShaper();
  shaper.curve = distortionCurve(13);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.exponentialRampToValueAtTime(320, t + 0.5);
  const cg = c.createGain();
  cg.gain.setValueAtTime(0.5, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  cr.connect(shaper).connect(bp).connect(cg).connect(bus);
  cr.start(t);
  cr.onended = () => { cr.disconnect(); shaper.disconnect(); bp.disconnect(); cg.disconnect(); };

  // slapback echo on the crunch — sells the size of the space
  const delay = c.createDelay(0.5);
  delay.delayTime.value = 0.13;
  const fb = c.createGain();
  fb.gain.value = 0.32;
  const slap = c.createGain();
  slap.gain.setValueAtTime(0.3, t);
  slap.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  cg.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(slap).connect(bus);
  window.setTimeout(() => {
    try { delay.disconnect(); fb.disconnect(); slap.disconnect(); } catch {}
  }, 2400);

  // crackle train — the web propagating, 16 micro-fractures
  for (let i = 0; i < 16; i++) {
    const st = t + Math.random() * 0.33;
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, 0.02);
    const nh = c.createBiquadFilter();
    nh.type = 'highpass';
    nh.frequency.value = 3000 + Math.random() * 3200;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.1 + Math.random() * 0.2, st);
    ng.gain.exponentialRampToValueAtTime(0.0001, st + 0.03);
    n.connect(nh).connect(ng).connect(bus);
    n.start(st);
    n.onended = () => { n.disconnect(); nh.disconnect(); ng.disconnect(); };
  }

  // metallic shriek — two detuned squares screaming briefly
  [1870, 1883].forEach((f) => {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const oh = c.createBiquadFilter();
    oh.type = 'highpass';
    oh.frequency.value = 1200;
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(oh).connect(og).connect(bus);
    o.start(t); o.stop(t + 0.34);
    o.onended = () => { o.disconnect(); oh.disconnect(); og.disconnect(); };
  });
}

export function playCollapseCascade(): void {
  const c = ensureCtx();
  const t = c.currentTime;
  duckFinale(0.22, 220, 1100);
  const bus = impactBus(c, 0.3, 3000);

  // body: impact + deep after-shock
  const thump = (at: number, f0: number, f1: number, gain: number, dur: number) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.6);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(og).connect(bus);
    o.start(at); o.stop(at + dur + 0.05);
    o.onended = () => { o.disconnect(); og.disconnect(); };
  };
  thump(t, 95, 30, 0.5, 0.7);
  thump(t + 0.12, 62, 22, 0.4, 0.95);

  // rumble under the fall
  const rum = c.createBufferSource();
  rum.buffer = noiseBuffer(c, 1.3);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const rg = c.createGain();
  rg.gain.setValueAtTime(0.32, t);
  rg.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  rum.connect(lp).connect(rg).connect(bus);
  rum.start(t);
  rum.onended = () => { rum.disconnect(); lp.disconnect(); rg.disconnect(); };

  // whoosh of the pane letting go
  const wh = c.createBufferSource();
  wh.buffer = noiseBuffer(c, 0.8);
  const wbp = c.createBiquadFilter();
  wbp.type = 'bandpass';
  wbp.Q.value = 1.2;
  wbp.frequency.setValueAtTime(900, t);
  wbp.frequency.exponentialRampToValueAtTime(180, t + 0.75);
  const wg = c.createGain();
  wg.gain.setValueAtTime(0.2, t);
  wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  wh.connect(wbp).connect(wg).connect(bus);
  wh.start(t);
  wh.onended = () => { wh.disconnect(); wbp.disconnect(); wg.disconnect(); };

  // 26 shard tinkles raining across the stereo field
  for (let i = 0; i < 26; i++) {
    const st = t + 0.03 + Math.random() * 1.05;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 1600 + Math.random() * 5000;
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, st);
    og.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.05, st + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, st + 0.1 + Math.random() * 0.22);
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    o.connect(og).connect(pan).connect(bus);
    o.start(st); o.stop(st + 0.38);
    o.onended = () => { o.disconnect(); og.disconnect(); pan.disconnect(); };
  }
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
