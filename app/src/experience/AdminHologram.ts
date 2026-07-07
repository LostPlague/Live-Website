import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// The Admin's presence layer — CSS3D chrome around the WebGL face hologram
// (the face mesh itself lives in RoomMatrix): "ADMIN" floating over the head,
// and the way-out button under it. The message is typed on the OS screen and
// SPOKEN here: browser TTS pitched deep and slow, over a synthesized
// "transmission bed" (sub hum + detuned shimmer + data chirps — WebAudio, no
// files). The button reveals when the speech ends. No image/audio assets.

const HOLO_CSS = `
.admin-holo {
  width: 760px;
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
  font-size: 64px;
  font-weight: bold;
  letter-spacing: 22px;
  color: #7fffab;
  text-shadow: 0 0 20px rgba(0, 255, 65, 0.95), 0 0 48px rgba(0, 255, 65, 0.55);
  animation: holo-title-pulse 2.4s ease-in-out infinite;
}
@keyframes holo-title-pulse {
  0%, 100% { text-shadow: 0 0 16px rgba(0,255,65,0.85), 0 0 38px rgba(0,255,65,0.45); }
  50% { text-shadow: 0 0 30px rgba(0,255,65,1), 0 0 70px rgba(0,255,65,0.65); }
}
/* transparent window the WebGL face shows through */
.admin-holo-gap {
  height: 780px;
  pointer-events: none;
}
.admin-holo-btn {
  padding: 18px 38px;
  background: rgba(0, 20, 0, 0.85);
  border: 1px solid #00ff41;
  color: #00ff41;
  font-family: 'Courier New', monospace;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 3px;
  cursor: pointer;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.7s ease, background 0.15s ease, color 0.15s ease;
  text-shadow: 0 0 10px rgba(0, 255, 65, 0.9);
  box-shadow: 0 0 22px rgba(0, 255, 65, 0.35), inset 0 0 12px rgba(0, 255, 65, 0.15);
}
.admin-holo-btn--on { opacity: 1; animation: holo-title-pulse 1.6s ease-in-out infinite; }
.admin-holo-btn:hover { background: #00ff41; color: #000; }
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
    master.gain.exponentialRampToValueAtTime(0.05, t + 1.2);
    master.connect(c.destination);

    // deep carrier hum
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 46;
    const subGain = c.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain).connect(master);
    sub.start(t);

    // detuned shimmer pair (slow beat — "signal carrier")
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

    // sparse data chirps
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

export class AdminHologram {
  public object: CSS3DObject;
  private el: HTMLDivElement;
  private btnEl!: HTMLButtonElement;
  private timers: number[] = [];
  private stopBed: (() => void) | null = null;

  constructor(onDismiss: () => void) {
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

    const title = document.createElement('p');
    title.className = 'admin-holo-title';
    title.textContent = 'ADMIN';

    const gap = document.createElement('div');
    gap.className = 'admin-holo-gap';

    this.btnEl = document.createElement('button');
    this.btnEl.className = 'admin-holo-btn';
    this.btnEl.textContent = '[ RE-ENTER THE SIMULATION ]';
    this.btnEl.addEventListener('mousedown', onDismiss);

    inner.appendChild(title);
    inner.appendChild(gap);
    inner.appendChild(this.btnEl);
    this.el.appendChild(inner);

    this.object = new CSS3DObject(this.el);
  }

  /**
   * The Admin speaks (deep, slow browser TTS over the transmission bed); the
   * way out reveals when the speech ends. Swap for a recorded clip later by
   * replacing the utterance with an <audio>/WebAudio source here.
   */
  public present(lines: string[]) {
    this.timers.push(window.setTimeout(() => {
      this.stopBed = startTransmissionBed();

      if (!('speechSynthesis' in window)) {
        this.timers.push(window.setTimeout(() => this.revealButton(), 6500));
        return;
      }
      const text = lines.filter((l) => l && !l.startsWith('—')).join(' ');
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const pick =
        voices.find((v) => /^en/i.test(v.lang) && /david|daniel|george|ryan|guy|male/i.test(v.name)) ||
        voices.find((v) => /^en/i.test(v.lang));
      if (pick) u.voice = pick;
      u.rate = 0.82;   // slower —
      u.pitch = 0.35;  // — and deeper: transmission from something large
      u.volume = 1.0;
      u.onend = () => this.revealButton();
      u.onerror = () => this.revealButton();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      // safety net: never strand the visitor if speech events go missing
      this.timers.push(window.setTimeout(() => this.revealButton(), 45000));
    }, 1100)); // after the flicker-in
  }

  private revealButton() {
    this.btnEl.classList.add('admin-holo-btn--on');
  }

  private stopAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.stopBed?.();
    this.stopBed = null;
  }

  /** Flicker-out, then resolve so the owner can remove the object. */
  public dismiss(onGone: () => void) {
    this.stopAudio();
    this.el.classList.remove('admin-holo--in');
    this.el.classList.add('admin-holo--out');
    this.timers.push(window.setTimeout(onGone, 470));
  }

  public destroy() {
    this.stopAudio();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.btnEl.replaceWith(this.btnEl.cloneNode(true)); // drop listener
    this.el.remove();
  }
}
