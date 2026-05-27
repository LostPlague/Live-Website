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
  private iframeEl!: HTMLIFrameElement;

  // Henry's edge-triggered hover state
  private inComputer = false;
  private prevInComputer = false;
  private mouseClickInProgress = false;
  private shouldLeaveMonitor = false;

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
    const monitorPos = new THREE.Vector3(0, 950, 255);
    const monitorRot = new THREE.Euler(-3 * THREE.MathUtils.DEG2RAD, 0, 0);

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
    iframe.style.filter = 'brightness(1.35) contrast(0.95)';
    iframe.frameBorder = '0';
    iframe.title = 'HeffernanOS';
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
    this.cssObject.position.copy(monitorPos);
    this.cssObject.rotation.copy(monitorRot);
    this.experience.cssScene.add(this.cssObject);

    // Create transparent WebGL occlusion mesh (NoBlending window)
    const occlusionGeo = new THREE.PlaneGeometry(SCREEN_SIZE.w, SCREEN_SIZE.h);
    const occlusionMat = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      opacity: 0,
      transparent: true,
      blending: THREE.NoBlending,
    });
    this.occlusionMesh = new THREE.Mesh(occlusionGeo, occlusionMat);
    this.occlusionMesh.position.copy(this.cssObject.position);
    this.occlusionMesh.rotation.copy(this.cssObject.rotation);
    this.occlusionMesh.scale.copy(this.cssObject.scale);
    this.experience.scene.add(this.occlusionMesh);
  }

  public update(cameraPosition: THREE.Vector3) {
    const monitorPos = new THREE.Vector3(0, 950, 255);
    const toCamera = cameraPosition.clone().sub(monitorPos).normalize();
    const monitorForward = new THREE.Vector3(0, 0, 1); // monitor faces +Z
    const dot = toCamera.dot(monitorForward);
    
    // Smooth transition: fade out when behind, fade in when in front
    if (this.iframeEl) {
      this.iframeEl.style.opacity = dot < 0 ? '0' : '1';
      this.iframeEl.style.pointerEvents = dot < 0 ? 'none' : 'auto';
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
