export class TransientPluginStatus {
  static DEFAULT_REVERT_SECONDS: number = 10;

  static app: any = undefined;
  static defaultStatus: string | undefined = undefined;
  static revertSeconds: number = TransientPluginStatus.DEFAULT_REVERT_SECONDS;
  static revertTimeout: NodeJS.Timeout | undefined = undefined;

  constructor(app: any, defaultStatus: string, revertSeconds?: number) {
    TransientPluginStatus.app = app;
    TransientPluginStatus.defaultStatus = defaultStatus;
    TransientPluginStatus.revertSeconds = (revertSeconds)?revertSeconds:TransientPluginStatus.DEFAULT_REVERT_SECONDS;

    if (TransientPluginStatus.defaultStatus) app.setPluginStatus(TransientPluginStatus.defaultStatus);
  }

  setDefaultStatus(message: string) {
    TransientPluginStatus.defaultStatus = message;
    if (!TransientPluginStatus.revertTimeout) TransientPluginStatus.app.setPluginStatus(TransientPluginStatus.defaultStatus);
  }

  setStatus(message: string) {
    if (TransientPluginStatus.revertTimeout) {
      clearTimeout(TransientPluginStatus.revertTimeout);
      TransientPluginStatus.revertTimeout = undefined;
    }
    TransientPluginStatus.app.debug(`${message}...`);
    TransientPluginStatus.app.setPluginStatus(`${message}...`);
    TransientPluginStatus.revertTimeout = setTimeout(this.revertStatus, TransientPluginStatus.revertSeconds * 1000)
  }

  revertStatus() {
    TransientPluginStatus.revertTimeout = undefined;
    TransientPluginStatus.app.setPluginStatus(TransientPluginStatus.defaultStatus);
  }

}