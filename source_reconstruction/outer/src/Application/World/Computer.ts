import Application from '../Application';
import BakedModel from '../Utils/BakedModel';
export default class Computer {
    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;
        this.bakeModel();
        this.setModel();
    }
    bakeModel() {
        this.bakedModel = new BakedModel(this.resources.items.gltfModel.computerSetupModel, this.resources.items.texture.computerSetupTexture, 900);
    }
    setModel() {
        this.scene.add(this.bakedModel.getModel());
    }
}
