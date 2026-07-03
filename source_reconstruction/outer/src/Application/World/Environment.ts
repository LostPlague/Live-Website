import Application from '../Application';
import BakedModel from '../Utils/BakedModel';
export default class Environment {
    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;
        this.bakeModel();
        this.setModel();
    }
    bakeModel() {
        this.bakedModel = new BakedModel(this.resources.items.gltfModel.environmentModel, this.resources.items.texture.environmentTexture, 900);
    }
    setModel() {
        this.scene.add(this.bakedModel.getModel());
    }
    update() { }
}
