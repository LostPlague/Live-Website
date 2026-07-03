import Application from '../Application';
import EventEmitter from './EventEmitter';
import UIEventBus from '../UI/EventBus';
export default class Loading extends EventEmitter {
    constructor() {
        super();
        this.application = new Application();
        this.resources = this.application.resources;
        this.scene = this.application.scene;
        this.on('loadedSource', (sourceName, loaded, toLoad) => {
            this.progress = loaded / toLoad;
            UIEventBus.dispatch('loadedSource', {
                sourceName: sourceName,
                progress: loaded / toLoad,
                toLoad: toLoad,
                loaded: loaded,
            });
        });
    }
}
