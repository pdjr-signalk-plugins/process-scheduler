"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginStatus = void 0;
class PluginStatus {
    constructor(app, defaultStatus, revertSeconds) {
        PluginStatus.app = app;
        PluginStatus.defaultStatus = defaultStatus;
        PluginStatus.revertSeconds = (revertSeconds) ? revertSeconds : PluginStatus.DEFAULT_REVERT_SECONDS;
        if (PluginStatus.defaultStatus)
            app.setPluginStatus(PluginStatus.defaultStatus);
    }
    setDefaultStatus(message) {
        PluginStatus.defaultStatus = message;
        if (!PluginStatus.revertTimeout)
            PluginStatus.app.setPluginStatus(PluginStatus.defaultStatus);
    }
    setStatus(message) {
        if (PluginStatus.revertTimeout) {
            clearTimeout(PluginStatus.revertTimeout);
            PluginStatus.revertTimeout = undefined;
        }
        PluginStatus.app.debug(`${message}...`);
        PluginStatus.app.setPluginStatus(`${message}...`);
        PluginStatus.revertTimeout = setTimeout(this.revertStatus, PluginStatus.revertSeconds * 1000);
    }
    revertStatus() {
        PluginStatus.revertTimeout = undefined;
        PluginStatus.app.setPluginStatus(PluginStatus.defaultStatus);
    }
}
exports.PluginStatus = PluginStatus;
PluginStatus.DEFAULT_REVERT_SECONDS = 10;
PluginStatus.app = undefined;
PluginStatus.defaultStatus = undefined;
PluginStatus.revertSeconds = PluginStatus.DEFAULT_REVERT_SECONDS;
PluginStatus.revertTimeout = undefined;
