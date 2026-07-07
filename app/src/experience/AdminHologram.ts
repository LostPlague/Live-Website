import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// The Admin's presence layer — CSS3D chrome around the WebGL face hologram
// (the face mesh lives in RoomMatrix): a big "ADMIN" floating over the head.
// The message is typed on the OS screen and SPOKEN here, line by line, with
// callbacks per line so the OS typewriter advances in step with the voice.
// Voice: smoothest available (neural "Natural" voices in Edge → Google voices
// in Chrome → any English), natural register — AI-smooth, not robot-growl —
// over a synthesized "transmission bed" (sub hum + carrier shimmer + data
// chirps; WebAudio, no files). The way back is the OS-side vortex, so this
// layer has no button anymore. All text is our own.

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

/** Smoothest available English voice: neural > Google > named modern > any. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  const en = vs.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return (
    en.find((v) => /natural/i.test(v.name)) ||
    en.find((v) => /neural|online/i.test(v.name)) ||
    en.find((v) => /google/i.test(v.name)) ||
    en.find((v) => /aria|jenny|guy|ryan|libby|sonia/i.test(v.name)) ||
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
  private stopBed: (() => void) | null = null;
  private disposed = false;

  constructor() {
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
   * Speaks the address line by line. `onLineStart(i)` fires as each line
   * begins (the OS types that line in step); `onDone()` fires after the last
   * line (the OS starts the countdown). Works without TTS too: lines are then
   * paced on timers so the experience never stalls.
   */
  public present(lines: string[], onLineStart: (i: number) => void, onDone: () => void) {
    this.timers.push(window.setTimeout(async () => {
      if (this.disposed) return;
      this.stopBed = startTransmissionBed();

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
          onLineStart(i);
          const pause = !text ? 380 : 500 + text.length * 52;
          this.timers.push(window.setTimeout(next, pause));
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.rate = 0.95;   // natural pace —
        u.pitch = 0.9;   // — natural register: smooth AI, not robot growl
        u.volume = 1.0;
        u.onstart = () => onLineStart(i);
        u.onend = () => { this.timers.push(window.setTimeout(next, 200)); };
        u.onerror = () => { onLineStart(i); this.timers.push(window.setTimeout(next, 400)); };
        window.speechSynthesis.speak(u);
      };
      next();

      // absolute safety net — never strand the visitor before the countdown
      this.timers.push(window.setTimeout(() => {
        if (!this.disposed && idx < lines.length) { idx = lines.length; onDone(); }
      }, 75000));
    }, 1100)); // after the flicker-in
  }

  private stopAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
