import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { Experience } from './Experience';

const SCREEN_SIZE = { w: 1280, h: 1024 };
const IFRAME_PADDING = 32;
const IFRAME_SIZE = {
  w: SCREEN_SIZE.w - IFRAME_PADDING,
  h: SCREEN_SIZE.h - IFRAME_PADDING,
};

export class MonitorScreen {
  experience: Experience;
  cssObject!: CSS3DObject;
  occlusionMesh!: THREE.Mesh;
  public iframeEl!: HTMLIFrameElement;
  private dimmingPlane?: THREE.Mesh;
  private monitorPos = new THREE.Vector3(0, 950, 255);
  private monitorRot = new THREE.Euler(-3 * THREE.MathUtils.DEG2RAD, 0, 0);

  // Henry's edge-triggered hover state
  private inComputer = false;
  private prevInComputer = false;
  private mouseClickInProgress = false;
  private shouldLeaveMonitor = false;

  /** true while the mouse is over the CRT screen (read by RoomMatrix) */
  public get isMouseOnScreen(): boolean {
    return this.inComputer;
  }

  constructor(experience: Experience) {
    this.experience = experience;
    this.initializeScreenEvents();
    this.init();
  }

  // Henry's exact hover detection — ported verbatim from source_reconstruction
  private initializeScreenEvents() {
    document.addEventListener('mousemove', (event) => {
      // @ts-ignore
      const id = event.target?.id;
      let isIn = false;
      // @ts-ignore
      if (event.inComputer) {
        isIn = true;
      } else if (id === 'computer-screen') {
        isIn = true;
        try {
          // @ts-ignore
          event.inComputer = true;
        } catch (e) {
          // Safe fallback for sealed event objects
        }
      }
      this.inComputer = isIn;

      if (this.inComputer && !this.prevInComputer) {
        this.experience.camera.enterMonitor();
        // Focus follows clicks, not hover — so after any camera trip the OS
        // iframe can lose keyboard focus and typing silently goes nowhere
        // (e.g. the final Matrix question). Hand focus back on hover-enter.
        try { this.iframeEl?.contentWindow?.focus(); } catch {}
      }
      if (
        !this.inComputer &&
        this.prevInComputer &&
        !this.mouseClickInProgress
      ) {
        this.experience.camera.leftMonitor();
      }
      if (
        !this.inComputer &&
        this.mouseClickInProgress &&
        this.prevInComputer
      ) {
        this.shouldLeaveMonitor = true;
      } else {
        this.shouldLeaveMonitor = false;
      }
      this.prevInComputer = this.inComputer;
    }, false);

    document.addEventListener('mousedown', (event) => {
      // @ts-ignore
      const id = event.target?.id;
      let isIn = false;
      // @ts-ignore
      if (event.inComputer) {
        isIn = true;
      } else if (id === 'computer-screen') {
        isIn = true;
        try {
          // @ts-ignore
          event.inComputer = true;
        } catch (e) {
          // Safe fallback for sealed event objects
        }
      }
      this.inComputer = isIn;
      this.mouseClickInProgress = true;
      this.prevInComputer = this.inComputer;
    }, false);

    document.addEventListener('mouseup', (event) => {
      // @ts-ignore
      const id = event.target?.id;
      let isIn = false;
      // @ts-ignore
      if (event.inComputer) {
        isIn = true;
      } else if (id === 'computer-screen') {
        isIn = true;
        try {
          // @ts-ignore
          event.inComputer = true;
        } catch (e) {
          // Safe fallback for sealed event objects
        }
      }
      this.inComputer = isIn;
      if (this.shouldLeaveMonitor) {
        this.experience.camera.leftMonitor();
        this.shouldLeaveMonitor = false;
      }
      this.mouseClickInProgress = false;
      this.prevInComputer = this.inComputer;
    }, false);
  }

  private init() {
    // Create containing div for CSS3DObject
    const iframeContainer = document.createElement('div');
    iframeContainer.style.width = `${SCREEN_SIZE.w}px`;
    iframeContainer.style.height = `${SCREEN_SIZE.h}px`;
    iframeContainer.style.background = '#1d2e2f';

    const iframe = document.createElement('iframe');
    iframe.id = 'computer-screen';
    iframe.src = '/os';
    iframe.style.width = `${SCREEN_SIZE.w}px`;
    iframe.style.height = `${SCREEN_SIZE.h}px`;
    iframe.style.padding = `${IFRAME_PADDING}px`;
    iframe.style.boxSizing = 'border-box';
    iframe.style.opacity = '1';
    iframe.className = 'jitter';  // Henry's CRT flicker animation
    iframe.frameBorder = '0';
    iframe.title = 'TabariOS';
    this.iframeEl = iframe;

    // Henry's exact bridge — re-dispatches inner iframe events with inComputer=true
    iframe.onload = () => {
      if (iframe.contentWindow) {
        window.addEventListener('message', (event) => {
          if (!event.data || !event.data.type) return;
          
          // Audio cues (existing — passed through, not re-dispatched)
          if (event.data.type === 'mouseDown' || event.data.type === 'mouseUp' || event.data.type === 'keyPress') {
            return; // these are handled by AudioManager elsewhere
          }
          
          const evt = new CustomEvent(event.data.type, {
            bubbles: true,
            cancelable: false,
          });
          // @ts-ignore — Henry's inComputer flag
          evt.inComputer = true;
          
          if (event.data.type === 'mousemove') {
            const clRect = iframe.getBoundingClientRect();
            const { top, left, width, height } = clRect;
            const widthRatio = width / IFRAME_SIZE.w;
            const heightRatio = height / IFRAME_SIZE.h;
            // @ts-ignore
            evt.clientX = Math.round(event.data.clientX * widthRatio + left);
            // @ts-ignore
            evt.clientY = Math.round(event.data.clientY * heightRatio + top);
          } else if (event.data.type === 'keydown' || event.data.type === 'keyup') {
            // @ts-ignore
            evt.key = event.data.key;
          }
          
          iframe.dispatchEvent(evt);
        });
      }
    };

    iframeContainer.appendChild(iframe);

    // Instantiate CSS3D Object
    this.cssObject = new CSS3DObject(iframeContainer);
    this.cssObject.position.copy(this.monitorPos);
    this.cssObject.rotation.copy(this.monitorRot);
    this.experience.cssScene.add(this.cssObject);

    // Create transparent WebGL occlusion mesh (NoBlending window)
    const occlusionGeo = new THREE.PlaneGeometry(SCREEN_SIZE.w, SCREEN_SIZE.h);
    const occlusionMat = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      opacity: 0,
      transparent: true,
      blending: THREE.NoBlending,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
    });
    this.occlusionMesh = new THREE.Mesh(occlusionGeo, occlusionMat);
    this.occlusionMesh.position.copy(this.cssObject.position);
    this.occlusionMesh.rotation.copy(this.cssObject.rotation);
    this.occlusionMesh.scale.copy(this.cssObject.scale);
    this.experience.scene.add(this.occlusionMesh);

    // --- Henry's enclosing planes (4 side walls, color 0x48493f) ---
    // maxOffset from World.ts texture layers: smudges at z+96 is highest
    const maxOffset = 96;
    this.createEnclosingPlanes(maxOffset);
    this.createPerspectiveDimmer(maxOffset);
  }

  /**
   * Creates enclosing planes for the computer screen — ported from Henry's MonitorScreen.ts
   */
  private createEnclosingPlanes(maxOffset: number) {
    const screenSize = new THREE.Vector2(SCREEN_SIZE.w, SCREEN_SIZE.h);
    const planes = {
      left: {
        size: new THREE.Vector2(maxOffset, screenSize.y),
        position: this.offsetPosition(this.monitorPos, new THREE.Vector3(-screenSize.x / 2, 0, maxOffset / 2)),
        rotation: new THREE.Euler(0, 90 * THREE.MathUtils.DEG2RAD, 0),
      },
      right: {
        size: new THREE.Vector2(maxOffset, screenSize.y),
        position: this.offsetPosition(this.monitorPos, new THREE.Vector3(screenSize.x / 2, 0, maxOffset / 2)),
        rotation: new THREE.Euler(0, 90 * THREE.MathUtils.DEG2RAD, 0),
      },
      top: {
        size: new THREE.Vector2(screenSize.x, maxOffset),
        position: this.offsetPosition(this.monitorPos, new THREE.Vector3(0, screenSize.y / 2, maxOffset / 2)),
        rotation: new THREE.Euler(90 * THREE.MathUtils.DEG2RAD, 0, 0),
      },
      bottom: {
        size: new THREE.Vector2(screenSize.x, maxOffset),
        position: this.offsetPosition(this.monitorPos, new THREE.Vector3(0, -screenSize.y / 2, maxOffset / 2)),
        rotation: new THREE.Euler(90 * THREE.MathUtils.DEG2RAD, 0, 0),
      },
    };

    for (const [_, plane] of Object.entries(planes)) {
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        color: 0x48493f,
      });
      const geometry = new THREE.PlaneGeometry(plane.size.x, plane.size.y);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(plane.position);
      mesh.rotation.copy(plane.rotation);
      this.experience.scene.add(mesh);
    }
  }

  /**
   * PerspectiveDimmer — Henry's verbatim MonitorScreen.ts code.
   * Black plane at maxOffset-5. It dims NOT by adding color (black adds 0)
   * but by accumulating CANVAS ALPHA, which occludes the OS iframe behind
   * the WebGL canvas (shown = canvas + iframe*(1-alpha)). update() raises
   * its opacity with camera distance/angle → screen dims at far/side views.
   * Engine is pinned to his three r135, where AdditiveBlending accumulates
   * alpha as srcAlpha² (weak, correct). Do NOT upgrade three: 0.184 changed
   * the alpha factors to (ONE, ONE), which over-darkens far/angled views.
   */
  private createPerspectiveDimmer(maxOffset: number) {
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      color: 0x000000,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const plane = new THREE.PlaneGeometry(SCREEN_SIZE.w, SCREEN_SIZE.h);
    const mesh = new THREE.Mesh(plane, material);
    mesh.position.copy(this.offsetPosition(this.monitorPos, new THREE.Vector3(0, 0, maxOffset - 5)));
    mesh.rotation.copy(this.monitorRot);
    this.dimmingPlane = mesh;
    this.experience.scene.add(mesh);
  }

  /**
   * Offsets a position vector by another vector — Henry's utility
   */
  private offsetPosition(position: THREE.Vector3, offset: THREE.Vector3): THREE.Vector3 {
    const newPosition = new THREE.Vector3();
    newPosition.copy(position);
    newPosition.add(offset);
    return newPosition;
  }

  public update(cameraPosition: THREE.Vector3) {
    const toCamera = cameraPosition.clone().sub(this.monitorPos).normalize();
    const monitorForward = new THREE.Vector3(0, 0, 1); // monitor faces +Z
    const dot = toCamera.dot(monitorForward);
    
    // Smooth transition: fade out when behind, fade in when in front
    if (this.iframeEl) {
      this.iframeEl.style.opacity = dot < 0 ? '0' : '1';
      this.iframeEl.style.pointerEvents = dot < 0 ? 'none' : 'auto';
    }

    // PerspectiveDimmer update — Henry's exact formula
    if (this.dimmingPlane) {
      const planeNormal = new THREE.Vector3(0, 0, 1);
      const viewVector = new THREE.Vector3();
      viewVector.copy(cameraPosition);
      viewVector.sub(this.monitorPos);
      viewVector.normalize();
      const viewDot = viewVector.dot(planeNormal);

      const dimPos = this.dimmingPlane.position;
      const distance = Math.sqrt(
        Math.pow(cameraPosition.x - dimPos.x, 2) +
        Math.pow(cameraPosition.y - dimPos.y, 2) +
        Math.pow(cameraPosition.z - dimPos.z, 2)
      );
      const opacity = 1 / (distance / 10000);
      const DIM_FACTOR = 0.7;
      // @ts-ignore
      this.dimmingPlane.material.opacity =
        (1 - opacity) * DIM_FACTOR + (1 - viewDot) * DIM_FACTOR;
    }
  }

  public destroy() {
    this.experience.cssScene.remove(this.cssObject);
    this.experience.scene.remove(this.occlusionMesh);
    
    this.occlusionMesh.geometry.dispose();
    if (this.occlusionMesh.material instanceof THREE.Material) {
      this.occlusionMesh.material.dispose();
    }
  }
}
