import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Experience } from './Experience';

// Register and create custom Bezier ease matching Bezier(0.13, 0.99, 0, 1)
gsap.registerPlugin(CustomEase);
CustomEase.create('monitorEase', 'M0,0 C0.13,0.99 0,1 1,1');

export class Camera {
  experience: Experience;
  instance!: THREE.PerspectiveCamera;
  controls!: OrbitControls;

  state: 'loading' | 'idle' | 'desk' | 'monitor' | 'orbit' = 'loading';
  userLocked = false;
  freeCam = false;
  /** While the Matrix finale owns the room, only monitor/desk views exist. */
  matrixLock = false;
  position = new THREE.Vector3(-35000, 35000, 35000);
  target = new THREE.Vector3(0, -5000, 0);
  mouse = new THREE.Vector2(0, 0);
  activeTransition: gsap.core.Timeline | null = null;

  constructor(experience: Experience) {
    this.experience = experience;
    this.init();
  }

  private init() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    this.instance = new THREE.PerspectiveCamera(35, aspect, 10, 900000);
    this.instance.position.copy(this.position);
    this.instance.lookAt(this.target);

    this.controls = new OrbitControls(this.instance, this.experience.renderer.domElement);
    this.controls.target.copy(new THREE.Vector3(-100, 350, 0)); // orbitControlsStart focal
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minDistance = 4000;
    this.controls.maxDistance = 29000;
    this.controls.zoomSpeed = 2.0;
    this.controls.enabled = false; // disabled by default; enabled only in orbit state

    window.addEventListener('mousemove', this.onMouseMove);
  }

  private onMouseMove = (event: MouseEvent) => {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
  };

  public enterMonitor() {
    if (this.state === 'orbit') return;
    if (this.userLocked && this.state === 'monitor') return;
    if (this.state === 'monitor') return;
    this.triggerTransition('monitor', 2000);
  }

  public leftMonitor() {
    if (this.state === 'orbit') return;
    if (this.userLocked) return;
    if (this.state !== 'monitor') return;
    this.triggerTransition('desk', 1000);
  }

  public triggerTransition(target: 'idle' | 'desk' | 'monitor' | 'orbit', durationMs: number = 1000, opts?: { userInitiated?: boolean }) {
    if (this.state === target) return;
    // Matrix finale: wide/orbit views are off-limits — OS and desk only
    if (this.matrixLock && (target === 'idle' || target === 'orbit')) return;

    // Sticky lock: user-initiated monitor click stays locked; anything else clears it
    if (opts?.userInitiated) {
      this.userLocked = (target === 'monitor');
    }

    if (this.activeTransition) {
      this.activeTransition.kill();
    }

    this.state = target;
    this.experience.options.onCameraStateChange(target);

    // ENTER orbit: disable controls during transition; enable in onComplete
    // EXIT orbit (going to idle/desk/monitor): immediately disable controls
    if (target !== 'orbit') {
      this.freeCam = false;
      this.controls.enabled = false;
    }

    const targets = {
      idle: {
        pos: new THREE.Vector3(-20000, 12000, 20000),
        foc: new THREE.Vector3(0, -1000, 0),
      },
      desk: {
        pos: new THREE.Vector3(0, 1800, 5500),
        foc: new THREE.Vector3(0, 500, 0),
      },
      monitor: {
        pos: new THREE.Vector3(0, 950, 2000),
        foc: new THREE.Vector3(0, 950, 0),
      },
      orbit: {
        pos: new THREE.Vector3(-15000, 10000, 15000),
        foc: new THREE.Vector3(-100, 350, 0),
      },
    };

    const targetCoords = targets[target];
    const tl = gsap.timeline({
      onComplete: () => {
        this.activeTransition = null;
        if (target === 'orbit') {
          // Henry's pattern: sync instance position, then update controls, then flip flag
          this.instance.position.copy(this.position);
          this.controls.target.copy(this.target);
          this.controls.update();
          this.freeCam = true;
          this.controls.enabled = true;
        }
      }
    });

    this.activeTransition = tl;

    const aspect = window.innerHeight / window.innerWidth;
    if (target === 'desk') {
      targetCoords.pos.z = 5500 + aspect * 3000 - 1800;
    } else if (target === 'monitor') {
      const additionalZoom = window.innerWidth < 768 ? 0 : 600;
      targetCoords.pos.z = 2000 + aspect * 1200 - additionalZoom;
    }

    // Origin -> Destination Easing Lookups
    const easings: Record<string, string> = {
      idle: 'expo.out',
      desk: 'power5.inOut',
      monitor: 'monitorEase',
      orbit: 'monitorEase',
    };
    const targetEase = easings[target];

    tl.to(this.position, {
      x: targetCoords.pos.x,
      y: targetCoords.pos.y,
      z: targetCoords.pos.z,
      duration: durationMs / 1000,
      ease: targetEase,
    }, 0);

    tl.to(this.target, {
      x: targetCoords.foc.x,
      y: targetCoords.foc.y,
      z: targetCoords.foc.z,
      duration: durationMs / 1000,
      ease: targetEase,
    }, 0);
  }

  public update(elapsed: number, dt: number) {
    // Henry's pattern: freeCam flag short-circuits everything else
    if (this.freeCam && this.controls) {
      this.position.copy(this.controls.object.position);
      this.target.copy(this.controls.target);
      this.controls.update();
      return;
    }

    if (this.state === 'idle' && !this.activeTransition) {
      const originX = -20000;
      const originY = 12000;
      this.position.x = Math.sin((elapsed + 19000) * 0.00008) * originX;
      this.position.y = Math.sin((elapsed + 1000) * 0.000004) * 4000 + originY - 3000;
      this.position.z = 20000;
      this.target.set(0, -1000, 0);
    } else if (this.state === 'desk' && !this.activeTransition) {
      const mouseX = this.mouse.x - window.innerWidth / 2;
      const mouseY = this.mouse.y - window.innerHeight;

      const targetFocX = mouseX * 0.5;
      const targetFocY = -mouseY * 0.2 + 500;
      
      this.target.x += (targetFocX - this.target.x) * 0.05;
      this.target.y += (targetFocY - this.target.y) * 0.05;
      this.target.z = 0;

      const aspect = window.innerHeight / window.innerWidth;
      const targetPosZ = 5500 + aspect * 3000 - 1800;
      this.position.z += (targetPosZ - this.position.z) * 0.05;
      this.position.x += ((mouseX * 0.15) - this.position.x) * 0.025;
    } else if (this.state === 'monitor' && !this.activeTransition) {
      const aspect = window.innerHeight / window.innerWidth;
      const additionalZoom = window.innerWidth < 768 ? 0 : 600;
      this.position.set(0, 950, 2000 + aspect * 1200 - additionalZoom);
      this.target.set(0, 950, 0);
    }

    this.instance.position.copy(this.position);
    this.instance.lookAt(this.target);
  }

  public resize(w: number, h: number) {
    this.instance.aspect = w / h;
    this.instance.updateProjectionMatrix();
  }

  public destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    this.controls.dispose();
  }
}
