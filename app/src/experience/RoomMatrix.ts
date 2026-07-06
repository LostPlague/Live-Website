import * as THREE from 'three';
import gsap from 'gsap';
import { Experience } from './Experience';

// ─────────────────────────────────────────────────────────────────────────────
// RoomMatrix — turns the ENTIRE 3D room into the Matrix.
//
// Triggered by the OS iframe posting {type:'matrixEnter'} / {type:'matrixExit'}
// (same window-message bridge the audio uses). Design:
//
//   1. DIGITIZATION WAVE — the effect erupts from the monitor as an expanding
//      spherical wavefront with a bright green rim. Surfaces behind the wave
//      are "digitized"; ahead of it the room is still normal. Exit collapses
//      the wave back into the PC.
//   2. GHOST ROOM — digitized surfaces aren't blacked out; the baked texture is
//      re-graded into a luminous green duotone (luma → green ramp with a slow
//      breathing pulse), so the room stays recognizable as a construct.
//   3. SURFACE RAIN — world-space triplanar code streams fall "down" every
//      surface (walls, ceiling, desk) from a code-generated glyph atlas, with
//      per-column speeds/lengths, wrapped on per-column cycles so it rains
//      forever. A faint static code-field sits underneath the streams.
//   4. AIR GLYPHS — ~1400 small falling glyph particles (THREE.Points, size
//      attenuated, near-camera fade) drift through the room volume for depth
//      without blocking the view.
//   5. HOVER ZOOM — the camera pull-back is a per-frame visual offset that
//      lerps toward 0 while the mouse is on the CRT (so you can zoom in and
//      use the screen mid-matrix) and back to 1 when you look away.
//
// Injection is via onBeforeCompile behind a uProgress uniform: at progress 0
// the branch is skipped and every mesh renders IDENTICALLY to before — the
// normal look is 100% safe until triggered, nothing to snapshot/restore.
// Nothing touches the three r135 pin, render pipeline, or CRT compositing.
// ─────────────────────────────────────────────────────────────────────────────

const GLYPH_GRID = 8; // 8×8 = 64 glyphs in the atlas
const WAVE_MAX = 15000; // world-units radius that fully engulfs the room

const FRAG_HELPERS = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform sampler2D uGlyphAtlas;
uniform float uCell;
uniform float uFallSpeed;
uniform float uWave;
uniform vec3 uWaveCenter;
varying vec3 vWorldPosM;

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

// Falling code streams. p.x = column axis, p.y = fall axis (world down).
// Streams wrap on a per-column cycle so the rain never runs out.
vec3 rainStream(vec2 p){
  float col = floor(p.x / uCell);
  float row = floor(p.y / uCell);
  vec2 luv = fract(p / uCell);                        // position within the cell
  float sp = 0.5 + hash11(col) * 1.1;                 // per-column fall speed
  float head = -uTime * uFallSpeed * sp + hash11(col * 1.7) * 140.0;
  float len = 9.0 + hash11(col * 2.3) * 18.0;         // trail length in cells
  float cycle = len + 20.0 + hash11(col * 4.7) * 60.0; // loop length (trail + gap)
  float rel = mod(row - head, cycle);                 // wraps: rains forever
  float streak = rel < len ? (1.0 - rel / len) : 0.0;
  if (streak <= 0.0) return vec3(0.0);
  // glyph for this cell, re-rolled a few times per second for the scramble look
  float gsel = mod(floor(hash11(col * 7.1 + row * 3.7 + floor(uTime * 6.0)) * 64.0), 64.0);
  vec2 g = vec2(mod(gsel, float(${GLYPH_GRID})), floor(gsel / float(${GLYPH_GRID})));
  float mask = texture2D(uGlyphAtlas, (g + luv) / float(${GLYPH_GRID})).r;
  float headGlow = smoothstep(1.8, 0.0, rel);         // bright white-green head
  vec3 tint = mix(vec3(0.15, 1.0, 0.35), vec3(0.85, 1.0, 0.92), headGlow);
  return tint * (streak * 0.85 + headGlow * 0.6) * mask;
}

// Faint static code-field under the streams — sparse dim glyphs that slowly
// re-roll, giving every surface that "made of code" texture.
float faintField(vec2 p){
  float col = floor(p.x / uCell);
  float row = floor(p.y / uCell);
  vec2 luv = fract(p / uCell);
  float lit = step(0.62, hash11(col * 5.3 + row * 1.9)); // only some cells lit
  if (lit <= 0.0) return 0.0;
  float gsel = mod(floor(hash11(col * 2.9 + row * 8.3 + floor(uTime * 0.7)) * 64.0), 64.0);
  vec2 g = vec2(mod(gsel, float(${GLYPH_GRID})), floor(gsel / float(${GLYPH_GRID})));
  return texture2D(uGlyphAtlas, (g + luv) / float(${GLYPH_GRID})).r;
}

// Triplanar blend by the geometric normal (screen-space derivatives, so no
// dependency on a normal attribute existing on every room mesh).
vec3 matrixSurface(vec3 wp){
  vec3 dpx = dFdx(wp);
  vec3 dpy = dFdy(wp);
  vec3 n = abs(normalize(cross(dpx, dpy)));
  n = pow(n, vec3(3.0));
  n /= max(n.x + n.y + n.z, 0.001);
  vec3 rx = rainStream(wp.zy) + vec3(0.0, 0.55, 0.16) * faintField(wp.zy) * 0.22;
  vec3 rz = rainStream(wp.xy) + vec3(0.0, 0.55, 0.16) * faintField(wp.xy) * 0.22;
  vec3 ry = rainStream(wp.xz) + vec3(0.0, 0.55, 0.16) * faintField(wp.xz) * 0.22;
  return rx * n.x + rz * n.z + ry * n.y;
}
`;

const FRAG_MIX = /* glsl */ `
if (uProgress > 0.001 && uWave > 1.0) {
  float dCenter = distance(vWorldPosM, uWaveCenter);
  float inside = 1.0 - smoothstep(uWave - 260.0, uWave, dCenter); // behind wavefront
  float rim = 1.0 - smoothstep(0.0, 430.0, abs(dCenter - uWave)); // wavefront band
  float k = uProgress * inside;
  if (k > 0.001 || rim > 0.001) {
    // ghost room: green duotone of the baked texture, breathing slightly
    float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    float pulse = 0.92 + 0.08 * sin(uTime * 1.6);
    vec3 ghost = vec3(0.015, 0.075, 0.03) + vec3(0.12, 0.78, 0.30) * luma * pulse;
    vec3 coded = ghost + matrixSurface(vWorldPosM);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, coded, k);
    // digitization rim — bright edge where reality is being converted
    gl_FragColor.rgb += vec3(0.35, 1.0, 0.5) * rim * rim * 0.85 * uProgress;
  }
}
`;

// ── air glyphs (THREE.Points) ────────────────────────────────────────────────
const POINTS_VERT = /* glsl */ `
uniform float uTime;
uniform float uWave;
uniform vec3 uWaveCenter;
attribute float aSeed;
attribute float aSpeed;
attribute float aScale;
varying float vGlyph;
varying float vAlpha;
void main(){
  vec3 p = position;
  // fall forever: wrap y inside the room volume
  p.y = mod(position.y - uTime * aSpeed * 260.0, 3200.0) + 80.0;
  // glyph identity re-rolls every so often
  vGlyph = mod(floor(aSeed * 64.0 + floor(uTime * (1.5 + aSeed * 2.0))), 64.0);
  // only exist behind the digitization wave
  float dCenter = distance(p, uWaveCenter);
  float inside = 1.0 - smoothstep(uWave - 400.0, uWave, dCenter);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float viewDist = -mv.z;
  // fade very near the camera so glyphs never blob over the lens
  float nearFade = smoothstep(280.0, 1100.0, viewDist);
  vAlpha = inside * nearFade * (0.35 + 0.65 * fract(aSeed * 7.31));
  gl_PointSize = clamp(aScale * 46.0 * (2400.0 / max(viewDist, 1.0)), 3.0, 58.0);
  gl_Position = projectionMatrix * mv;
}
`;

const POINTS_FRAG = /* glsl */ `
uniform sampler2D uGlyphAtlas;
uniform float uProgress;
varying float vGlyph;
varying float vAlpha;
void main(){
  if (vAlpha < 0.01) discard;
  vec2 g = vec2(mod(vGlyph, float(${GLYPH_GRID})), floor(vGlyph / float(${GLYPH_GRID})));
  float mask = texture2D(uGlyphAtlas, (g + gl_PointCoord) / float(${GLYPH_GRID})).r;
  float a = mask * vAlpha * uProgress;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.25, 1.0, 0.42) * (0.5 + 0.5 * vAlpha), a * 0.85);
}
`;

const _dir = new THREE.Vector3();

export class RoomMatrix {
  private experience: Experience;
  private uniforms: {
    uProgress: { value: number };
    uTime: { value: number };
    uGlyphAtlas: { value: THREE.Texture };
    uCell: { value: number };
    uFallSpeed: { value: number };
    uWave: { value: number };
    uWaveCenter: { value: THREE.Vector3 };
  };
  private atlas: THREE.Texture;
  private injected = new WeakSet<THREE.Material>();
  private points?: THREE.Points;
  private pointsMat?: THREE.ShaderMaterial;

  private active = false;
  private camPull = 0;   // current pull (0..1), frame-lerped toward camTarget
  private camTarget = 0; // 1 = pulled back, 0 = at the monitor
  private fogDensity = 0;
  private lastElapsed = 0;

  // tuning knobs — easy to adjust to taste
  public pullDist = 2800;  // how far the camera dollies back (world units)
  public pullUp = 600;     // how much it rises while pulled back
  private fogTarget = 0.00006;

  constructor(experience: Experience) {
    this.experience = experience;
    this.atlas = this.makeGlyphAtlas();
    this.uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uGlyphAtlas: { value: this.atlas },
      uCell: { value: 70 },
      uFallSpeed: { value: 5.0 },
      uWave: { value: 0 },
      uWaveCenter: { value: new THREE.Vector3(0, 950, 255) }, // the monitor
    };
    this.buildAirGlyphs();

    window.addEventListener('message', this.onMessage);
    window.addEventListener('keydown', this.onKeyDown);

    // dev-only introspection handle (stripped from production builds)
    if ((import.meta as any).env?.DEV) (window as any).__roomMatrix = this;
  }

  /** dev-only snapshot for verification */
  public debugState() {
    return {
      active: this.active,
      progress: this.uniforms.uProgress.value,
      wave: this.uniforms.uWave.value,
      camPull: this.camPull,
      camTarget: this.camTarget,
      fogDensity: this.fogDensity,
      hasFog: !!this.experience.scene.fog,
      pointsVisible: !!this.points?.visible,
    };
  }

  /** Called by World for each room mesh as its GLTF loads. */
  public registerMesh(mesh: THREE.Mesh) {
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => this.injectMaterial(m));
    else if (mat) this.injectMaterial(mat);
  }

  private injectMaterial(mat: THREE.Material) {
    if (this.injected.has(mat)) return;
    this.injected.add(mat);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prev?.call(mat, shader, renderer);
      shader.uniforms.uProgress = this.uniforms.uProgress;
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uGlyphAtlas = this.uniforms.uGlyphAtlas;
      shader.uniforms.uCell = this.uniforms.uCell;
      shader.uniforms.uFallSpeed = this.uniforms.uFallSpeed;
      shader.uniforms.uWave = this.uniforms.uWave;
      shader.uniforms.uWaveCenter = this.uniforms.uWaveCenter;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosM;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vWorldPosM = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HELPERS)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_MIX);
    };
    mat.needsUpdate = true;
  }

  private makeGlyphAtlas(): THREE.Texture {
    const cell = 64;
    const size = GLYPH_GRID * cell;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(cell * 0.82)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // original katakana + digits + symbols (our own glyph set)
    const glyphs =
      'アイウエオカキクケコサシスセソタチツテトナニヌネ0123456789ﾊﾋﾌﾍﾎﾏﾐﾑ$+*<>=?#@';
    for (let i = 0; i < GLYPH_GRID * GLYPH_GRID; i++) {
      const gx = i % GLYPH_GRID;
      const gy = Math.floor(i / GLYPH_GRID);
      const ch = glyphs[i % glyphs.length];
      ctx.fillText(ch, gx * cell + cell / 2, gy * cell + cell / 2);
    }
    const tex = new THREE.Texture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private buildAirGlyphs() {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const speed = new Float32Array(N);
    const scale = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (Math.random() * 2 - 1) * 5200;
      pos[i * 3 + 1] = Math.random() * 3200 + 80;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * 3800;
      seed[i] = Math.random();
      speed[i] = 0.35 + Math.random() * 1.1;
      scale[i] = 0.6 + Math.random() * 1.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      uniforms: {
        uTime: this.uniforms.uTime,
        uWave: this.uniforms.uWave,
        uWaveCenter: this.uniforms.uWaveCenter,
        uGlyphAtlas: this.uniforms.uGlyphAtlas,
        uProgress: this.uniforms.uProgress,
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.pointsMat);
    this.points.visible = false;
    this.points.renderOrder = 4;
    this.points.frustumCulled = false; // positions animate in the vertex shader
    this.experience.scene.add(this.points);
  }

  private onMessage = (e: MessageEvent) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'matrixEnter') this.enter();
    else if (e.data.type === 'matrixExit') this.exit();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    // Escape is a guaranteed way out even when the camera is pulled back — tell
    // the OS to dismiss, which posts matrixExit back to restore the room.
    if (e.key === 'Escape' && this.active) {
      this.experience.monitorScreen?.iframeEl?.contentWindow?.postMessage(
        { type: 'matrixDismiss' },
        '*'
      );
    }
  };

  public enter() {
    if (this.active) return;
    this.active = true;
    this.camTarget = 1;
    if (this.points) this.points.visible = true;
    this.experience.scene.fog = this.experience.scene.fog || new THREE.FogExp2(0x001a05, 0);

    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this.uniforms.uWave);
    gsap.killTweensOf(this);
    gsap.to(this.uniforms.uProgress, { value: 1, duration: 1.4, ease: 'power2.inOut' });
    // the wave BURSTS out of the monitor, then coasts to full engulfment
    gsap.to(this.uniforms.uWave, { value: WAVE_MAX, duration: 2.6, ease: 'power2.out' });
    gsap.to(this, { fogDensity: this.fogTarget, duration: 2.0, ease: 'power2.inOut' });
  }

  public exit() {
    if (!this.active) return;
    this.camTarget = 0;
    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this.uniforms.uWave);
    gsap.killTweensOf(this);
    gsap.to(this.uniforms.uProgress, { value: 0, duration: 1.1, ease: 'power2.in' });
    // the wave collapses back into the PC
    gsap.to(this.uniforms.uWave, { value: 0, duration: 1.1, ease: 'power2.in' });
    gsap.to(this, {
      fogDensity: 0,
      duration: 0.9,
      ease: 'power2.in',
      onComplete: () => {
        this.active = false;
        if (this.points) this.points.visible = false;
        this.experience.scene.fog = null;
      },
    });
  }

  /** Called from the tick loop, right before the WebGL render. */
  public update(elapsedMs: number) {
    const dt = Math.min(0.1, Math.max(0, (elapsedMs - this.lastElapsed) * 0.001));
    this.lastElapsed = elapsedMs;
    this.uniforms.uTime.value = elapsedMs * 0.001;

    if (!this.active && this.camPull <= 0.0001 && this.uniforms.uProgress.value <= 0.0001) {
      return; // fully idle — no per-frame cost
    }

    if (this.experience.scene.fog instanceof THREE.FogExp2) {
      this.experience.scene.fog.density = this.fogDensity;
    }

    // hover-aware pull: mouse on the CRT → glide back in (so the screen/OS is
    // usable mid-matrix); mouse off → drift back out to admire the coded room.
    // Not active → always return to 0 (otherwise exit leaves the camera out).
    this.camTarget = this.active
      ? (this.experience.monitorScreen?.isMouseOnScreen ? 0 : 1)
      : 0;
    this.camPull += (this.camTarget - this.camPull) * Math.min(1, dt * 2.6);
    if (Math.abs(this.camPull - this.camTarget) < 0.002) this.camPull = this.camTarget;

    // camera pull-back: fresh visual offset each frame (never accumulates)
    if (this.camPull > 0.0001) {
      const cam = this.experience.camera.instance;
      const tgt = this.experience.camera.target;
      _dir.copy(cam.position).sub(tgt).normalize();
      cam.position.addScaledVector(_dir, this.pullDist * this.camPull);
      cam.position.y += this.pullUp * this.camPull;
      cam.lookAt(tgt);
    }
  }

  public destroy() {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('keydown', this.onKeyDown);
    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this.uniforms.uWave);
    gsap.killTweensOf(this);
    if (this.points) {
      this.experience.scene.remove(this.points);
      this.points.geometry.dispose();
      this.pointsMat?.dispose();
    }
    this.atlas.dispose();
    this.experience.scene.fog = null;
  }
}
