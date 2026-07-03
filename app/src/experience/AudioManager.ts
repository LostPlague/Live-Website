import * as THREE from 'three';
import { Experience } from './Experience';

export class AudioManager {
  experience: Experience;
  listener!: THREE.AudioListener;
  loader!: THREE.AudioLoader;
  buffers: Record<string, AudioBuffer> = {};

  mouseAudioSource!: THREE.Object3D;
  keyboardAudioSource!: THREE.Object3D;

  mouseMouseDownAudio?: THREE.PositionalAudio;
  mouseMouseUpAudio?: THREE.PositionalAudio;
  keyboardKeysAudio: THREE.PositionalAudio[] = [];

  ambientAudio?: THREE.Audio;
  biquadFilter?: BiquadFilterNode;

  constructor(experience: Experience) {
    this.experience = experience;
    this.init();
  }

  private init() {
    this.listener = new THREE.AudioListener();
    this.experience.camera.instance.add(this.listener);

    this.loader = new THREE.AudioLoader();

    // 3D sound sources
    this.mouseAudioSource = new THREE.Object3D();
    this.mouseAudioSource.position.set(800, -300, 1200);
    this.experience.scene.add(this.mouseAudioSource);

    this.keyboardAudioSource = new THREE.Object3D();
    this.keyboardAudioSource.position.set(-300, -400, 1200);
    this.experience.scene.add(this.keyboardAudioSource);

    // Register postMessage event listener (stub for 2C)
    window.addEventListener('message', this.handleMessage);

    // Preload audio assets
    const audioToLoad: Record<string, string> = {
      mouseDown: '/audio/mouse_down.mp3',
      mouseUp: '/audio/mouse_up.mp3',
      office: '/audio/office.mp3',
      key1: '/audio/keyboard/key_1.mp3',
      key2: '/audio/keyboard/key_2.mp3',
      key3: '/audio/keyboard/key_3.mp3',
      key4: '/audio/keyboard/key_4.mp3',
      key5: '/audio/keyboard/key_5.mp3',
      key6: '/audio/keyboard/key_6.mp3',
      ccType: '/audio/type.mp3',
    };

    const loadAudioPromise = (key: string, path: string): Promise<AudioBuffer> => {
      return new Promise((resolve, reject) => {
        this.loader.load(
          path,
          (buffer) => resolve(buffer),
          undefined,
          (err) => reject(err)
        );
      });
    };

    const audioPromises = Object.entries(audioToLoad).map(([key, path]) => {
      return loadAudioPromise(key, path)
        .then((buffer) => {
          this.buffers[key] = buffer;
        })
        .catch((err) => {
          console.warn(`Warning: Could not load audio asset ${key} at path ${path}`, err);
        });
    });

    Promise.all(audioPromises).then(() => {
      this.experience.options.onBiosLine("Preloaded audio assets... Done.");
      this.setupAudioNodes();
    });
  }

  private setupAudioNodes() {
    // 1. Mouse Click Positional Audio
    if (this.buffers['mouseDown']) {
      this.mouseMouseDownAudio = new THREE.PositionalAudio(this.listener);
      this.mouseMouseDownAudio.setBuffer(this.buffers['mouseDown']);
      this.mouseMouseDownAudio.setRefDistance(200);
      this.mouseAudioSource.add(this.mouseMouseDownAudio);
    }

    if (this.buffers['mouseUp']) {
      this.mouseMouseUpAudio = new THREE.PositionalAudio(this.listener);
      this.mouseMouseUpAudio.setBuffer(this.buffers['mouseUp']);
      this.mouseMouseUpAudio.setRefDistance(200);
      this.mouseAudioSource.add(this.mouseMouseUpAudio);
    }

    // 2. Keyboard Key Positional Audio
    for (let i = 1; i <= 6; i++) {
      const key = `key${i}`;
      const buffer = this.buffers[key];
      if (buffer) {
        const keySound = new THREE.PositionalAudio(this.listener);
        keySound.setBuffer(buffer);
        keySound.setRefDistance(200);
        this.keyboardAudioSource.add(keySound);
        this.keyboardKeysAudio.push(keySound);
      }
    }

    // 3. Non-Positional Ambient Audio (loop: true, routed through BiquadFilter lowpass)
    if (this.buffers['office']) {
      const context = this.listener.context;
      this.biquadFilter = context.createBiquadFilter();
      this.biquadFilter.type = 'lowpass';
      this.biquadFilter.frequency.value = 22000; // Passthrough default

      this.ambientAudio = new THREE.Audio(this.listener);
      this.ambientAudio.setBuffer(this.buffers['office']);
      this.ambientAudio.setLoop(true);
      this.ambientAudio.setVolume(0.12);
      this.ambientAudio.setFilters([this.biquadFilter]);

      // Sync active state cutoff immediately after setup to fix initial load state cutoff
      this.setAmbientCutoff(this.experience.camera.state);
    }
  }

  private handleMessage = (e: MessageEvent) => {
    if (e.data?.type === 'mouseDown') {
      this.playMouseDown();
    } else if (e.data?.type === 'mouseUp') {
      this.playMouseUp();
    } else if (e.data?.type === 'keyPress') {
      this.playKeyRandom();
    } else if (e.data?.type === 'ccType') {
      this.playCcType();
    }
  };

  // Public exposed methods
  public playMouseDown() {
    if (this.mouseMouseDownAudio) {
      if (this.mouseMouseDownAudio.isPlaying) {
        this.mouseMouseDownAudio.stop();
      }
      this.mouseMouseDownAudio.play();
    }
  }

  public playMouseUp() {
    if (this.mouseMouseUpAudio) {
      if (this.mouseMouseUpAudio.isPlaying) {
        this.mouseMouseUpAudio.stop();
      }
      this.mouseMouseUpAudio.play();
    }
  }

  public playKeyRandom() {
    if (this.keyboardKeysAudio.length > 0) {
      const idx = Math.floor(Math.random() * this.keyboardKeysAudio.length);
      const keySound = this.keyboardKeysAudio[idx];
      if (keySound) {
        if (keySound.isPlaying) {
          keySound.stop();
        }
        keySound.play();
      }
    }
  }

  // Henry's InfoOverlay typewriter tick. Extracted verbatim from his bundle:
  //   playAudio("ccType", { volume: 0.1, randDetuneScale: 0, pitch: 20 })
  // randDetuneScale 0 → no random detune; pitch 20 → setDetune(100 * 20) = 2000
  // cents. Played on the listener's WebAudio context — the same path Howler uses,
  // so it's audible (unlike HTMLAudio.playbackRate, which muted the short clip).
  public playCcType() {
    const buffer = this.buffers['ccType'];
    if (!buffer) return;
    const ctx = this.listener.context;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.detune.value = 2000;            // Henry: pitch 20 → setDetune(100 * 20)
    const gain = ctx.createGain();
    gain.gain.value = 0.1;              // Henry: volume 0.1
    src.connect(gain).connect(this.listener.getInput());
    src.onended = () => { src.disconnect(); gain.disconnect(); };
    src.start();
  }

  public startAmbient() {
    if (this.ambientAudio && !this.ambientAudio.isPlaying) {
      const context = this.listener.context;
      if (context.state === 'suspended') {
        context.resume().then(() => {
          this.ambientAudio?.play();
        });
      } else {
        this.ambientAudio.play();
      }
    }
  }

  public setAmbientCutoff(state: 'loading' | 'idle' | 'desk' | 'monitor' | 'orbit') {
    let frequency = 22000;
    switch (state) {
      case 'desk':
        frequency = 8000;
        break;
      case 'monitor':
        frequency = 2000;
        break;
      case 'loading':
      case 'idle':
      case 'orbit':
      default:
        frequency = 22000;
        break;
    }

    console.log('[AudioManager] setAmbientCutoff', state, '→', frequency);

    if (!this.biquadFilter) return;

    this.biquadFilter.frequency.value = frequency;
  }

  public setMuted(muted: boolean) {
    if (this.listener) {
      if (typeof this.listener.setMasterVolume === 'function') {
        this.listener.setMasterVolume(muted ? 0 : 1);
      } else {
        this.listener.gain.gain.setTargetAtTime(muted ? 0 : 1, this.listener.context.currentTime, 0.01);
      }
    }
  }

  public destroy() {
    // Stop all audio playing
    if (this.ambientAudio && this.ambientAudio.isPlaying) {
      this.ambientAudio.stop();
    }
    if (this.mouseMouseDownAudio && this.mouseMouseDownAudio.isPlaying) {
      this.mouseMouseDownAudio.stop();
    }
    if (this.mouseMouseUpAudio && this.mouseMouseUpAudio.isPlaying) {
      this.mouseMouseUpAudio.stop();
    }
    this.keyboardKeysAudio.forEach((sound) => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });

    // Remove listener from camera
    if (this.listener && this.listener.parent) {
      this.listener.parent.remove(this.listener);
    }

    // Remove positional objects from scene
    if (this.mouseAudioSource && this.mouseAudioSource.parent) {
      this.mouseAudioSource.parent.remove(this.mouseAudioSource);
    }
    if (this.keyboardAudioSource && this.keyboardAudioSource.parent) {
      this.keyboardAudioSource.parent.remove(this.keyboardAudioSource);
    }

    // Remove window event listener
    window.removeEventListener('message', this.handleMessage);
  }
}
