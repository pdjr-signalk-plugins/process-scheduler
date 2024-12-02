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

import { EventStream } from 'baconjs';
import { ChildProcess, fork } from 'node:child_process';
import { Delta } from 'signalk-libdelta';
import { PluginStatus } from 'signalk-libpluginstatus';

const PLUGIN_ID: string = "process-scheduler"
const PLUGIN_NAME: string = "pdjr-skplugin-process-scheduler"
const PLUGIN_DESCRIPTION: string = "Simple process scheduling"
const PLUGIN_SCHEMA: object = {
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
          "activities" : {
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
              "required": [ "path", "duration" ]
            }
          }
        }
      },
      "default": []
    }
  },
  "required": [ "tasks" ]
}
const PLUGIN_UISCHEMA: object = {}

const CHILD_TASK_FILENAME = 'task.js';

const ACTIVITY_NAME_DEFAULT: string = 'activity'
const ACTIVITY_DELAY_DEFAULT: number = 0
const ACTIVITY_REPEAT_DEFAULT: number = 1

module.exports = function(app: any) {
  var pluginStatus: PluginStatus;
	var unsubscribes: (() => void)[] = [];
  var pluginConfiguration: PluginConfiguration = <PluginConfiguration>{};
  var activeTaskNames: string[] = [];

  const plugin: SKPlugin = {
	  id: PLUGIN_ID,
	  name: PLUGIN_NAME,
	  description: PLUGIN_DESCRIPTION,
    schema: PLUGIN_SCHEMA,
    uiSchema: PLUGIN_UISCHEMA,
  
	  start: function(options: any) {

      try {
        pluginConfiguration = makePluginConfiguration(options);
        app.debug(`using configuration: ${JSON.stringify(pluginConfiguration, null, 2)}`);

        if (pluginConfiguration.tasks.length > 0) {
          pluginStatus = new PluginStatus(app, `Started: scheduling ${pluginConfiguration.tasks.length} tasks`);
          unsubscribes = pluginConfiguration.tasks.reduce((a: any, task: Task) => {
            // Get a trigger stream for the task controlpath that deals
            // with switch and notification triggers.
            var triggerStream: EventStream<number> = createTriggerStream(task.controlPathObject);
 
            var childProcess: ChildProcess | null = createChildProcessForTask(CHILD_TASK_FILENAME, task);

              // Subscribe to the trigger <stream> and wait for the
              // arrival of values saying whether to start or stop task
              // activities and respond by sending appropriate control
              // messages to the child process.
            a.push(triggerStream.skipDuplicates().onValue((state: number) => {
              switch (state) {
                case 1:
                  activeTaskNames.push(task.name || '');           
                  pluginStatus.setStatus(`Starting task '${task.name}'`);             
                  if (childProcess != null) childProcess.send({ "action": "START", "activities": task.activities });
                  break;
                case 0:
                  activeTaskNames = activeTaskNames.filter((e) => (e !== task.name));
                  pluginStatus.setStatus(`Stopping task '${task.name}'`);             
                  if (childProcess != null) childProcess.send({ "action": "STOP" });
                  break;
                default:
                  pluginStatus.setStatus(`Ignoring invalid start task request '${state}'on task '${task.name}'`);
                  break
              }
            }));
            return(a);
          }, []);
        } else {
          pluginStatus.setDefaultStatus('Stopped: configuration includes no valid tasks');
        }
      } catch(e: any) {
        pluginStatus.setDefaultStatus('Stopped: bad or missing plugin configuration');
        app.setPluginError(`${e.message}`);
      }
    },

	  stop: function() {
		  unsubscribes.forEach(f => f());
		  unsubscribes = [];
	  }
  }

  function makePluginConfiguration(options: any): PluginConfiguration {
    var matches: RegExpMatchArray | null;
    var pluginConfiguration:PluginConfiguration = <PluginConfiguration>{};

    pluginConfiguration.tasks = (options.tasks || []).reduce((a: Task[], taskOptions: any) => {
      if (!taskOptions.name) throw new Error("missing 'name' property");
      if (!taskOptions.controlPath) throw new Error("missing 'controlPath' property");
      var task: Task = {
        name: taskOptions.name,
        controlPath: taskOptions.controlPath,
        controlPathObject: <ControlPathObject>{},
        activities: []
      }
      if ((matches = taskOptions.controlPath.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
        task.controlPathObject.type = 'notification';
        task.controlPathObject.path = `notifications.${matches[1]}`;
        task.controlPathObject.onValue = matches[2];
      } else if ((matches = task.controlPath.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
        task.controlPathObject.type = 'notification';
        task.controlPathObject.path = `notifications.${matches[1]}`;
        task.controlPathObject.onValue = undefined;
      } else if (matches = task.controlPath.match(/^(.*):(.*)$/)) {
        task.controlPathObject.type = 'switch';
        task.controlPathObject.path = matches[1];
        task.controlPathObject.onValue = matches[2];
      } else if (matches = task.controlPath.match(/^(.*)$/)) {
        task.controlPathObject.type = 'switch';
        task.controlPathObject.path = matches[1];
        task.controlPathObject.onValue = 1;
      } else throw new Error ("invalid 'controlPath' property");

      if ((!taskOptions.activities) || (!Array.isArray(taskOptions.activities)) || (taskOptions.activities.length == 0)) throw new Error("missing 'activities' array property");
      var activityindex = 0
      task.activities = taskOptions.activities.reduce((a: Activity[], activityOptions: any) => {
        if (!activityOptions.path) throw new Error("missing activity 'path' property");
        if (!activityOptions.duration) throw new Error("missing 'duration' property");
        var activity: Activity = {
          name: `${task.name}[` + `${(activityOptions.name !== undefined)?activityOptions.name:ACTIVITY_NAME_DEFAULT}-${activityindex++}` + ']',
          delay: (activityOptions.delay !== undefined)?activityOptions.delay:ACTIVITY_DELAY_DEFAULT,
          repeat: (activityOptions.repeat !== undefined)?activityOptions.repeat:ACTIVITY_REPEAT_DEFAULT,
          duration: activityOptions.duration
        }
        if ((matches = activityOptions.path.match(/^(notifications\..*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
          activity.path = matches[1];
          activity.onValue = matches[2];
          activity.offValue = matches[3];
        } else if ((matches = activityOptions.path.match(/^(notifications\..*)\:(.*)$/)) && (matches.length == 3)) {
          activity.path = matches[1];
          activity.onValue = matches[2];
          activity.offValue = undefined;
        } else if ((matches = activityOptions.path.match(/^(notifications\..*)$/)) && (matches.length == 2)) {
          activity.path = matches[1];
          activity.onValue = 'normal';
          activity.offValue = undefined;
        } else if ((matches = activityOptions.path.match(/^(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
          activity.path = matches[1];
          activity.onValue = matches[2];
          activity.offValue = matches[3];
        } else if ((matches = activityOptions.path.match(/^(.*)$/)) && (matches.length == 2)) {
          activity.path = matches[1];
          activity.onValue = 1;
          activity.offValue = 0;
        } else throw new Error("invalid activity control 'path' property");
        a.push(activity);
        return(a);
      }, []);
      a.push(task);
      return(a);
    }, []);
    return(pluginConfiguration);
  }

  function createTriggerStream(controlPathObject: ControlPathObject): EventStream<number> {
    var stream: EventStream<string | number | undefined> = app.streambundle.getSelfStream(controlPathObject.path);
    switch (controlPathObject.type) {
      case 'notification':
        if (controlPathObject.onValue === undefined) {
          return(stream.map((from: any) => (from !== null)?1:0));
        } else {
          return(stream.map((from: any) => ((from.state == controlPathObject.onValue)?1:0)));
        }
        break;
      default:
        return(stream.map((from: any) => ((from.state == controlPathObject.onValue)?1:0)));
        break;
    }
  }

  function createChildProcessForTask(child: string, task: Task): ChildProcess | null {
    // Create a child process for executing the task's activities.
    var childProcess: ChildProcess | null = fork(`${__dirname}/${child}`);
    app.debug(`creating child process for task '${task.name}'`);
    
    // The child sends a message saying whether an activity
    // should turn its output on or off, so we manage that here
    // for both switch and notification outputs.
    childProcess.on('message', (message: any) => {
      var delta = new Delta(app, plugin.id);
      switch (message.action) {
        case 1:
          if (!message.activity.path.startsWith('notifications.')) {
            app.debug(`Starting activity '${message.activity.name}' (setting '${message.activity.path}' to '${message.activity.onValue}')`)
            app.putSelfPath(message.activity.path, message.activity.onValue, (d: any) => app.debug(`put response: ${JSON.stringify(d)}`))
          } else {
            app.debug(`Starting activity '${message.activity.name}' (issuing '${message.activity.onValue}' notification on '${message.activity.path}')`)
            delta.addValue(
              message.activity.path, 
              { state: message.activity.onValue, method: [], message: 'Scheduler ON event' },
            ).commit().clear()
          }
          break;
        case 0:
          if (!message.activity.path.startsWith('notifications.')) {
            app.debug(`Stopping activity '${message.activity.name}' (setting '${message.activity.path}' to '${message.activity.onValue}')`)
            app.putSelfPath(message.activity.path, message.activity.offValue, (d: any) => app.debug(`put response: ${JSON.stringify(d)}`));
          } else {
            if (message.activity.offState) {
              app.debug(`Stopping activity '${message.activity.name}' (issuing '${message.activity.onValue}' notification on '${message.activity.path}')`)
              delta.addValue(message.activity.path, { state: message.activity.offValue, method: [], message: 'Scheduler OFF event' }).commit().clear()
            } else {
              app.debug(`Stopping activity '${message.activity.name}' (cancelling notification on '${message.activity.path}')`)
              delta.addValue(message.activity.path, null).commit().clear()
            }
          }
          break
        default:
          app.debug(`Ignoring activity '${message.activity.name}' (bad action ${message.activity.action})`)
          break;
      }
    })
    
    childProcess.on('exit', () => {
      app.setPluginStatus(`Stopping scheduling of: ${task.name}`);
      childProcess = null;
    });

    return(childProcess);
    
  }

	return(plugin);
}

interface SKPlugin {
  id: string,
  name: string,
  description: string,
  schema: object,
  uiSchema: object,

  start: (options: any) => void,
  stop: () => void
}

interface PluginConfiguration {
  tasks: Task[]
}

interface ControlPathObject {
  type?: string,
  path?: string,
  onValue?: string | number | undefined
}

interface Activity {
  name?: string,
  delay?: number,
  repeat?: number,
  type?: string,
  path?: string,
  onValue?: string | number,
  offValue?: string | number | undefined,
  duration?: number
}

interface Task {
  name: string,
  controlPath: string,
  controlPathObject: ControlPathObject
  activities: Activity[]
}