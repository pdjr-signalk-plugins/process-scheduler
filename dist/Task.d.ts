import { EventStream } from "baconjs";
export declare class Task {
    static ACTIVITY_NAME_DEFAULT: string;
    static ACTIVITY_DELAY_DEFAULT: number;
    static ACTIVITY_REPEAT_DEFAULT: number;
    name: string;
    controlPath: string;
    controlPathObject: ControlPathObject;
    activities: Activity[];
    triggerEventStream: EventStream<string | number | undefined> | undefined;
    constructor(options: any);
}
interface ControlPathObject {
    type?: string;
    path?: string;
    onValue?: string | number | undefined;
}
interface Activity {
    name: string;
    delay: number;
    repeat: number;
    path: string;
    onValue: string | number;
    offValue: string | number | undefined;
    duration: number;
}
export {};
