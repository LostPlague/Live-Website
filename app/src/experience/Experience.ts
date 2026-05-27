import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { Camera } from './Camera';
import { World } from './World';
import { MonitorScreen } from './MonitorScreen';
import { CoffeeSteam } from './CoffeeSteam';
import { AudioManager } from './AudioManager';

export interface ExperienceOptions {
  container: HTMLDivElement;
  webglContainer: HTMLDivElement;
  cssContainer: HTMLDivElement;
  onProgress: (progress: number) => void;
  onBiosLine: (line: string) => void;
  onLoad: () => void;
  onCameraStateChange: (state: 'loading' | 'idle' | 'desk' | 'monitor' | 'orbit') => void;
}

export class Experience {
  options: ExperienceOptions;
  scene!: THREE.Scene;
  cssScene!: THREE.Scene;
  camera!: Camera;
  renderer!: THREE.WebGLRenderer;
  cssRenderer!: CSS3DRenderer;
  world!: World;
  monitorScreen!: MonitorScreen;
  coffeeSteam!: CoffeeSteam;
  audioManager!: AudioManager;
  
  clock!: THREE.Timer;
  animId: number = 0;

  constructor(options: ExperienceOptions) {
    this.options = options;

    // Wrap camera state change callback to trigger AudioManager cutoff filter changes
    const originalOnCameraStateChange = this.options.onCameraStateChange;
    this.options.onCameraStateChange = (state) => {
      originalOnCameraStateChange(state);
      this.audioManager?.setAmbientCutoff(state);
    };

    this.init();
  }

  private init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scenes
    this.scene = new THREE.Scene();
    this.cssScene = new THREE.Scene();

    // Renderer (WebGL)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.options.webglContainer.appendChild(this.renderer.domElement);

    // CSS3D Renderer
    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.setSize(width, height);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.options.cssContainer.appendChild(this.cssRenderer.domElement);

    // Sub-modules instantiation
    this.camera = new Camera(this);

    this.audioManager = new AudioManager(this);
    this.monitorScreen = new MonitorScreen(this);
    this.world = new World(this);
    this.coffeeSteam = new CoffeeSteam(this);

    // Events
    window.addEventListener('resize', this.handleResize);

    // Tick Render Loop
    this.clock = new THREE.Timer();
    this.tick();
  }

  private tick = (timestamp?: number) => {
    this.animId = requestAnimationFrame(this.tick);

    this.clock.update(timestamp);
    const elapsed = this.clock.getElapsed() * 1000; // ms
    const dt = this.clock.getDelta(); // seconds

    // Update camera behavior based on states
    this.camera.update(elapsed, dt);
    this.monitorScreen.update(this.camera.instance.position);
    this.coffeeSteam.update(elapsed);

    // Render WebGL & CSS3D
    this.renderer.render(this.scene, this.camera.instance);
    this.cssRenderer.render(this.cssScene, this.camera.instance);
  };

  private handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera.resize(w, h);
    this.renderer.setSize(w, h);
    this.cssRenderer.setSize(w, h);
  };

  public destroy() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.handleResize);
    
    this.camera.destroy();
    this.audioManager.destroy();
    this.world.destroy();
    this.monitorScreen.destroy();
    this.coffeeSteam.destroy();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.cssRenderer.domElement.parentNode) {
      this.cssRenderer.domElement.parentNode.removeChild(this.cssRenderer.domElement);
    }
  }
}
