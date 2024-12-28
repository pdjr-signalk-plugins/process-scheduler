"use strict";
/*
 * Copyright 2018 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const signalk_libdelta_1 = require("signalk-libdelta");
const signalk_libpluginstatus_1 = require("signalk-libpluginstatus");
const Task_1 = require("./Task");
const PLUGIN_ID = "process-scheduler";
const PLUGIN_NAME = "pdjr-process-scheduler";
const PLUGIN_DESCRIPTION = "Simple process scheduling";
const PLUGIN_SCHEMA = {
    "type": "object",
    "properties": {
        "tasks": {
            "title": "Schedule tasks",
            "type": "array",
            "items": {
                "title": "Task",
                "type": "object",
                "properties": {
                    "name": {
                        "title": "Schedule task name",
                        "type": "string"
                    },
                    "controlPath": {
                        "title": "Path which starts and stops this task",
                        "type": "string"
                    },
                    "activities": {
                        "title": "Activities making up the schedule task",
                        "type": "array",
                        "items": {
                            "title": "activity",
                            "type": "object",
                            "properties": {
                                "name": {
                                    "title": "Activity name",
                                    "type": "string"
                                },
                                "path": {
                                    "title": "Process control path",
                                    "type": "string"
                                },
                                "duration": {
                                    "title": "Activity duration in seconds",
                                    "type": "number"
                                },
                                "delay": {
                                    "title": "Delay start by this many seconds",
                                    "type": "number",
                                    "default": 0
                                },
                                "repeat": {
                                    "title": "How many times to repeat (0 says forever)",
                                    "type": "number",
                                    "default": 1
                                }
                            },
                            "required": ["path", "duration"]
                        }
                    }
                }
            },
            "default": []
        }
    },
    "required": ["tasks"]
};
const PLUGIN_UISCHEMA = {};
const CHILD_TASK_FILENAME = 'task.js';
module.exports = function (app) {
    var pluginConfiguration;
    var pluginStatus;
    var unsubscribes = [];
    var activeTaskNames = [];
    const plugin = {
        id: PLUGIN_ID,
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        schema: PLUGIN_SCHEMA,
        uiSchema: PLUGIN_UISCHEMA,
        start: function (options) {
            try {
                pluginConfiguration = makePluginConfiguration(options);
                app.debug(`using configuration: ${JSON.stringify(pluginConfiguration, null, 2)}`);
                if (pluginConfiguration.tasks.length > 0) {
                    pluginStatus = new signalk_libpluginstatus_1.PluginStatus(app, `Scheduling ${pluginConfiguration.tasks.length} task${(pluginConfiguration.tasks.length == 1) ? '' : 's'}`);
                    unsubscribes = pluginConfiguration.tasks.reduce((a, task) => {
                        // Get a trigger stream for the task controlpath that deals
                        // with switch and notification triggers.
                        var triggerStream = createTriggerStream(task.controlPathObject);
                        var childProcess = createChildProcessForTask(CHILD_TASK_FILENAME, task);
                        // Subscribe to the trigger <stream> and wait for the
                        // arrival of values saying whether to start or stop task
                        // activities and respond by sending appropriate control
                        // messages to the child process.
                        a.push(triggerStream.skipDuplicates().onValue((state) => {
                            switch (state) {
                                case 1:
                                    activeTaskNames.push(task.name || '');
                                    pluginStatus.setStatus(`Starting task '${task.name}'`);
                                    if (childProcess != null)
                                        childProcess.send({ "action": "START", "activities": task.activities });
                                    break;
                                case 0:
                                    activeTaskNames = activeTaskNames.filter((e) => (e !== task.name));
                                    pluginStatus.setStatus(`Stopping task '${task.name}'`);
                                    if (childProcess != null)
                                        childProcess.send({ "action": "STOP" });
                                    break;
                                default:
                                    app.debug(`ignoring invalid start task request '${state}'on task '${task.name}'`);
                                    break;
                            }
                        }));
                        return (a);
                    }, []);
                }
                else {
                    pluginStatus.setDefaultStatus('Stopped: configuration includes no valid tasks');
                }
            }
            catch (e) {
                pluginStatus.setDefaultStatus('Stopped: bad or missing plugin configuration');
                app.setPluginError(`${e.message}`);
            }
        },
        stop: function () {
            unsubscribes.forEach(f => f());
            unsubscribes = [];
        }
    };
    function makePluginConfiguration(options) {
        return ((options.tasks || []).map((option) => new Task_1.Task(option)));
    }
    function createTriggerStream(controlPathObject) {
        var stream = app.streambundle.getSelfStream(controlPathObject.path);
        switch (controlPathObject.type) {
            case 'notification':
                if (controlPathObject.onValue === undefined) {
                    return (stream.map((from) => (from !== null) ? 1 : 0));
                }
                else {
                    return (stream.map((from) => ((from.state == controlPathObject.onValue) ? 1 : 0)));
                }
                break;
            default:
                return (stream.map((from) => ((from.state == controlPathObject.onValue) ? 1 : 0)));
                break;
        }
    }
    function createChildProcessForTask(child, task) {
        // Create a child process for executing the task's activities.
        var childProcess = (0, node_child_process_1.fork)(`${__dirname}/${child}`);
        app.debug(`creating child process for task '${task.name}'`);
        // The child sends a message saying whether an activity
        // should turn its output on or off, so we manage that here
        // for both switch and notification outputs.
        childProcess.on('message', (message) => {
            var delta = new signalk_libdelta_1.Delta(app, plugin.id);
            switch (message.action) {
                case 1:
                    if (!message.activity.path.startsWith('notifications.')) {
                        app.debug(`Starting activity '${message.activity.name}' (setting '${message.activity.path}' to '${message.activity.onValue}')`);
                        app.putSelfPath(message.activity.path, message.activity.onValue, (d) => app.debug(`put response: ${JSON.stringify(d)}`));
                    }
                    else {
                        app.debug(`Starting activity '${message.activity.name}' (issuing '${message.activity.onValue}' notification on '${message.activity.path}')`);
                        delta.addValue(message.activity.path, { state: message.activity.onValue, method: [], message: 'Scheduler ON event' }).commit().clear();
                    }
                    break;
                case 0:
                    if (!message.activity.path.startsWith('notifications.')) {
                        app.debug(`Stopping activity '${message.activity.name}' (setting '${message.activity.path}' to '${message.activity.onValue}')`);
                        app.putSelfPath(message.activity.path, message.activity.offValue, (d) => app.debug(`put response: ${JSON.stringify(d)}`));
                    }
                    else {
                        if (message.activity.offState) {
                            app.debug(`Stopping activity '${message.activity.name}' (issuing '${message.activity.onValue}' notification on '${message.activity.path}')`);
                            delta.addValue(message.activity.path, { state: message.activity.offValue, method: [], message: 'Scheduler OFF event' }).commit().clear();
                        }
                        else {
                            app.debug(`Stopping activity '${message.activity.name}' (cancelling notification on '${message.activity.path}')`);
                            delta.addValue(message.activity.path, null).commit().clear();
                        }
                    }
                    break;
                default:
                    app.debug(`Ignoring activity '${message.activity.name}' (bad action ${message.activity.action})`);
                    break;
            }
        });
        childProcess.on('exit', () => {
            app.setPluginStatus(`Stopping scheduling of: ${task.name}`);
            childProcess = null;
        });
        return (childProcess);
    }
    return (plugin);
};
