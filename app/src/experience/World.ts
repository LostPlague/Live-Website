import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Experience } from './Experience';
import { RoomMatrix } from './RoomMatrix';

export class World {
  experience: Experience;
  loadedTextures: Record<string, THREE.Texture> = {};
  roomMatrix!: RoomMatrix;
  
  smudgesMesh?: THREE.Mesh;
  shadowMesh?: THREE.Mesh;

  videoElement1?: HTMLVideoElement;
  videoElement2?: HTMLVideoElement;
  videoTexture1?: THREE.VideoTexture;
  videoTexture2?: THREE.VideoTexture;
  videoMesh1?: THREE.Mesh;
  videoMesh2?: THREE.Mesh;

  constructor(experience: Experience) {
    this.experience = experience;
    this.init();
  }

  private init() {
    const loadingManager = new THREE.LoadingManager();
    const textureLoader = new THREE.TextureLoader(loadingManager);
    const gltfLoader = new GLTFLoader(loadingManager);

    // Matrix room-takeover controller (idle until the OS posts 'matrixEnter').
    // Created before geometry loads so each room mesh can be registered on load.
    this.roomMatrix = new RoomMatrix(this.experience);

    this.experience.options.onBiosLine("TabariOS BIOS v1.09");
    this.experience.options.onBiosLine("Initializing WebGL Core... Done.");
    this.experience.options.onBiosLine("Readying assets load queue...");

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const percentage = Math.round((itemsLoaded / itemsTotal) * 100);
      this.experience.options.onProgress(percentage);
      const filename = url.split('/').pop() || '';
      this.experience.options.onBiosLine(`Loading: [${percentage}%] ${filename}`);
    };

    loadingManager.onLoad = () => {
      this.experience.options.onBiosLine("All assets cached in memory.");
      this.experience.options.onBiosLine("System ready. Click START to boot.");
      this.experience.options.onLoad();
    };

    const texturesToLoad = {
      computer: '/textures/baked_computer_tabari.png',  // Med's in-place label edit (bezel, keyboard, both back stickers → Mohamed/Tabari); diff vs Henry = 0.18, labels only
      environment: '/textures/baked_environment.jpg',
      decor: '/textures/baked_decor_tabari.jpg',  // Med's credits-paper edit composited onto Henry's pristine decor atlas
    };

    const modelsToLoad = {
      computer: '/models/computer_setup.glb',
      environment: '/models/environment.glb',
      decor: '/models/decor.glb',
    };

    const loadTexturePromise = (key: string, path: string): Promise<THREE.Texture> => {
      return new Promise((resolve, reject) => {
        textureLoader.load(
          path,
          (texture) => {
            texture.flipY = false;
            texture.encoding = THREE.sRGBEncoding; // r135 API (engine pinned to Henry's three version)
            resolve(texture);
          },
          undefined,
          (err) => reject(err)
        );
      });
    };

    const texturePromises = Object.entries(texturesToLoad).map(([key, path]) =>
      loadTexturePromise(key, path).then((texture) => {
        this.loadedTextures[key] = texture;
      })
    );

    const scale = 900;

    Promise.all(texturePromises)
      .then(() => {
        this.experience.options.onBiosLine("Baked lightmaps parsed. Loading bedroom geometry...");

        // 1. Environment GLB
        gltfLoader.load(modelsToLoad.environment, (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.scale.set(scale, scale, scale);
              child.material = new THREE.MeshBasicMaterial({
                map: this.loadedTextures.environment,
              });
              this.roomMatrix.registerMesh(child);
            }
          });
          this.experience.scene.add(model);
        });

        // 2. Decor GLB
        gltfLoader.load(modelsToLoad.decor, (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.scale.set(scale, scale, scale);
              child.material = new THREE.MeshBasicMaterial({
                map: this.loadedTextures.decor,
              });
              this.roomMatrix.registerMesh(child);
            }
          });
          this.experience.scene.add(model);
        });

        // 3. Computer Setup GLB
        gltfLoader.load(modelsToLoad.computer, (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.scale.set(scale, scale, scale);
              child.material = new THREE.MeshBasicMaterial({
                map: this.loadedTextures.computer,
              });
              this.roomMatrix.registerMesh(child);
            }
          });
          this.experience.scene.add(model);
        });
      })
      .catch((error) => {
        console.error("Failed to load baked textures:", error);
        this.experience.options.onBiosLine("BIOS Error: Asset load failure.");
      });

    // Add CRT screen glare smudge textures for extreme realism (T15 spec overlay!)
    const monitorPos = new THREE.Vector3(0, 950, 255);
    const monitorRot = new THREE.Euler(-3 * THREE.MathUtils.DEG2RAD, 0, 0);
    const occlusionGeo = new THREE.PlaneGeometry(1280, 1024);

    // T19 — Screensaver Video Overlays (Video 1 & 2)
    this.videoElement1 = document.createElement('video');
    this.videoElement1.src = '/videos/c28874fa5b347023.mp4';
    this.videoElement1.muted = true;
    this.videoElement1.loop = true;
    this.videoElement1.playsInline = true;
    this.videoElement1.autoplay = true;
    this.videoElement1.style.display = 'none';
    document.body.appendChild(this.videoElement1);
    this.videoElement1.play().catch((err) => console.error("Video 1 play error:", err));

    this.videoTexture1 = new THREE.VideoTexture(this.videoElement1);
    // Henry leaves overlay glare textures LINEAR (no sRGB tag). sRGB-tagging
    // decodes the texel darker, dimming the additive glow → screen too dark.
    // Henry's verbatim material. Engine is pinned to his three r135, where
    // AdditiveBlending = blendFunc(SRC_ALPHA, ONE) on color AND alpha: canvas
    // alpha accumulates srcAlpha² per layer (≈0.27 total across the glare
    // stack), so the browser shows the OS iframe at ~73% behind the glare.
    // Do NOT upgrade three: 0.184 changed these alpha factors to (ONE, ONE),
    // which crushes the screen (alpha 0.72 → iframe at ~28%).
    const videoMat1 = new THREE.MeshBasicMaterial({
      map: this.videoTexture1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.5,
      transparent: true,
      depthWrite: false,
    });
    this.videoMesh1 = new THREE.Mesh(occlusionGeo, videoMat1);
    this.videoMesh1.position.copy(monitorPos);
    this.videoMesh1.position.z += 40;  // Henry: offset 10 * scaleFactor 4 = 40
    this.videoMesh1.rotation.copy(monitorRot);
    this.experience.scene.add(this.videoMesh1);

    this.videoElement2 = document.createElement('video');
    this.videoElement2.src = '/videos/78d1c080b40532e6.mp4';
    this.videoElement2.muted = true;
    this.videoElement2.loop = true;
    this.videoElement2.playsInline = true;
    this.videoElement2.autoplay = true;
    this.videoElement2.style.display = 'none';
    document.body.appendChild(this.videoElement2);
    this.videoElement2.play().catch((err) => console.error("Video 2 play error:", err));

    this.videoTexture2 = new THREE.VideoTexture(this.videoElement2);
    // Linear (no sRGB) to match Henry's additive glow brightness.
    // Henry's verbatim material (see videoMat1 note re: r135 blending).
    const videoMat2 = new THREE.MeshBasicMaterial({
      map: this.videoTexture2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.1,
      transparent: true,
      depthWrite: false,
    });
    this.videoMesh2 = new THREE.Mesh(occlusionGeo, videoMat2);
    this.videoMesh2.position.copy(monitorPos);
    this.videoMesh2.position.z += 60;  // Henry: offset 15 * scaleFactor 4 = 60
    this.videoMesh2.rotation.copy(monitorRot);
    this.experience.scene.add(this.videoMesh2);

    // Smudges layer (z += 10)
    const smudgesTexture = textureLoader.load('/textures/smudges.jpg');
    // Linear (no sRGB) to match Henry's additive smudge brightness.
    // Henry's verbatim material (see videoMat1 note re: r135 blending).
    const smudgesMat = new THREE.MeshBasicMaterial({
      map: smudgesTexture,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.12,
      transparent: true,
    });
    this.smudgesMesh = new THREE.Mesh(occlusionGeo, smudgesMat);
    this.smudgesMesh.position.copy(monitorPos);
    this.smudgesMesh.position.z += 96;  // Henry: offset 24 * scaleFactor 4 = 96
    this.smudgesMesh.rotation.copy(monitorRot);
    this.experience.scene.add(this.smudgesMesh);

    // Inner shadow layer (NormalBlending, opacity: 1) — Henry's monitorShadowTexture
    const shadowTexture = textureLoader.load('/textures/shadow-compressed.png');
    // Linear (no sRGB) to match Henry's monitorShadowTexture handling.
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      opacity: 1,   // Henry's monitorShadowTexture runs at full opacity (was 0.5)
      transparent: true,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(occlusionGeo, shadowMat);
    // Henry keeps the bezel inner-shadow visible (RGBA vignette: transparent
    // center, opaque black edges) — it darkens the screen border to match his
    // CRT look. Was disabled here, which left our screen too bright/washed.
    this.shadowMesh.visible = true;
    this.shadowMesh.position.copy(monitorPos);
    this.shadowMesh.position.z += 20;   // Henry's offset: 5 * scaleFactor(4) = 20
    this.shadowMesh.rotation.copy(monitorRot);
    this.experience.scene.add(this.shadowMesh);
  }

  public startVideos() {
    if (this.videoElement1) {
      this.videoElement1.play().catch((err) => console.error("Video 1 retry play error:", err));
    }
    if (this.videoElement2) {
      this.videoElement2.play().catch((err) => console.error("Video 2 retry play error:", err));
    }
    // Diagnostic — confirms videos actually started after the user-gesture retry
    setTimeout(() => {
      console.log('[Light diag] video1.paused =', this.videoElement1?.paused, '| video2.paused =', this.videoElement2?.paused);
    }, 1000);
  }

  public destroy() {
    this.roomMatrix?.destroy();

    if (this.shadowMesh) {
      this.experience.scene.remove(this.shadowMesh);
      if (this.shadowMesh.material instanceof THREE.Material) {
        this.shadowMesh.material.dispose();
      }
      this.shadowMesh.geometry.dispose();
    }

    if (this.smudgesMesh) {
      this.experience.scene.remove(this.smudgesMesh);
      if (this.smudgesMesh.material instanceof THREE.Material) {
        this.smudgesMesh.material.dispose();
      }
      this.smudgesMesh.geometry.dispose();
    }

    if (this.videoMesh1) {
      this.experience.scene.remove(this.videoMesh1);
      this.videoMesh1.geometry.dispose();
      if (this.videoMesh1.material instanceof THREE.Material) {
        this.videoMesh1.material.dispose();
      }
    }
    if (this.videoTexture1) {
      this.videoTexture1.dispose();
    }
    if (this.videoElement1) {
      this.videoElement1.pause();
      this.videoElement1.src = '';
      this.videoElement1.load();
      if (this.videoElement1.parentNode) {
        this.videoElement1.parentNode.removeChild(this.videoElement1);
      }
    }

    if (this.videoMesh2) {
      this.experience.scene.remove(this.videoMesh2);
      this.videoMesh2.geometry.dispose();
      if (this.videoMesh2.material instanceof THREE.Material) {
        this.videoMesh2.material.dispose();
      }
    }
    if (this.videoTexture2) {
      this.videoTexture2.dispose();
    }
    if (this.videoElement2) {
      this.videoElement2.pause();
      this.videoElement2.src = '';
      this.videoElement2.load();
      if (this.videoElement2.parentNode) {
        this.videoElement2.parentNode.removeChild(this.videoElement2);
      }
    }
  }
}
