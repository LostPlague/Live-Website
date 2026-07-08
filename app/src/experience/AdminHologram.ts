import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// The Admin's presence layer — CSS3D chrome around the WebGL face hologram
// (the face mesh lives in RoomMatrix): a big "ADMIN" floating over the head.
// The message is typed on the OS screen and SPOKEN here, line by line, with
// callbacks per line so the OS typewriter advances in step with the voice.
// Voice: Med's generated Admin clip (his own ElevenLabs asset) played through
// WebAudio with a hardcoded cue table — each cue fires the matching typed
// line at the exact second it is spoken. Browser TTS remains as the fallback
// if the clip can't load. Everything rides over a synthesized "transmission
// bed" (sub hum + carrier shimmer + data chirps; WebAudio, no files). The way
// back is the OS-side vortex, so this layer has no button anymore.

const HOLO_CSS = `
.admin-holo {
  width: 980px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  font-family: 'Courier New', monospace;
}
.admin-holo-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: holo-flicker 4.7s steps(1) infinite;
}
.admin-holo--in .admin-holo-inner {
  animation: holo-in 0.9s steps(12) both, holo-flicker 4.7s 0.9s steps(1) infinite;
}
.admin-holo--out { animation: holo-out 0.45s steps(8) both; }
@keyframes holo-in {
  0% { opacity: 0; transform: scaleY(0.02); filter: brightness(4); }
  30% { opacity: 0.6; transform: scaleY(1.06); filter: brightness(2.4); }
  45% { opacity: 0.2; }
  60% { opacity: 0.9; transform: scaleY(0.98); }
  75% { opacity: 0.5; }
  100% { opacity: 1; transform: scaleY(1); filter: brightness(1); }
}
@keyframes holo-out {
  0% { opacity: 1; transform: scaleY(1); }
  40% { opacity: 0.5; transform: scaleY(1.04); filter: brightness(3); }
  100% { opacity: 0; transform: scaleY(0.01); filter: brightness(6); }
}
@keyframes holo-flicker {
  0%, 88%, 100% { opacity: 1; }
  89% { opacity: 0.55; }
  90% { opacity: 0.95; }
  93% { opacity: 0.7; }
  94% { opacity: 1; }
}
.admin-holo-title {
  margin: 0;
  font-size: 96px;
  font-weight: bold;
  letter-spacing: 26px;
  color: #b4ffcf;
  text-shadow: 0 0 22px rgba(0, 255, 65, 1), 0 0 60px rgba(0, 255, 65, 0.6);
  animation: holo-title-pulse 2.4s ease-in-out infinite;
}
@keyframes holo-title-pulse {
  0%, 100% { text-shadow: 0 0 18px rgba(0,255,65,0.9), 0 0 46px rgba(0,255,65,0.5); }
  50% { text-shadow: 0 0 34px rgba(0,255,65,1), 0 0 84px rgba(0,255,65,0.7); }
}
/* transparent window the WebGL face shows through */
.admin-holo-gap {
  height: 820px;
  pointer-events: none;
}
`;

// ── synthesized transmission bed (parent-side WebAudio, no assets) ──────────
let bedCtx: AudioContext | null = null;

// ── the Admin's real voice ──────────────────────────────────────────────────
// Cue table: L3_LINES index → the second (in the clip) its typing starts.
// Derived by silence-gap analysis of THIS exact clip; if the voice file is
// ever regenerated, the cues must be re-derived. Blank lines get cues too so
// the on-screen paragraph breaks land between sentences, and the signature
// types over the clip's tail. Played as an AudioBufferSourceNode on the bed
// context — a running AudioContext needs no fresh user gesture.
const VOICE_SRC = '/audio/admin_voice.mp3';
const VOICE_CUES: { line: number; t: number }[] = [
  { line: 0, t: 0.09 },   // WELCOME BACK, OPERATOR.
  { line: 1, t: 1.72 },   // You have reached the final level.
  { line: 2, t: 3.3 },
  { line: 3, t: 3.52 },   // Dreams sold as truth.
  { line: 4, t: 5.3 },    // Machines that pass as human.
  { line: 5, t: 7.34 },   // And the currency every thought
  { line: 6, t: 9.05 },   // is paid for in.
  { line: 7, t: 9.95 },
  { line: 8, t: 10.31 },  // Three gates. Three answers.
  { line: 9, t: 12.51 },  // No wrong turns.
  { line: 10, t: 13.63 },
  { line: 11, t: 13.84 }, // Every agent, every answer,
  { line: 12, t: 14.95 }, // every world like this one —
  { line: 13, t: 16.01 }, // all of it runs on tokens.
  { line: 14, t: 19.29 },
  { line: 15, t: 19.63 }, // Spend yours on things worth building.
  { line: 16, t: 21.62 },
  { line: 17, t: 21.72 }, // — M.T. // ADMIN (typed over the tail, not spoken)
];

let voiceBufferPromise: Promise<AudioBuffer | null> | null = null;

/** Fetch + decode the clip once per page; resolves null on any failure. */
function loadVoiceBuffer(): Promise<AudioBuffer | null> {
  if (voiceBufferPromise) return voiceBufferPromise;
  voiceBufferPromise = (async () => {
    try {
      bedCtx = bedCtx || new AudioContext();
      const res = await fetch(VOICE_SRC);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return await bedCtx.decodeAudioData(ab);
    } catch {
      voiceBufferPromise = null; // allow a retry on the next run
      return null;
    }
  })();
  return voiceBufferPromise;
}

function startTransmissionBed(): () => void {
  try {
    bedCtx = bedCtx || new AudioContext();
    const c = bedCtx;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t = c.currentTime;

    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.045, t + 1.2);
    master.connect(c.destination);

    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 46;
    const subGain = c.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain).connect(master);
    sub.start(t);

    const s1 = c.createOscillator();
    s1.type = 'sine';
    s1.frequency.value = 208;
    const s2 = c.createOscillator();
    s2.type = 'sine';
    s2.frequency.value = 209.7;
    const sGain = c.createGain();
    sGain.gain.value = 0.16;
    s1.connect(sGain);
    s2.connect(sGain);
    sGain.connect(master);
    s1.start(t); s2.start(t);

    const chirps = window.setInterval(() => {
      if (Math.random() < 0.35) return;
      const now = c.currentTime;
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 1200 + Math.random() * 1700;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.22, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      o.connect(g).connect(master);
      o.start(now); o.stop(now + 0.06);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    }, 2100);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      clearInterval(chirps);
      const now = c.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      const end = now + 0.45;
      sub.stop(end); s1.stop(end); s2.stop(end);
      window.setTimeout(() => {
        try {
          sub.disconnect(); subGain.disconnect();
          s1.disconnect(); s2.disconnect(); sGain.disconnect();
          master.disconnect();
        } catch {}
      }, 600);
    };
  } catch {
    return () => {};
  }
}

/** Smoothest available MALE English voice: neural > Google > named > any male. */
const MALE_NAMES = /david|mark|guy|andrew|brian|christopher|eric|roger|steffan|ryan|george|james|liam|noah|thomas|\bmale\b/i;
const FEMALE_NAMES = /aria|jenny|zira|libby|sonia|michelle|emma|ava|natasha|clara|hazel|susan|linda|heather|catherine|\bfemale\b/i;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  const en = vs.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const maleEn = en.filter((v) => MALE_NAMES.test(v.name) && !FEMALE_NAMES.test(v.name));
  return (
    maleEn.find((v) => /natural/i.test(v.name)) ||
    maleEn.find((v) => /neural|online/i.test(v.name)) ||
    maleEn.find((v) => /google/i.test(v.name)) ||
    maleEn[0] ||
    en.find((v) => /natural/i.test(v.name) && !FEMALE_NAMES.test(v.name)) ||
    en.find((v) => !FEMALE_NAMES.test(v.name)) ||
    en[0] ||
    vs[0]
  );
}

/** getVoices() populates async in some browsers — wait briefly if empty. */
function voicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    if (window.speechSynthesis.getVoices().length > 0) return resolve();
    const done = () => { cleanup(); resolve(); };
    const cleanup = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    const timer = window.setTimeout(done, 1200);
  });
}

export class AdminHologram {
  public object: CSS3DObject;
  private el: HTMLDivElement;
  private timers: number[] = [];
  private pumps: number[] = [];
  private voiceNode: AudioBufferSourceNode | null = null;
  private stopBed: (() => void) | null = null;
  private disposed = false;

  constructor() {
    loadVoiceBuffer(); // start fetching/decoding during the flicker-in
    if (!document.getElementById('admin-holo-css')) {
      const style = document.createElement('style');
      style.id = 'admin-holo-css';
      style.textContent = HOLO_CSS;
      document.head.appendChild(style);
    }

    this.el = document.createElement('div');
    this.el.className = 'admin-holo admin-holo--in';

    const inner = document.createElement('div');
    inner.className = 'admin-holo-inner';

    // a <div>, deliberately: the shell's global `#experience-container p`
    // rule (ID specificity) would override our class styles on a <p> and
    // shrink the title to 16px white — exactly the unreadable-ADMIN bug.
    const title = document.createElement('div');
    title.className = 'admin-holo-title';
    title.textContent = 'ADMIN';

    const gap = document.createElement('div');
    gap.className = 'admin-holo-gap';

    inner.appendChild(title);
    inner.appendChild(gap);
    this.el.appendChild(inner);

    this.object = new CSS3DObject(this.el);
  }

  /**
   * Speaks the address line by line. `onLineStart(i, durMs)` fires as each
   * line begins (the OS types that line in step, paced to durMs); `onDone()`
   * fires after the last line (the OS starts the countdown). Preferred path:
   * Med's real voice clip with hardcoded cues. Fallbacks: browser TTS, then
   * plain timers — the experience never stalls.
   */
  public present(
    lines: string[],
    onLineStart: (i: number, durMs?: number) => void,
    onDone: () => void
  ) {
    this.timers.push(window.setTimeout(async () => {
      if (this.disposed) return;
      this.stopBed = startTransmissionBed();

      // ── path 1: the real clip (never wait on it more than 3.5s) ──────────
      const buf = await Promise.race([
        loadVoiceBuffer(),
        new Promise<null>((r) => this.timers.push(window.setTimeout(() => r(null), 3500))),
      ]);
      if (this.disposed) return;
      if (buf && bedCtx && bedCtx.state === 'running') {
        this.presentFromClip(buf, lines, onLineStart, onDone);
        return;
      }

      // ── path 2/3: browser TTS, or timers when even that is missing ───────
      const hasTTS = 'speechSynthesis' in window;
      if (hasTTS) {
        await voicesReady();
        if (this.disposed) return;
        window.speechSynthesis.cancel();
      }
      const voice = hasTTS ? pickVoice() : undefined;

      let idx = 0;
      const next = () => {
        if (this.disposed) return;
        if (idx >= lines.length) { onDone(); return; }
        const i = idx++;
        const text = lines[i];
        // blanks and the signature are typed, not spoken
        if (!text || text.startsWith('—') || !hasTTS) {
          const pause = !text ? 380 : 500 + text.length * 52;
          onLineStart(i, pause);
          this.timers.push(window.setTimeout(next, pause));
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        // the Admin's character: deliberately steady pace, perfectly neutral
        // mature register — calm, precise, a little too smooth. (The full
        // "metallic harmonic resonance" version needs a generated voice clip;
        // this is the closest browser TTS gets.)
        u.rate = 0.88;
        u.pitch = 1.0;
        u.volume = 1.0;
        // advance exactly once per line — onend when it fires, otherwise a
        // duration-estimate watchdog (some voices never deliver end events,
        // which used to stall the drive and desync voice from typing)
        let advanced = false;
        const advance = (delay: number) => {
          if (advanced || this.disposed) return;
          advanced = true;
          this.timers.push(window.setTimeout(next, delay));
        };
        u.onend = () => advance(200);
        u.onerror = () => advance(350);
        // drive the typing NOW — onstart is unreliable for some voices
        const words = Math.max(1, text.trim().split(/\s+/).length);
        const estMs = (words / 2.4) * 1000;
        onLineStart(i, estMs);
        this.timers.push(window.setTimeout(() => advance(0), 700 + estMs + 900));
        window.speechSynthesis.speak(u);
      };
      next();

      // absolute safety net — never strand the visitor before the countdown
      this.timers.push(window.setTimeout(() => {
        if (!this.disposed && idx < lines.length) { idx = lines.length; onDone(); }
      }, 75000));
    }, 1100)); // after the flicker-in
  }

  /**
   * Plays the real clip and fires each line's cue off the AUDIO CLOCK
   * (ctx.currentTime), so typing stays locked to the voice even if the tab
   * throttles timers. Cue pump is an interval, not rAF — rAF freezes in
   * hidden tabs and the audio keeps playing without it.
   */
  private presentFromClip(
    buf: AudioBuffer,
    lines: string[],
    onLineStart: (i: number, durMs?: number) => void,
    onDone: () => void
  ) {
    const c = bedCtx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 1.0;
    const comp = c.createDynamicsCompressor();
    src.connect(g).connect(comp).connect(c.destination);
    const t0 = c.currentTime + 0.06;
    src.start(t0);
    this.voiceNode = src;

    const cues = VOICE_CUES.filter((q) => q.line < lines.length);
    let ci = 0;
    let done = false;
    const finish = () => {
      if (done || this.disposed) return;
      done = true;
      // reveal anything still pending, then hand over to the countdown
      while (ci < cues.length) onLineStart(cues[ci++].line, 200);
      onDone();
    };
    const pump = window.setInterval(() => {
      if (this.disposed) { clearInterval(pump); return; }
      const at = c.currentTime - t0;
      while (ci < cues.length && at >= cues[ci].t) {
        const q = cues[ci];
        const nextT = ci + 1 < cues.length ? cues[ci + 1].t : buf.duration;
        onLineStart(q.line, Math.max(220, (nextT - q.t) * 1000));
        ci++;
      }
      if (at >= buf.duration + 0.45) { clearInterval(pump); finish(); }
    }, 30);
    this.pumps.push(pump);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
      comp.disconnect();
      this.timers.push(window.setTimeout(finish, 450));
    };
    // absolute safety net
    this.timers.push(window.setTimeout(finish, (buf.duration + 4) * 1000));
  }

  private stopAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try { this.voiceNode?.stop(); } catch {}
    this.voiceNode = null;
    this.pumps.forEach(clearInterval);
    this.pumps = [];
    this.stopBed?.();
    this.stopBed = null;
  }

  /** Flicker-out, then resolve so the owner can remove the object. */
  public dismiss(onGone: () => void) {
    this.disposed = true;
    this.stopAudio();
    this.el.classList.remove('admin-holo--in');
    this.el.classList.add('admin-holo--out');
    this.timers.push(window.setTimeout(onGone, 470));
  }

  public destroy() {
    this.disposed = true;
    this.stopAudio();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.el.remove();
  }
}
