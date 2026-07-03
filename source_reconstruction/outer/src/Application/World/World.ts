import Application from '../Application';
import ComputerSetup from './Computer';
import MonitorScreen from './MonitorScreen';
import Environment from './Environment';
import Decor from './Decor';
import CoffeeSteam from './CoffeeSteam';
import AudioManager from '../Audio/AudioManager';
export default class World {
    constructor() {
        this.application = new Application();
        this.scene = this.application.scene;
        this.resources = this.application.resources;
        // Wait for resources
        this.resources.on('ready', () => {
            // Setup
            this.environment = new Environment();
            this.decor = new Decor();
            this.computerSetup = new ComputerSetup();
            this.monitorScreen = new MonitorScreen();
            this.coffeeSteam = new CoffeeSteam();
            this.audioManager = new AudioManager();
            // const hb = new Hitboxes();
            // this.cursor = new Cursor();
        });
    }
    update() {
        if (this.monitorScreen)
            this.monitorScreen.update();
        if (this.environment)
            this.environment.update();
        if (this.coffeeSteam)
            this.coffeeSteam.update();
        if (this.audioManager)
            this.audioManager.update();
    }
}
