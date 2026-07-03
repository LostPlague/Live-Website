import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Application from '../Application';
import EventEmitter from './EventEmitter';
export default class Resources extends EventEmitter {
    constructor(sources) {
        super();
        this.sources = sources;
        this.items = { texture: {}, cubeTexture: {}, gltfModel: {}, audio: {} };
        this.toLoad = this.sources.length;
        this.loaded = 0;
        this.application = new Application();
        this.loading = this.application.loading;
        this.setLoaders();
        this.startLoading();
    }
    setLoaders() {
        this.loaders = {
            gltfLoader: new GLTFLoader(),
            textureLoader: new THREE.TextureLoader(),
            cubeTextureLoader: new THREE.CubeTextureLoader(),
            audioLoader: new THREE.AudioLoader(),
        };
    }
    startLoading() {
        // Load each source
        for (const source of this.sources) {
            if (source.type === 'gltfModel') {
                this.loaders.gltfLoader.load(source.path, (file) => {
                    this.sourceLoaded(source, file);
                });
            }
            else if (source.type === 'texture') {
                this.loaders.textureLoader.load(source.path, (file) => {
                    file.encoding = THREE.sRGBEncoding;
                    this.sourceLoaded(source, file);
                });
            }
            else if (source.type === 'cubeTexture') {
                this.loaders.cubeTextureLoader.load(source.path, (file) => {
                    this.sourceLoaded(source, file);
                });
            }
            else if (source.type === 'audio') {
                this.loaders.audioLoader.load(source.path, (buffer) => {
                    this.sourceLoaded(source, buffer);
                });
            }
        }
    }
    sourceLoaded(source, file) {
        this.items[source.type][source.name] = file;
        this.loaded++;
        this.loading.trigger('loadedSource', [
            source.name,
            this.loaded,
            this.toLoad,
        ]);
        if (this.loaded === this.toLoad) {
            this.trigger('ready');
        }
    }
}
