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

const Bacon = require('baconjs')
const child_process = require("child_process");

const Log = require('./lib/signalk-liblog/Log.js');
const Notification = require('./lib/signalk-libnotification/Notification.js');

const PLUGIN_ID = "process-scheduler";
const PLUGIN_NAME = "pdjr-skplugin-process-scheduler";
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
		      "enablingpaths": {
            "title": "Notification paths which enable the schedule task",
            "type": "array",
            "default": [ { "path": "", "options": [ "enabled" ] } ],
            "items": {
              "type": "object",
              "properties": {
                "path": {
			            "type": "string",
			            "title": "path"
                },
                "options": {
                  "title": "",
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [ "enabled" ]
                  },
                  "uniqueItems": true
                }
              }
            }
		      },
          "activities" : {
            "title": "Activities making up the schedule task",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "title": "Activity name",
                  "type": "string"
                },
                "path": {
                  "title": "Process control notification path",
                  "type": "string"
                },
                "delay": {
                  "title": "delay (s)",
                  "type": "number"
                },
                "duration": {
                  "title": "duration (s)",
                  "type": "number"
                },
                "iterate": {
                  "title": "iterate (n)",
                  "type": "number",
                  "minimum": 1
                }
              }
            }
          }
        }
      }
    }
  }
};
const PLUGIN_UISCHEMA = {};

const OPTIONS_DEFAULT = {
  "tasks": []
};

module.exports = function(app) {
	var plugin = {};
	var unsubscribes = [];

	plugin.id = PLUGIN_ID;
	plugin.name = PLUGIN_NAME;
	plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });
  const notification = new Notification(app, plugin.id);
  const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

  // Filter out rules which are disabled and map monitored path values into
  // a stream of comparator values where -1 = below low threshold, 1 = above
  // high threshold and 0 = between threshold.  Eliminate duplicate values
  // in this new stream and issue a notification based upon the resulting
  // comparator.  
  //  
	plugin.start = function(options) {
    
    if (Object.keys(options).length === 0) {
      options = OPTIONS_DEFAULT;
      savePluginOptions(options, () => { log.N("saving default configuration"); });    
    }

    if ((options.tasks) && (Array.isArray(options.tasks))) {
      options.tasks = options.tasks.filter(p => (p.enablingpaths.filter(ep => ep.options.includes("enabled")).length > 0));
      if (options.tasks.length > 0) {
        if (options.tasks.length == 1) {
          log.N("scheduling task '%s'", options.tasks[0].name);
        } else {
          log.N("scheduling multiple tasks (see log for details)");
        }
        
        options.tasks.reduce((a, {
          name,
          enablingpaths,
          activities
        }) => {
          var stream = Bacon.combineWith(orAll, enablingpaths.filter(v => v.options.includes("enabled")).map(v => app.streambundle.getSelfStream(v.path).skipDuplicates()));
          var child = child_process.fork(__dirname + "/task.js");

          child.on('message', (message) => {
            if (message.action == 1) {
              if (message.path != null) {
                log.N(name + ": " + message.name + ": issuing notification: " + message.path);
                notification.issue(message.path, "Scheduled ON event", { state: "alert" });
              }
            } else {
              if (message.path != null) {
                log.N(name + ": " + message.name + ": cancelling notification: " + message.path);
                notification.cancel(message.path);
              }
            }
          });

          child.on('exit', () => {
            log.N("stopping scheduling of: " + name);
            child = null;
          });

          a.push(stream.onValue(state => {
            switch (state) {
              case 1:
                log.N("starting scheduling of " + name);
                if (child != null) {
                  child.send({
                    "action": "START",
                    "activities": activities 
                  });
                }
                break;
              case 0:
                log.N("stopping scheduling of " + name);
                if (child != null) {
                  child.send({ "action": "STOP" });
                }
                break;
            }
          }));
          return(a);
        }, []);
      }
	  }
  }

	plugin.stop = function() {
		unsubscribes.forEach(f => f())
		unsubscribes = []
	}

    /**
     * Returns the logical OR of an arbitrary number of Signal K notification
     * values where the value of the state field is interpreted as TRUE if
     * equal to "alert", otherwise FALSE.
     * returns: TRUE or FALSE
     */
    function orAll() {
        var retval = false;
        for (var i = 0; i < arguments.length; i++) { retval |= ((arguments[i].state == "alert") || (arguments[i] === 1)) };
        return(retval);
    }

	return(plugin);
}
