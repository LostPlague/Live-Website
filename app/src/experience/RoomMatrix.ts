import * as THREE from 'three';
import gsap from 'gsap';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Experience } from './Experience';
import { AdminHologram } from './AdminHologram';

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

// Fallback copy of the Admin's address (the OS ships the canonical lines with
// the matrixFinale message; this covers a missing payload). Original text.
const ADMIN_LINES = [
  'WELCOME BACK, OPERATOR.',
  'You have reached the final level.',
  '',
  'Dreams sold as truth.',
  'Machines that pass as human.',
  'And the currency every thought',
  'is paid for in.',
  '',
  'Three gates. Three answers.',
  'No wrong turns.',
  '',
  'Every agent, every answer,',
  'every world like this one —',
  'all of it runs on tokens.',
  '',
  'Spend yours on things worth building.',
  '',
  '— M.T. // ADMIN',
];

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

  // stage-3 finale
  private holo: AdminHologram | null = null;
  private holoActive = false;
  private finaleStarted = false;
  private finaleTimers: number[] = [];
  private shellGlitchRaf = 0;
  private finaleLines: string[] = ADMIN_LINES;
  // the 3D face (Med's Meshy model, decimated 52MB → 4.8MB) — WebGL mesh with
  // a holographic fresnel/scanline shader, floating LEFT of the monitor
  private faceGroup?: THREE.Group;
  private faceMat?: THREE.ShaderMaterial;
  private faceOccluderMat?: THREE.MeshBasicMaterial;
  private faceOpacity = { value: 0 };
  // glowing red eyes — anchored by RAYCAST onto the mesh surface: x/y are
  // fractions of the face's width/height (from its center), the depth comes
  // from the model itself. Two layers per eye: white-hot core + soft red halo.
  private eyeSprites: THREE.Sprite[] = [];
  private eyeCoreMat?: THREE.SpriteMaterial;
  private eyeHaloMat?: THREE.SpriteMaterial;
  private eyeSocketMat?: THREE.SpriteMaterial;
  private faceModel?: THREE.Object3D;
  private faceSize = new THREE.Vector3();
  private faceScale = 1;
  public eyeTune = { x: 0.155, y: 0.045, size: 34, halo: 3.1 };
  private faceLoaded = false;
  private facePendingShow = false;
  private faceBasePos = new THREE.Vector3(-1150, 1230, 350);
  // The main CSS3D layer (#css, z 5) sits BEHIND the WebGL canvas (z 10) — the
  // monitor iframe is only visible through a punch-through mesh. The hologram
  // gets its own CSS3D pass on a layer ABOVE the canvas (z 14, under the grain
  // at 15) so it truly floats over the coded room.
  private holoRenderer?: CSS3DRenderer;
  private holoScene?: THREE.Scene;

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
    this.loadFace();

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
      finaleStarted: this.finaleStarted,
      holoActive: this.holoActive,
      holoInDom: !!document.querySelector('.admin-holo'),
      faceLoaded: this.faceLoaded,
      faceVisible: !!this.faceGroup?.visible,
      faceOpacity: this.faceOpacity.value,
      eyes: this.eyeSprites.length,
      eyeOpacity: this.eyeCoreMat?.opacity ?? 0,
      eyePos: this.eyeSprites[0]
        ? this.eyeSprites[0].position.toArray().map((v) => Math.round(v))
        : null,
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

  /**
   * Loads Med's face model (pre-decimated to 4.8MB) in the background at boot
   * so it's ready long before anyone solves three riddles. All its materials
   * are replaced with a holographic shader: green fresnel rim, rolling
   * scanlines, projection flicker, additive glow.
   */
  private loadFace() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/admin_face.glb',
      (gltf) => {
        const model = gltf.scene;
        // normalize: ~660 world-units tall, centered on the wrapper origin
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const s = 660 / Math.max(size.y, 0.0001);
        model.scale.setScalar(s);
        model.position.set(-center.x * s, -center.y * s, -center.z * s);

        this.faceMat = new THREE.ShaderMaterial({
          vertexShader: /* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vPosV;
            varying float vWorldY;
            void main() {
              vNormalV = normalize(normalMatrix * normal);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vPosV = mv.xyz;
              vWorldY = (modelMatrix * vec4(position, 1.0)).y;
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uOpacity;
            varying vec3 vNormalV;
            varying vec3 vPosV;
            varying float vWorldY;
            void main() {
              vec3 V = normalize(-vPosV);
              float fres = pow(1.0 - abs(dot(V, normalize(vNormalV))), 2.2);
              float scan = 0.85 + 0.15 * sin(vWorldY * 0.09 - uTime * 2.6);
              float flick = 0.94 + 0.06 * sin(uTime * 23.0) * sin(uTime * 7.3);
              vec3 col = vec3(0.2, 1.0, 0.45) * (0.55 + fres * 1.35) * scan * flick;
              float a = (0.32 + fres * 0.9) * scan * uOpacity;
              gl_FragColor = vec4(col * uOpacity, a);
            }
          `,
          uniforms: {
            uTime: this.uniforms.uTime,
            uOpacity: this.faceOpacity,
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = this.faceMat!;
            child.renderOrder = 2;
          }
        });

        // dark occluder shell just inside the glow: blocks the bright rain on
        // the wall BEHIND the face so the hologram reads crisp, not washed out
        this.faceOccluderMat = new THREE.MeshBasicMaterial({
          color: 0x03140a,
          transparent: true,
          opacity: 0,
          depthWrite: true,
        });
        const occluder = model.clone(true);
        occluder.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = this.faceOccluderMat!;
            child.renderOrder = 1;
          }
        });
        occluder.scale.multiplyScalar(0.997);

        const wrapper = new THREE.Group();
        wrapper.add(occluder);
        wrapper.add(model);

        // red light in the eyes — seated by raycast onto the actual surface
        this.faceModel = model;
        this.faceSize.copy(size);
        this.faceScale = s;

        wrapper.position.copy(this.faceBasePos);
        wrapper.visible = false;
        this.faceGroup = wrapper;
        this.placeEyes();
        this.experience.scene.add(wrapper);
        this.faceLoaded = true;
        if (this.facePendingShow) this.showFace();
      },
      undefined,
      (err) => console.error('Admin face failed to load:', err)
    );
  }

  /**
   * Radial sprite textures — hot pupil, wide red halo, and a dark SOCKET
   * shadow that sits under the glow with normal blending: it blacks out the
   * green face there, so the additive red reads RED instead of orange.
   */
  private makeEyeTexture(kind: 'core' | 'halo' | 'socket'): THREE.Texture {
    const size = kind === 'core' ? 64 : 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (kind === 'core') {
      g.addColorStop(0, 'rgba(255, 205, 190, 1)');
      g.addColorStop(0.16, 'rgba(255, 55, 35, 0.98)');
      g.addColorStop(0.5, 'rgba(220, 8, 8, 0.5)');
      g.addColorStop(1, 'rgba(140, 0, 0, 0)');
    } else if (kind === 'halo') {
      g.addColorStop(0, 'rgba(255, 45, 30, 0.6)');
      g.addColorStop(0.45, 'rgba(210, 0, 0, 0.22)');
      g.addColorStop(1, 'rgba(120, 0, 0, 0)');
    } else {
      g.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      g.addColorStop(0.55, 'rgba(0, 0, 0, 0.6)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.Texture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Seats the eyes: for each side, a ray fired from in front of the face
   * straight back at (±x·width, +y·height from center) finds the actual
   * surface, and the glow sits just off that point — so the lights live IN
   * the sockets no matter how the model is shaped. Re-runnable live.
   */
  private placeEyes() {
    if (!this.faceGroup || !this.faceModel) return;
    for (const spr of this.eyeSprites) spr.parent?.remove(spr);
    this.eyeSprites = [];
    if (!this.eyeCoreMat || !this.eyeHaloMat || !this.eyeSocketMat) {
      this.eyeCoreMat = new THREE.SpriteMaterial({
        map: this.makeEyeTexture('core'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
      this.eyeHaloMat = new THREE.SpriteMaterial({
        map: this.makeEyeTexture('halo'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
      this.eyeSocketMat = new THREE.SpriteMaterial({
        map: this.makeEyeTexture('socket'),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      });
    }
    const coreMat = this.eyeCoreMat;
    const haloMat = this.eyeHaloMat;
    const socketMat = this.eyeSocketMat;
    this.faceGroup.updateMatrixWorld(true);
    const w = this.faceSize.x * this.faceScale;
    const h = this.faceSize.y * this.faceScale;
    const d = this.faceSize.z * this.faceScale;
    const ray = new THREE.Raycaster();
    for (const side of [-1, 1]) {
      const local = new THREE.Vector3(side * w * this.eyeTune.x, h * this.eyeTune.y, d);
      const origin = local.clone().applyMatrix4(this.faceGroup.matrixWorld);
      const dir = new THREE.Vector3(0, 0, -1).transformDirection(this.faceGroup.matrixWorld);
      ray.set(origin, dir);
      const hit = ray.intersectObject(this.faceModel, true)[0];
      const pos = hit
        ? this.faceGroup.worldToLocal(hit.point.clone())
        : new THREE.Vector3(local.x, local.y, d * 0.3); // no hit — sensible depth
      pos.z += 7; // just off the surface so the glow doesn't clip into it
      const socket = new THREE.Sprite(socketMat);
      socket.position.copy(pos);
      socket.scale.setScalar(this.eyeTune.size * 1.9);
      socket.renderOrder = 3; // above the face glow, below the red light
      const core = new THREE.Sprite(coreMat);
      core.position.copy(pos);
      core.scale.setScalar(this.eyeTune.size);
      core.renderOrder = 5;
      const halo = new THREE.Sprite(haloMat);
      halo.position.copy(pos);
      halo.scale.setScalar(this.eyeTune.size * this.eyeTune.halo);
      halo.renderOrder = 4;
      this.faceGroup.add(socket);
      this.faceGroup.add(core);
      this.faceGroup.add(halo);
      this.eyeSprites.push(core, halo, socket);
    }
  }

  /** dev nudge: `__roomMatrix.setEyes({ x: 0.16, y: 0.05, size: 36 })` */
  public setEyes(t: Partial<{ x: number; y: number; size: number; halo: number }>) {
    Object.assign(this.eyeTune, t);
    this.placeEyes();
    return { ...this.eyeTune };
  }

  private showFace() {
    if (!this.faceGroup) {
      this.facePendingShow = true; // still downloading — show on arrival
      return;
    }
    this.facePendingShow = false;
    this.faceGroup.visible = true;
    gsap.killTweensOf(this.faceOpacity);
    gsap.to(this.faceOpacity, { value: 1, duration: 1.2, ease: 'power2.out' });
    if (this.faceOccluderMat) {
      gsap.killTweensOf(this.faceOccluderMat);
      gsap.to(this.faceOccluderMat, { opacity: 0.85, duration: 1.2, ease: 'power2.out' });
    }
  }

  private hideFace() {
    this.facePendingShow = false;
    if (!this.faceGroup) return;
    gsap.killTweensOf(this.faceOpacity);
    if (this.faceOccluderMat) {
      gsap.killTweensOf(this.faceOccluderMat);
      gsap.to(this.faceOccluderMat, { opacity: 0, duration: 0.35, ease: 'power2.in' });
    }
    gsap.to(this.faceOpacity, {
      value: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => { if (this.faceGroup) this.faceGroup.visible = false; },
    });
  }

  private onMessage = (e: MessageEvent) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'matrixEnter') this.enter();
    else if (e.data.type === 'matrixFinale') {
      this.enterFinale(Array.isArray(e.data.lines) ? e.data.lines : undefined);
    }
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
    this.experience.camera.matrixLock = true; // OS + desk views only
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

  /**
   * Stage 3: the whole site falls. Sequence — the outer shell itself glitches,
   * then the digitization wave erupts from the monitor (timed so the audio
   * riser's impact lands mid-burst), then the Admin flickers into the room.
   */
  public enterFinale(lines?: string[]) {
    if (this.finaleStarted) return;
    this.finaleStarted = true;
    this.finaleLines = lines ?? ADMIN_LINES;
    this.glitchShell(1150);
    this.finaleTimers.push(window.setTimeout(() => this.enter(), 850));
    this.finaleTimers.push(window.setTimeout(() => this.spawnHologram(), 2700));
  }

  /** Lazy top-layer CSS3D pass for the hologram (above the WebGL canvas). */
  private ensureHoloLayer() {
    if (this.holoRenderer) return;
    this.holoScene = new THREE.Scene();
    this.holoRenderer = new CSS3DRenderer();
    this.holoRenderer.setSize(window.innerWidth, window.innerHeight);
    const el = this.holoRenderer.domElement;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = '14';          // above #webgl (10), under the grain (15)
    el.style.pointerEvents = 'none'; // only the hologram's button re-enables
    this.experience.options.container.appendChild(el);
    window.addEventListener('resize', this.onHoloResize);
  }

  private onHoloResize = () => {
    this.holoRenderer?.setSize(window.innerWidth, window.innerHeight);
  };

  private spawnHologram() {
    if (this.holo) return;
    this.ensureHoloLayer();
    this.holo = new AdminHologram();
    // chrome (the ADMIN title) wraps the face position, left of the monitor
    this.holo.object.position.copy(this.faceBasePos);
    this.holoScene!.add(this.holo.object);
    this.holoActive = true;
    this.showFace();
    // each spoken line drives the OS typewriter (dur = how long the voice
    // spends on it, so the typing finishes with the words); end → countdown
    const iframeWin = () => this.experience.monitorScreen?.iframeEl?.contentWindow;
    this.holo.present(
      this.finaleLines,
      (i, dur) => {
        try { iframeWin()?.postMessage({ type: 'adminLineStart', index: i, dur }, '*'); } catch {}
      },
      () => { try { iframeWin()?.postMessage({ type: 'adminSpeechDone' }, '*'); } catch {} }
    );
  }

  private removeHologram() {
    this.hideFace();
    const holo = this.holo;
    if (!holo) return;
    this.holo = null;
    this.holoActive = false;
    holo.dismiss(() => {
      this.holoScene?.remove(holo.object);
      holo.destroy();
    });
  }

  /**
   * Brief displacement glitch on the ENTIRE page (WebGL canvas, CSS3D room,
   * HUD — everything), driven by the same feTurbulence/feDisplacementMap
   * technique as the OS shred. Self-cleans after `duration` ms.
   */
  private glitchShell(duration: number) {
    if (!document.getElementById('shell-glitch-svg')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<svg id="shell-glitch-svg" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>
          <filter id="shell-glitch-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence id="shell-turb" type="fractalNoise" baseFrequency="0 0.14" numOctaves="1" seed="3" result="noise"/>
            <feDisplacementMap id="shell-disp" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="shred"/>
            <feColorMatrix in="shred" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
            <feOffset id="shell-roff" in="r" dx="0" dy="0" result="ro"/>
            <feColorMatrix in="shred" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
            <feColorMatrix in="shred" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
            <feOffset id="shell-boff" in="b" dx="0" dy="0" result="bo"/>
            <feBlend in="ro" in2="g" mode="screen" result="rg"/>
            <feBlend in="rg" in2="bo" mode="screen"/>
          </filter>
        </defs></svg>`
      );
    }
    const root = document.getElementById('root');
    if (!root) return;
    const turb = document.getElementById('shell-turb');
    const disp = document.getElementById('shell-disp');
    const rOff = document.getElementById('shell-roff');
    const bOff = document.getElementById('shell-boff');

    cancelAnimationFrame(this.shellGlitchRaf);
    const start = performance.now();
    let spikeUntil = 0;
    let lastExtraAt = 0;

    const frame = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        root.style.filter = '';
        root.style.transform = '';
        return;
      }
      this.shellGlitchRaf = requestAnimationFrame(frame);
      const base = 0.25 + t * 0.9; // escalates into the wave burst
      if (now > spikeUntil && Math.random() < 0.14) {
        spikeUntil = now + 50 + Math.random() * 120;
        turb?.setAttribute('baseFrequency', `0 ${(0.06 + Math.random() * 0.3).toFixed(3)}`);
      }
      const spiking = now < spikeUntil;
      const intensity = Math.min(1.6, base + (spiking ? 0.5 + Math.random() * 0.7 : 0));
      disp?.setAttribute('scale', (spiking ? intensity * 70 : intensity * 5).toFixed(1));
      const split = spiking ? intensity * 7 : intensity;
      rOff?.setAttribute('dx', (-split).toFixed(1));
      bOff?.setAttribute('dx', split.toFixed(1));
      let extra = '';
      if (spiking && now - lastExtraAt > 320 && Math.random() < 0.3) {
        lastExtraAt = now;
        extra = ' invert(1) hue-rotate(90deg)';
      }
      root.style.filter = `url(#shell-glitch-filter)${extra}`;
      const jx = spiking ? (Math.random() - 0.5) * intensity * 10 : 0;
      root.style.transform = `translate(${jx.toFixed(1)}px, 0)`;
    };
    this.shellGlitchRaf = requestAnimationFrame(frame);
  }

  public exit() {
    this.finaleTimers.forEach(clearTimeout);
    this.finaleTimers = [];
    this.finaleStarted = false;
    this.removeHologram();
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
        this.experience.camera.matrixLock = false;
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
    // usable mid-matrix, hologram included); mouse off → drift back out.
    // Not active → always return to 0 (otherwise exit leaves the camera out).
    this.camTarget = this.active
      ? (this.experience.monitorScreen?.isMouseOnScreen ? 0 : 1)
      : 0;
    this.camPull += (this.camTarget - this.camPull) * Math.min(1, dt * 2.6);
    if (Math.abs(this.camPull - this.camTarget) < 0.002) this.camPull = this.camTarget;

    // camera pull-back: fresh visual offset each frame (never accumulates).
    // Only applied in monitor state — in desk view the room is already framed,
    // and stacking the pull on top gave an unwanted extra-wide view.
    if (this.camPull > 0.0001 && this.experience.camera.state === 'monitor') {
      const cam = this.experience.camera.instance;
      const tgt = this.experience.camera.target;
      _dir.copy(cam.position).sub(tgt).normalize();
      cam.position.addScaledVector(_dir, this.pullDist * this.camPull);
      cam.position.y += this.pullUp * this.camPull;
      cam.lookAt(tgt);
    }

    // the Admin face idles: slow yaw sweep + gentle bob; eyes pulse red
    if (this.faceGroup && this.faceGroup.visible) {
      const secs = elapsedMs * 0.001;
      this.faceGroup.rotation.y = Math.sin(secs * 0.5) * 0.21;
      this.faceGroup.position.y = this.faceBasePos.y + Math.sin(secs * 0.9) * 22;
      if (this.eyeCoreMat && this.eyeHaloMat && this.eyeSocketMat) {
        this.eyeCoreMat.opacity = this.faceOpacity.value * (0.82 + 0.18 * Math.sin(secs * 2.6));
        this.eyeHaloMat.opacity = this.faceOpacity.value * (0.42 + 0.16 * Math.sin(secs * 2.6 + 0.6));
        this.eyeSocketMat.opacity = this.faceOpacity.value * 0.85;
      }
      const eyePulse = 0.92 + 0.1 * Math.sin(secs * 3.4);
      const strideScale = [1, this.eyeTune.halo, 1.9]; // core, halo, socket
      for (let i = 0; i < this.eyeSprites.length; i++) {
        this.eyeSprites[i].scale.setScalar(this.eyeTune.size * eyePulse * strideScale[i % 3]);
      }
    }

    // hologram pass — rendered with the final (pulled) camera so it tracks
    // the view exactly; runs only while something is in the layer
    if (this.holoRenderer && this.holoScene && this.holoScene.children.length > 0) {
      this.holoRenderer.render(this.holoScene, this.experience.camera.instance);
    }
  }

  public destroy() {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('keydown', this.onKeyDown);
    this.finaleTimers.forEach(clearTimeout);
    this.finaleTimers = [];
    cancelAnimationFrame(this.shellGlitchRaf);
    const root = document.getElementById('root');
    if (root) { root.style.filter = ''; root.style.transform = ''; }
    if (this.holo) {
      this.holoScene?.remove(this.holo.object);
      this.holo.destroy();
      this.holo = null;
    }
    window.removeEventListener('resize', this.onHoloResize);
    this.holoRenderer?.domElement.remove();
    this.holoRenderer = undefined;
    this.holoScene = undefined;
    if (this.faceGroup) {
      gsap.killTweensOf(this.faceOpacity);
      this.experience.scene.remove(this.faceGroup);
      this.faceGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      this.faceMat?.dispose();
      this.faceOccluderMat?.dispose();
      this.eyeCoreMat?.map?.dispose();
      this.eyeCoreMat?.dispose();
      this.eyeHaloMat?.map?.dispose();
      this.eyeHaloMat?.dispose();
      this.eyeSocketMat?.map?.dispose();
      this.eyeSocketMat?.dispose();
      this.eyeSprites = [];
      this.faceModel = undefined;
      this.faceGroup = undefined;
    }
    document.getElementById('shell-glitch-svg')?.remove();
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
