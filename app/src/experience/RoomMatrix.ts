import * as THREE from 'three';
import gsap from 'gsap';
import { Experience } from './Experience';

// ─────────────────────────────────────────────────────────────────────────────
// RoomMatrix — turns the ENTIRE 3D room into the Matrix.
//
// Triggered by the OS iframe posting {type:'matrixEnter'} / {type:'matrixExit'}
// (same window-message bridge the audio uses). Three layers, all reversible:
//   1. Surface reskin: every baked room material gets a shader overlay injected
//      via onBeforeCompile behind a uProgress uniform. At progress 0 the mesh
//      renders IDENTICALLY to before (the matrix branch is skipped), so the
//      current look is 100% safe until triggered — no snapshot/restore needed.
//      World-space downward rain via triplanar so code falls "down" on every
//      surface (walls, ceiling, desk), from a code-generated katakana atlas.
//   2. Volumetric air-rain: a few billboarded additive planes so code falls
//      through the space around the desk. Green exponential fog for depth.
//   3. Camera pull-back: a per-frame visual offset (re-applied fresh each frame,
//      never accumulates) so you watch the room flood. Reverts fully at 0.
//
// Nothing here touches the three r135 pin, the render pipeline, or the CRT
// compositing. Everything defaults to off.
// ─────────────────────────────────────────────────────────────────────────────

const GLYPH_GRID = 8; // 8×8 = 64 glyphs in the atlas

const FRAG_HELPERS = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform sampler2D uGlyphAtlas;
uniform float uCell;
uniform float uFallSpeed;
varying vec3 vWorldPosM;

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

// One 2D surface projection: p.x = column axis, p.y = fall axis (world down).
vec3 rainStream(vec2 p){
  float col = floor(p.x / uCell);
  float row = floor(p.y / uCell);
  vec2 luv = fract(p / uCell);                       // position within the cell
  float sp = 0.5 + hash11(col) * 1.1;                // per-column fall speed
  float head = -uTime * uFallSpeed * sp + hash11(col * 1.7) * 140.0; // head row (decreasing = down)
  float len = 9.0 + hash11(col * 2.3) * 18.0;        // trail length in cells
  float rel = row - head;                            // >=0 is the trail above the head
  float streak = (rel >= 0.0 && rel < len) ? (1.0 - rel / len) : 0.0;
  if (streak <= 0.0) return vec3(0.0);
  // glyph for this cell, re-rolled a few times per second for the scramble look
  float gsel = mod(floor(hash11(col * 7.1 + row * 3.7 + floor(uTime * 6.0)) * 64.0), 64.0);
  vec2 g = vec2(mod(gsel, float(${GLYPH_GRID})), floor(gsel / float(${GLYPH_GRID})));
  float mask = texture2D(uGlyphAtlas, (g + luv) / float(${GLYPH_GRID})).r;
  float headGlow = smoothstep(1.6, 0.0, rel);        // bright white-green at the head
  vec3 tint = mix(vec3(0.15, 1.0, 0.35), vec3(0.8, 1.0, 0.9), headGlow);
  return tint * streak * mask;
}

// Triplanar blend by the geometric normal (from screen-space derivatives, so we
// don't depend on a normal attribute being present on every room mesh).
vec3 matrixSurface(vec3 wp){
  vec3 dpx = dFdx(wp);
  vec3 dpy = dFdy(wp);
  vec3 n = abs(normalize(cross(dpx, dpy)));
  n = pow(n, vec3(3.0));
  n /= max(n.x + n.y + n.z, 0.001);
  vec3 rx = rainStream(wp.zy);  // X-facing walls: across = Z, down = Y
  vec3 rz = rainStream(wp.xy);  // Z-facing walls: across = X, down = Y
  vec3 ry = rainStream(wp.xz);  // floor / ceiling: across = X, "down" = Z
  return rx * n.x + rz * n.z + ry * n.y;
}
`;

const FRAG_MIX = /* glsl */ `
if (uProgress > 0.001) {
  vec3 mtx = matrixSurface(vWorldPosM);
  vec3 darkened = gl_FragColor.rgb * mix(1.0, 0.05, uProgress); // room powers down
  gl_FragColor.rgb = darkened + mtx * uProgress;                // code streams over it
}
`;

const RAIN_PLANE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
void main(){
  float cols = 46.0;
  float c = floor(vUv.x * cols);
  float sp = 0.25 + h(c) * 0.8;
  float y = fract(vUv.y - uTime * sp * 0.12 + h(c * 3.3));
  float b = pow(1.0 - y, 6.0);                       // bright streak head, long fade
  float a = b * uOpacity * (0.35 + 0.65 * h(c * 5.1));
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(0.2, 1.0, 0.35) * b, a);
}
`;

const RAIN_PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
  };
  private atlas: THREE.Texture;
  private injected = new WeakSet<THREE.Material>();
  private rainPlanes: THREE.Mesh[] = [];
  private planeUniforms: { uTime: { value: number }; uOpacity: { value: number } };

  private active = false;
  private camPull = 0;        // 0..1, gsap-driven
  private fogDensity = 0;     // 0..target, gsap-driven

  // tuning knobs (world units) — easy to adjust to taste
  public pullDist = 4200;
  public pullUp = 900;
  private fogTarget = 0.000085;

  constructor(experience: Experience) {
    this.experience = experience;
    this.atlas = this.makeGlyphAtlas();
    this.uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uGlyphAtlas: { value: this.atlas },
      uCell: { value: 70 },
      uFallSpeed: { value: 5.0 },
    };
    this.planeUniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
    this.buildRainPlanes();

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
      camPull: this.camPull,
      fogDensity: this.fogDensity,
      hasFog: !!this.experience.scene.fog,
      rainPlanesVisible: this.rainPlanes.filter((p) => p.visible).length,
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
    // original katakana + digits + symbols (our own glyph set, nothing copied)
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

  private buildRainPlanes() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_PLANE_VERT,
      fragmentShader: RAIN_PLANE_FRAG,
      uniforms: this.planeUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // a few large sheets at different depths around the desk volume
    const specs = [
      { w: 9000, h: 6000, pos: new THREE.Vector3(0, 1200, -1500) },
      { w: 7000, h: 5000, pos: new THREE.Vector3(-2600, 1000, 900) },
      { w: 7000, h: 5000, pos: new THREE.Vector3(2600, 1000, 900) },
      { w: 8000, h: 5000, pos: new THREE.Vector3(0, 1500, 2600) },
    ];
    for (const s of specs) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
      mesh.position.copy(s.pos);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.experience.scene.add(mesh);
      this.rainPlanes.push(mesh);
    }
  }

  private onMessage = (e: MessageEvent) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'matrixEnter') this.enter();
    else if (e.data.type === 'matrixExit') this.exit();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    // Escape is a guaranteed way out even when the camera is pulled back and the
    // on-screen button is small — tell the OS to dismiss, which posts matrixExit.
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
    this.rainPlanes.forEach((p) => (p.visible = true));
    this.experience.scene.fog = this.experience.scene.fog || new THREE.FogExp2(0x001a05, 0);

    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this);
    gsap.to(this.uniforms.uProgress, { value: 1, duration: 1.8, ease: 'power2.inOut' });
    gsap.to(this, { camPull: 1, duration: 2.4, ease: 'power3.inOut' });
    gsap.to(this, { fogDensity: this.fogTarget, duration: 2.0, ease: 'power2.inOut' });
  }

  public exit() {
    if (!this.active) return;
    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this);
    gsap.to(this.uniforms.uProgress, { value: 0, duration: 1.0, ease: 'power2.in' });
    gsap.to(this, { camPull: 0, duration: 1.1, ease: 'power2.inOut' });
    gsap.to(this, {
      fogDensity: 0,
      duration: 0.9,
      ease: 'power2.in',
      onComplete: () => {
        this.active = false;
        this.rainPlanes.forEach((p) => (p.visible = false));
        this.experience.scene.fog = null;
      },
    });
  }

  /** Called from the tick loop, right before the WebGL render. */
  public update(elapsedMs: number) {
    const t = elapsedMs * 0.001;
    this.uniforms.uTime.value = t;

    if (!this.active && this.camPull <= 0.0001 && this.uniforms.uProgress.value <= 0.0001) {
      return; // fully idle — no per-frame cost
    }

    this.planeUniforms.uTime.value = t;
    this.planeUniforms.uOpacity.value = this.uniforms.uProgress.value * 0.9;

    if (this.experience.scene.fog instanceof THREE.FogExp2) {
      this.experience.scene.fog.density = this.fogDensity;
    }

    // camera pull-back: fresh visual offset each frame (never accumulates)
    if (this.camPull > 0.0001) {
      const cam = this.experience.camera.instance;
      const tgt = this.experience.camera.target;
      _dir.copy(cam.position).sub(tgt).normalize();
      cam.position.addScaledVector(_dir, this.pullDist * this.camPull);
      cam.position.y += this.pullUp * this.camPull;
      cam.lookAt(tgt);
    }

    // billboard the air-rain sheets toward the (offset) camera
    if (this.rainPlanes.length && this.rainPlanes[0].visible) {
      const q = this.experience.camera.instance.quaternion;
      for (const p of this.rainPlanes) p.quaternion.copy(q);
    }
  }

  public destroy() {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('keydown', this.onKeyDown);
    gsap.killTweensOf(this.uniforms.uProgress);
    gsap.killTweensOf(this);
    for (const p of this.rainPlanes) {
      this.experience.scene.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    this.rainPlanes = [];
    this.atlas.dispose();
    this.experience.scene.fog = null;
  }
}
