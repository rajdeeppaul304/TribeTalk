// eventBus.js
import EventEmitter from "events";

class AppEventBus extends EventEmitter {}

export const eventBus = new AppEventBus();