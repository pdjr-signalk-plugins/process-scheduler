export declare class TransientPluginStatus {
    static DEFAULT_REVERT_SECONDS: number;
    static app: any;
    static defaultStatus: string | undefined;
    static revertSeconds: number;
    static revertTimeout: NodeJS.Timeout | undefined;
    constructor(app: any, defaultStatus: string, revertSeconds?: number);
    setDefaultStatus(message: string): void;
    setStatus(message: string): void;
    revertStatus(): void;
}
