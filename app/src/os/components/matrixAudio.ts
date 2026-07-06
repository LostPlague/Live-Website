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
