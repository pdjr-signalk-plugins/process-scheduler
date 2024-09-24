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

import { ChildProcess, fork } from 'node:child_process'
import { Delta } from 'signalk-libdelta'

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

const ACTIVITY_NAME_DEFAULT: string = 'activity'
const ACTIVITY_DELAY_DEFAULT: number = 0
const ACTIVITY_REPEAT_DEFAULT: number = 1

module.exports = function(app: any) {
	let unsubscribes: (() => void)[] = []

  const plugin: SKPlugin = {
	  id: PLUGIN_ID,
	  name: PLUGIN_NAME,
	  description: PLUGIN_DESCRIPTION,
    schema: PLUGIN_SCHEMA,
    uiSchema: PLUGIN_UISCHEMA,
  
	  start: function(options: any) {
      let delta = new Delta(app, plugin.id);
      let matches: RegExpMatchArray | null

      options.tasks = (options.tasks || []).reduce((a: any, task: any) => {
        let validTask: Task = {};
        try {
          if (task.name) validTask.name = task.name; else throw new Error("missing 'name' property");
          if (task.controlPath) validTask.controlPath = task.controlPath; else throw new Error("missing 'controlPath' property");
          validTask.controlPathObject = {};
          if ((matches = task.controlPath.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
            validTask.controlPathObject.type = 'notification';
            validTask.controlPathObject.path = `notifications.${matches[1]}`;
            validTask.controlPathObject.onValue = matches[2];
          } else if ((matches = task.controlPath.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
            validTask.controlPathObject.type = 'notification';
            validTask.controlPathObject.path = `notifications.${matches[1]}`;
            validTask.controlPathObject.onValue = undefined;
          } else if (matches = task.controlPath.match(/^(.*):(.*)$/)) {
            validTask.controlPathObject.type = 'switch';
            validTask.controlPathObject.path = matches[1];
            validTask.controlPathObject.onValue = matches[2];
          } else if (matches = task.controlPath.match(/^(.*)$/)) {
            validTask.controlPathObject.type = 'switch';
            validTask.controlPathObject.path = matches[1];
            validTask.controlPathObject.onValue = 1;
          } else throw new Error ("invalid 'controlPath' property");

          if ((!task.activities) || (!Array.isArray(task.activities)) || (task.activities.length == 0)) throw new Error("missing 'activities' array property");
          var activityindex = 0
          validTask.activities = task.activities.reduce((a: any, activity: any) => {
            let validActivity: Activity = {}
            validActivity.name = `${(activity.name)?activity.name:ACTIVITY_NAME_DEFAULT}-${activityindex++}`,
            validActivity.delay = (activity.delay)?activity.delay:ACTIVITY_DELAY_DEFAULT;
            validActivity.repeat = (activity.repeat)?activity.repeat:ACTIVITY_REPEAT_DEFAULT;
            if (!activity.path) throw new Error("missing activity 'path' property");
            if ((matches = activity.path.match(/^electrical\.switches\.(.*)$/)) && (matches.length == 2)) {
              validActivity.type = 'switch';
              validActivity.path = activity.path;
              validActivity.onValue = 1;
              validActivity.offValue = 0;
            } else if ((matches = activity.path.match(/^notifications\.(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
              validActivity.type = 'notification';
              validActivity.path = `notifications.${matches[1]}`;
              validActivity.onState = matches[2];
              validActivity.offState = matches[3];
            } else if ((matches = activity.path.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
              validActivity.type = 'notification';
              validActivity.path = `notifications.${matches[1]}`;
              validActivity.onState = matches[2];
              validActivity.offState = 'normal';
            } else if ((matches = activity.path.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
              validActivity.type = 'notification';
              validActivity.path = `notifications.${matches[1]}`;
              validActivity.onState = 'normal';
              validActivity.offState = undefined;
            } else throw new Error("invalid activity control 'path' property");
            if (!activity.duration) throw new Error("missing 'duration' property");
            validActivity.duration = activity.duration;
            a.push(validActivity);
            return(a);
          }, []);
          a.push(validTask);
        } catch(e: any) { app.debug(`dropping task with invalid configuration (${e.message})`); }
        return(a);
      }, [])

      app.debug(`using configuration: ${JSON.stringify(options, null, 2)}`);

      // We reach this point with a validated list of tasks...
      if (options.tasks.length > 0) {
        if (options.tasks.length == 1) {
          app.setPluginStatus(`Started: scheduling task '${options.tasks[0].name}'`);
        } else {
          app.setPluginStatus("Started: scheduling multiple tasks (see log for details)");
        }
        
        // Subscribe to each tasks trigger stream, implement a child
        // process for each task and handles state changes on the
        // trigger.
        unsubscribes = options.tasks.reduce((a: (() => void)[], task: Task) => {

          // Get a trigger stream for the task controlpath that deals
          // with switch and notification triggers.
          if (task.controlPathObject) {
             
            var stream = app.streambundle.getSelfStream(task.controlPathObject.path);
            switch (task.controlPathObject.type) {
              case 'switch':
                stream = stream.map((s: any, v: any) => ((v == s)?1:0), task.controlPathObject.onValue);
                break;
              case 'notification':
                if (task.controlPathObject.onValue === undefined) {
                  stream = stream.map((v: any) => (v !== null)?1:0);
                } else {
                  stream = stream.map((s: any, v: any) => ((v.state == s)?1:0), task.controlPathObject.onValue);
                }
                break;
            }

            // Create a child process for executing the task's
            // activities.
            var child: ChildProcess | null = fork(`${__dirname}/task.js`);
            app.debug(`created child process ${child}`);

            // The child sends a message saying whether an activity
            // should turn its output on or off, so we manage that her
            // for both switch and notification outputs.
            child.on('message', (message: any) => {
              app.debug(`received message from child ${JSON.stringify(message)}`)
              switch (message.action) {
                case 1:
                  switch (message.activity.type) {
                    case 'switch':
                      app.putSelfPath(message.activity.path, 1, (d: any) => app.debug(`put response: ${JSON.stringify(d)}`))
                      break;
                    case 'notification':
                      delta.addValue(
                        message.activity.path, 
                        { state: message.activity.onstate, method: [], message: 'Scheduler ON event' },
                      ).commit().clear()
                      break;
                    default:
                      break;
                  }
                  break;
                case 0:
                  switch (message.activity.type) {
                    case 'switch':
                      app.putSelfPath(message.activity.path, 0, (d: any) => app.debug(`put response: ${JSON.stringify(d)}`));
                      break;
                    case 'notification':
                      if (message.activity.offState) {
                        delta.addValue(
                          message.activity.path, 
                          { state: message.activity.offstate, method: [], message: 'Scheduler OFF event' }
                        ).commit().clear()
                      } else {
                        delta.addValue(message.activity.path, null).commit().clear()
                      }
                      break
                  }
                  break
              }
            })

            child.on('exit', () => {
              app.setPluginStatus(`stopping scheduling of: ${task.name}`);
              child = null;
            });

            // Subscribe to the trigger <stream> and wait for the
            // arrival of values saying whether to start or stop task
            // activities and respond by sending appropriate control
            // messages to the child process.
            a.push(stream.skipDuplicates().onValue((state: number) => {
              app.debug(`received trigger ${state} for task '${task.name}'`);
              switch (state) {
                case 1:
                  app.setPluginStatus(`starting task '${task.name}'`);                
                  if (child != null) child.send({ "action": "START", "activities": task.activities });
                  break;
                case 0:
                  app.setPluginStatus(`stopping task '${task.name}'`);
                  if (child != null) child.send({ "action": "STOP" });
                  break;
              }
            }));

            return(a);
          }
        }, []);
      } else {
        app.setPluginStatus("Stopped: configuration includes no valid tasks");
      }
    },

	  stop: function() {
		  unsubscribes.forEach(f => f())
		  unsubscribes = []
	  }
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
  onValue?: number,
  offValue?: number,
  onState?: string,
  offState?: string,
  duration?: number
}

interface Task {
  name?: string,
  controlPath?: string,
  controlPathObject?: ControlPathObject
  activities?: Activity[]
}