export class PluginStatus {
  static DEFAULT_REVERT_SECONDS: number = 10;

  static app: any = undefined;
  static defaultStatus: string | undefined = undefined;
  static revertSeconds: number = PluginStatus.DEFAULT_REVERT_SECONDS;
  static revertTimeout: NodeJS.Timeout | undefined = undefined;

  constructor(app: any, defaultStatus: string, revertSeconds?: number) {
    PluginStatus.app = app;
    PluginStatus.defaultStatus = defaultStatus;
    PluginStatus.revertSeconds = (revertSeconds)?revertSeconds:PluginStatus.DEFAULT_REVERT_SECONDS;

    if (PluginStatus.defaultStatus) app.setPluginStatus(PluginStatus.defaultStatus);
  }

  setDefaultStatus(message: string) {
    PluginStatus.defaultStatus = message;
    if (!PluginStatus.revertTimeout) PluginStatus.app.setPluginStatus(PluginStatus.defaultStatus);
  }

  setStatus(message: string) {
    if (PluginStatus.revertTimeout) {
      clearTimeout(PluginStatus.revertTimeout);
      PluginStatus.revertTimeout = undefined;
    }
    PluginStatus.app.debug(`${message}...`);
    PluginStatus.app.setPluginStatus(`${message}...`);
    PluginStatus.revertTimeout = setTimeout(this.revertStatus, PluginStatus.revertSeconds * 1000)
  }

  revertStatus() {
    PluginStatus.revertTimeout = undefined;
    PluginStatus.app.setPluginStatus(PluginStatus.defaultStatus);
  }

}