# pdjr-skplugin-process-scheduler

## Description

**pdjr-skplugin-process-scheduler** implements a simple process
scheduler which manages the operation of an arbitrary number of user
defined *task*s.
Functionally, a task is made up of a collection of sequentially
executed activities each of which updates the Signal K state by
modulating keys in the 'electrical.switches.' or 'notifications.'
hierarchies.

Each *task* is triggered and will continue to operate whilst some
specified value is maintained on a Signal K key configured as its
*control path*.
Control paths are required to be members of either the 'notifications.'
or 'electrical.switches.' hierarchies. 

## Example application

Imagine a ship with an electrical lubrication pump that delivers grease
directly to the propeller shaft bearing.
We want to ensure that the bearing is well greased at the beginning of every
voyage and lightly greased periodically during the voyage.

This requirement can be met by a "lubrication" task consisting of two
activities: a 'start' activity which runs once when the main engine is
fired up and a subsequent 'iterate' activity which runs repeatedly for
as long as the engine is running.
The output of both activities is used to signal when the shaft lubrication
pump should run.

Controlling execution of the lubrication task can be accomplished in
many ways: I choose to sense the state of the engine ignition switch.

On my ship the ignition switch state is echoed by the value on
'electrical.switches.bank.0.11.state'.

My stern gland lubrication pump is operated by a relay on
'electrical.switches.bank.26.5.state'.

The plugin configuration I use for handling the shaft librication task
looks like this.

```
"configuration": {
  "tasks": [
    {
      "name": "shaft lubrication",
      "controlpath": "electrical.switches.bank.0.11.state",
      "activities": [
        {
          "name": "start",
          "path": "electrical.switches.bank.26.5.state",
          "delay": 0,
          "duration": 60,
          "iterate": 1
        },
        {
          "name": "iterate",
          "path": "electrical.switches.bank.26.5.state",
          "delay": 1800,
          "duration": 10,
          "iterate": 0
        }
      ]
    }
  ]
}
```

## Configuration

<dl>
  <dt>Scheduler tasks (*tasks*)</dt>
  <dd>
  Collection of *task* definitions.
  Each item in the *tasks* array has the following configuration
  properties.
  <dl>
    <dt>Task name (*name*)</dt>
    <dd>
    Required string naming the task being configured.
    </dd>
    <dt>Control path (*controlPath*)</dt>
    <dd>
    Required string supplying a Signal K key and optional value
    which will be used to trigger the task.
    The plugin understands three control path formats.
    <ul>
      <li>
        '
    <p>
    A control path of the form '*path*:*value*' says that the task should
    only be triggered when the Signal K value on *path* is equal to
    *value*.
    For example: 'electrical.switches.bank.0.12.state:1' will operate the
    task when switch channel 12 on switch bank 0 is ON.
    </p>
    <p>
    A control path of the form '*path*' says that the task should be
    triggered whenever *path* is present (or not null).
    This form is useful with key values in the Signal K notifications
    tree.
    For example: 'notifications.mytasktrigger'.
    </dd>
    <dt>Activities (*activities*)</dt>
    <dd>
    Collection of *activity* definitions.
    Each item in the *activities* array has the following configuration
    properties.
    <dl>
      <dt>Activity name (*name*)</dt>
      <dd>
      Required string supplying a name for this activity which will be
      used in messaging and logging.
      </dd>
      <dt>Process control path (*path*)</dt>
      <dd>
      Required string specifying the Signal K key which should be
      updated when start and stop events occur.
      The path specified here will typically be in either the
      'electrical.switches.' or 'notifications.' trees and three forms
      are possible.
      <ul>
        <li>
        Path only. Eg: 'electrical.switches.bank.3.5.state'.
        The start event will update the key with the value 1; the stop
        event will update the key with the value 0.
        </li>
        <li>
        Path with 'on' value. Eg: 'notifications.mycontrol:on'
      </dd>
      <dt>Activity duration in seconds (**)</dt>
      <dd>
      Number seconds between activity start and stop events.
      </dd>
      <dt>Delay start by this many seconds (**)</dt>
      <dd>
      Number of seconds between activity start and issuing of a start
      update on the process control path.
      </dd>
      <dt>How many times to repeat (**)</dt>
      <dd>
      Number of times to repeat the activity (0 says forever).
      </dd>
    </dl>
  </dl>
</dl>


Each object in the *activities* array has the following properties.

| Property name | Value type | Value default | Description |
| :------------ | :--------- | :------------ | :---------- |
| path          | String     | (none)        | Signal K key to be updated when start and stop events occur. |
| duration      | Number     | (none)        | Number seconds between activity start and stop events. |
| name          | String     | ''            | Name of the activity (used in messaging and logging). |
| delay         | Number     | 0             | Number of seconds before start event. |
| repeat        | Number     | 1             | Number of times to repeat the activity (0 says forever). |

*path* can specify either a switch key or a notification key.
A switch key will be set to 1 by the on event and to 0 by the off
event.
A simple notification key will result in a notification with state
'normal' being issued by the on event and the notification being
cancelled by the off event.
A key of the form '*notification_path*__:__*state*' causes similar
behaviour, but the notification issued by the on event will have the
specified *state*.
A key of the form '*notification_path*__:__*onstate*__:__*offstate*'
will result in a persistent notification whose state is set to the
specified values by the on and off events.

# Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>