"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransientPluginStatus = void 0;
class TransientPluginStatus {
    constructor(app, defaultStatus, revertSeconds) {
        TransientPluginStatus.app = app;
        TransientPluginStatus.defaultStatus = defaultStatus;
        TransientPluginStatus.revertSeconds = (revertSeconds) ? revertSeconds : TransientPluginStatus.DEFAULT_REVERT_SECONDS;
        if (TransientPluginStatus.defaultStatus)
            app.setPluginStatus(TransientPluginStatus.defaultStatus);
    }
    setDefaultStatus(message) {
        TransientPluginStatus.defaultStatus = message;
        if (!TransientPluginStatus.revertTimeout)
            TransientPluginStatus.app.setPluginStatus(TransientPluginStatus.defaultStatus);
    }
    setStatus(message) {
        if (TransientPluginStatus.revertTimeout) {
            clearTimeout(TransientPluginStatus.revertTimeout);
            TransientPluginStatus.revertTimeout = undefined;
        }
        TransientPluginStatus.app.setPluginStatus(message);
        TransientPluginStatus.revertTimeout = setTimeout(this.revertStatus, TransientPluginStatus.revertSeconds * 1000);
    }
    revertStatus() {
        TransientPluginStatus.revertTimeout = undefined;
        TransientPluginStatus.app.setPluginStatus(TransientPluginStatus.defaultStatus);
    }
}
exports.TransientPluginStatus = TransientPluginStatus;
TransientPluginStatus.DEFAULT_REVERT_SECONDS = 10;
TransientPluginStatus.app = undefined;
TransientPluginStatus.defaultStatus = undefined;
TransientPluginStatus.revertSeconds = TransientPluginStatus.DEFAULT_REVERT_SECONDS;
TransientPluginStatus.revertTimeout = undefined;
