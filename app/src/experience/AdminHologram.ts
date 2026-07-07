import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// The Admin — a holographic figure projected above the desk at the end of
// stage 3. A dark, mysterious human silhouette (face in shadow) with a green
// rim-glow, rolling scanlines and projection flicker; "ADMIN" floats over the
// head, the congratulation message types out beside him, and a single button
// returns the visitor to the simulation. Built as a CSS3DObject (same pipeline
// as the monitor iframe) so the text is crisp and the button is clickable.
// All visuals are generated here — no image assets.

const HOLO_CSS = `
.admin-holo {
  width: 1500px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 60px;
  pointer-events: none;
  font-family: 'Courier New', monospace;
}
.admin-holo-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: holo-bob 5.2s ease-in-out infinite, holo-flicker 4.7s steps(1) infinite;
}
.admin-holo--in .admin-holo-inner { animation: holo-in 0.9s steps(12) both, holo-bob 5.2s 0.9s ease-in-out infinite, holo-flicker 4.7s 0.9s steps(1) infinite; }
.admin-holo--out { animation: holo-out 0.45s steps(8) both; }
@keyframes holo-in {
  0% { opacity: 0; transform: scaleY(0.02) translateY(300px); filter: brightness(4); }
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
@keyframes holo-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-26px); } }
@keyframes holo-flicker {
  0%, 88%, 100% { opacity: 1; }
  89% { opacity: 0.55; }
  90% { opacity: 0.95; }
  93% { opacity: 0.7; }
  94% { opacity: 1; }
}
.admin-holo-title {
  margin: 0 0 18px;
  font-size: 44px;
  font-weight: bold;
  letter-spacing: 18px;
  color: #7fffab;
  text-shadow: 0 0 18px rgba(0, 255, 65, 0.9), 0 0 40px rgba(0, 255, 65, 0.5);
  animation: holo-title-pulse 2.4s ease-in-out infinite;
}
@keyframes holo-title-pulse {
  0%, 100% { text-shadow: 0 0 14px rgba(0,255,65,0.8), 0 0 34px rgba(0,255,65,0.4); }
  50% { text-shadow: 0 0 26px rgba(0,255,65,1), 0 0 60px rgba(0,255,65,0.6); }
}
.admin-holo-figure {
  position: relative;
  width: 340px;
  height: 620px;
}
.admin-holo-figure svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 8px rgba(0, 255, 65, 0.65)) drop-shadow(0 0 30px rgba(0, 255, 65, 0.3));
}
.admin-holo-backglow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(0, 255, 65, 0.35) 0%, rgba(0, 255, 65, 0) 65%);
  pointer-events: none;
}
.admin-holo-scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 255, 65, 0) 0px,
    rgba(0, 255, 65, 0) 5px,
    rgba(0, 255, 65, 0.14) 6px,
    rgba(0, 255, 65, 0) 7px
  );
  mix-blend-mode: screen;
  animation: holo-scan-roll 3.5s linear infinite;
  pointer-events: none;
}
@keyframes holo-scan-roll { to { background-position: 0 140px; } }
.admin-holo-beam {
  width: 380px;
  height: 420px;
  margin-top: -8px;
  background: linear-gradient(to bottom, rgba(0, 255, 65, 0.28), rgba(0, 255, 65, 0));
  clip-path: polygon(42% 0, 58% 0, 88% 100%, 12% 100%);
  pointer-events: none;
}
.admin-holo-side {
  padding-top: 120px;
  width: 720px;
  display: flex;
  flex-direction: column;
}
.admin-holo-msg {
  min-height: 460px;
  margin: 0;
  font-size: 26px;
  line-height: 1.5;
  color: #00ff41;
  text-shadow: 0 0 10px rgba(0, 255, 65, 0.8), 1px 1px 0 #000;
  white-space: pre-wrap;
}
.admin-holo-cursor { animation: holo-cursor 1s steps(1) infinite; }
@keyframes holo-cursor { 50% { opacity: 0; } }
.admin-holo-btn {
  align-self: flex-start;
  margin-top: 26px;
  padding: 16px 34px;
  background: rgba(0, 20, 0, 0.85);
  border: 1px solid #00ff41;
  color: #00ff41;
  font-family: 'Courier New', monospace;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 3px;
  cursor: pointer;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.7s ease, background 0.15s ease, color 0.15s ease;
  text-shadow: 0 0 10px rgba(0, 255, 65, 0.9);
  box-shadow: 0 0 20px rgba(0, 255, 65, 0.35), inset 0 0 12px rgba(0, 255, 65, 0.15);
}
.admin-holo-btn--on { opacity: 1; animation: holo-title-pulse 1.6s ease-in-out infinite; }
.admin-holo-btn:hover { background: #00ff41; color: #000; }
`;

// A suited human silhouette, face fully in shadow — drawn as a single dark
// shape with a faint green core so it reads as an unstable projection.
const FIGURE_SVG = `
<svg viewBox="0 0 200 380" xmlns="http://www.w3.org/2000/svg">
  <g>
    <!-- head (face stays dark) -->
    <ellipse cx="100" cy="44" rx="27" ry="31" fill="#02130a" stroke="rgba(0,255,65,0.55)" stroke-width="1.6"/>
    <!-- body: shoulders, suit torso, arms at sides, legs -->
    <path d="M100 74
             C 86 74 80 82 76 90
             C 56 95 42 106 38 128
             L 32 208
             C 31 226 36 238 45 243
             L 52 245
             L 54 300 L 60 372 L 84 372 L 89 302 L 93 250
             L 107 250 L 111 302 L 116 372 L 140 372 L 146 300 L 148 245
             L 155 243
             C 164 238 169 226 168 208
             L 162 128
             C 158 106 144 95 124 90
             C 120 82 114 74 100 74 Z"
          fill="#02130a" stroke="rgba(0,255,65,0.55)" stroke-width="1.6"/>
    <!-- faint tie / core light -->
    <path d="M100 92 L 106 104 L 100 178 L 94 104 Z" fill="rgba(0,255,65,0.28)"/>
  </g>
</svg>
`;

export class AdminHologram {
  public object: CSS3DObject;
  private el: HTMLDivElement;
  private msgEl!: HTMLParagraphElement;
  private btnEl!: HTMLButtonElement;
  private timers: number[] = [];

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

    const figure = document.createElement('div');
    figure.className = 'admin-holo-figure';
    figure.innerHTML = FIGURE_SVG;
    const backglow = document.createElement('div');
    backglow.className = 'admin-holo-backglow';
    const scan = document.createElement('div');
    scan.className = 'admin-holo-scan';
    figure.appendChild(backglow);
    figure.appendChild(scan);

    const beam = document.createElement('div');
    beam.className = 'admin-holo-beam';

    inner.appendChild(title);
    inner.appendChild(figure);
    inner.appendChild(beam);

    const side = document.createElement('div');
    side.className = 'admin-holo-side';
    this.msgEl = document.createElement('p');
    this.msgEl.className = 'admin-holo-msg';
    this.btnEl = document.createElement('button');
    this.btnEl.className = 'admin-holo-btn';
    this.btnEl.textContent = '[ RE-ENTER THE SIMULATION ]';
    this.btnEl.addEventListener('mousedown', onDismiss);
    side.appendChild(this.msgEl);
    side.appendChild(this.btnEl);

    this.el.appendChild(inner);
    this.el.appendChild(side);

    this.object = new CSS3DObject(this.el);
  }

  /**
   * Speaks the message aloud via the browser's built-in TTS — no audio files.
   * Deep/slow settings sell the "entity" feel; swap for a recorded clip later
   * by replacing this method. No-op where speechSynthesis is unavailable.
   */
  private speak(lines: string[]) {
    if (!('speechSynthesis' in window)) return;
    const text = lines.filter((l) => l && !l.startsWith('—')).join(' ');
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const pick =
      voices.find((v) => /^en/i.test(v.lang) && /david|daniel|george|ryan|guy|male/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (pick) u.voice = pick;
    u.rate = 0.92;
    u.pitch = 0.55; // low = ominous
    u.volume = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  private stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  /** Types the message line by line (and speaks it); reveals the button when done. */
  public typeMessage(lines: string[]) {
    let line = 0;
    let ch = 0;
    const acc: string[] = [];
    const render = () => {
      this.msgEl.textContent = acc.join('\n');
    };
    const type = () => {
      if (line >= lines.length) {
        this.btnEl.classList.add('admin-holo-btn--on');
        return;
      }
      const target = lines[line];
      if (target.length === 0) {
        acc[line] = '';
        line++;
        render();
        this.timers.push(window.setTimeout(type, 220));
        return;
      }
      ch++;
      acc[line] = target.slice(0, ch);
      render();
      if (ch >= target.length) {
        line++;
        ch = 0;
        this.timers.push(window.setTimeout(type, 340));
      } else {
        this.timers.push(window.setTimeout(type, 24));
      }
    };
    this.timers.push(window.setTimeout(() => {
      this.speak(lines);
      type();
    }, 1100)); // after the flicker-in
  }

  /** Flicker-out, then resolve so the owner can remove the object. */
  public dismiss(onGone: () => void) {
    this.stopSpeaking();
    this.el.classList.remove('admin-holo--in');
    this.el.classList.add('admin-holo--out');
    this.timers.push(window.setTimeout(onGone, 470));
  }

  public destroy() {
    this.stopSpeaking();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.btnEl.replaceWith(this.btnEl.cloneNode(true)); // drop listener
    this.el.remove();
  }
}
