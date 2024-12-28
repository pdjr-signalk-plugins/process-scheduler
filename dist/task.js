"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
class Task {
    constructor(options) {
        this.name = '';
        this.controlPath = '';
        this.controlPathObject = {};
        this.activities = [];
        this.triggerEventStream = undefined;
        var matches;
        if (!options.name)
            throw new Error("missing 'name' property");
        if (!options.controlPath)
            throw new Error("missing 'controlPath' property");
        this.name = options.name;
        this.controlPath = options.controlPath;
        if ((matches = options.controlPath.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
            this.controlPathObject.type = 'notification';
            this.controlPathObject.path = `notifications.${matches[1]}`;
            this.controlPathObject.onValue = matches[2];
        }
        else if ((matches = options.controlPath.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
            this.controlPathObject.type = 'notification';
            this.controlPathObject.path = `notifications.${matches[1]}`;
            this.controlPathObject.onValue = undefined;
        }
        else if (matches = options.controlPath.match(/^(.*):(.*)$/)) {
            this.controlPathObject.type = 'switch';
            this.controlPathObject.path = matches[1];
            this.controlPathObject.onValue = matches[2];
        }
        else if (matches = options.controlPath.match(/^(.*)$/)) {
            this.controlPathObject.type = 'switch';
            this.controlPathObject.path = matches[1];
            this.controlPathObject.onValue = 1;
        }
        else
            throw new Error("invalid 'controlPath' property");
        if ((!options.activities) || (!Array.isArray(options.activities)) || (options.activities.length == 0))
            throw new Error("missing 'activities' array property");
        var activityindex = 0;
        this.activities = options.activities.reduce((a, activityOption) => {
            if (!activityOption.path)
                throw new Error("missing activity 'path' property");
            if (!activityOption.duration)
                throw new Error("missing 'duration' property");
            var activity = {};
            activity.name = `${this.name}[` + `${(activityOption.name !== undefined) ? activityOption.name : Task.ACTIVITY_NAME_DEFAULT}-${activityindex++}` + ']';
            activity.delay = (activityOption.delay !== undefined) ? activityOption.delay : Task.ACTIVITY_DELAY_DEFAULT;
            activity.repeat = (activityOption.repeat !== undefined) ? activityOption.repeat : Task.ACTIVITY_REPEAT_DEFAULT;
            activity.duration = activityOption.duration;
            if ((matches = activityOption.path.match(/^(notifications\..*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
                activity.path = matches[1];
                activity.onValue = matches[2];
                activity.offValue = matches[3];
            }
            else if ((matches = activityOption.path.match(/^(notifications\..*)\:(.*)$/)) && (matches.length == 3)) {
                activity.path = matches[1];
                activity.onValue = matches[2];
                activity.offValue = undefined;
            }
            else if ((matches = activityOption.path.match(/^(notifications\..*)$/)) && (matches.length == 2)) {
                activity.path = matches[1];
                activity.onValue = 'normal';
                activity.offValue = undefined;
            }
            else if ((matches = activityOption.path.match(/^(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
                activity.path = matches[1];
                activity.onValue = matches[2];
                activity.offValue = matches[3];
            }
            else if ((matches = activityOption.path.match(/^(.*)$/)) && (matches.length == 2)) {
                activity.path = matches[1];
                activity.onValue = 1;
                activity.offValue = 0;
            }
            else
                throw new Error("invalid activity control 'path' property");
            a.push(activity);
            return (a);
        }, []);
    }
}
exports.Task = Task;
Task.ACTIVITY_NAME_DEFAULT = 'activity';
Task.ACTIVITY_DELAY_DEFAULT = 0;
Task.ACTIVITY_REPEAT_DEFAULT = 1;
