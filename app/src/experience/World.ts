import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Experience } from './Experience';

export class World {
  experience: Experience;
  loadedTextures: Record<string, THREE.Texture> = {};
  
  smudgesMesh?: THREE.Mesh;

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

    this.experience.options.onBiosLine("HeffernanOS BIOS v1.09");
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
      computer: '/textures/baked_computer.jpg',
      environment: '/textures/baked_environment.jpg',
      decor: '/textures/baked_decor_modified.jpg',
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
            texture.colorSpace = THREE.SRGBColorSpace;
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
    this.videoTexture1.colorSpace = THREE.SRGBColorSpace;
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
    this.videoMesh1.position.z += 2;
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
    this.videoTexture2.colorSpace = THREE.SRGBColorSpace;
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
    this.videoMesh2.position.z += 4;
    this.videoMesh2.rotation.copy(monitorRot);
    this.experience.scene.add(this.videoMesh2);

    // Smudges layer (z += 10)
    const smudgesTexture = textureLoader.load('/textures/smudges.jpg');
    smudgesTexture.colorSpace = THREE.SRGBColorSpace;
    const smudgesMat = new THREE.MeshBasicMaterial({
      map: smudgesTexture,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: 0.12,
      transparent: true,
    });
    this.smudgesMesh = new THREE.Mesh(occlusionGeo, smudgesMat);
    this.smudgesMesh.position.copy(monitorPos);
    this.smudgesMesh.position.z += 10;
    this.smudgesMesh.rotation.copy(monitorRot);
    this.experience.scene.add(this.smudgesMesh);
  }

  public destroy() {
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
