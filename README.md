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
The output of both activities is used to signal when the shaft
lubrication pump should run.

Controlling execution of the lubrication task can be accomplished in
many ways: I choose to sense the state of the engine ignition switch
which on my ship is echoed by the value on
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
        '*'.
        The task will operate when the specified key has the value 1.
      </li>
      <li>
        'notifications.*'.
        The task will operate when a notification is present on the
        specified key.
      </li>
      <li>
        'notifications.\*:*state*'.
        The task will operate when a notification with a state value of
        *state* is present on the specified key.
      </li>
    </ul>
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
      The specified path must be in either the 'electrical.switches.'
      or 'notifications.' trees and four forms are possible.
      <ul>
        <li>
        'electrical.switches.*'.
        The start event will update the key with the value 1; the stop
        event will update the key with the value 0.
        </li>
        <li>
        'notifications.*'.
        The start event will update the key with a notification with
        state 'normal'; the stop event will remove the notification on
        key.
        </li>
        <li>
        'notifications.*:onstate'.
        The start event will update the key with a notification with
        state '*onstate*'; the stop event will remove the notification on
        key.
        </li>
        <li>
        'notifications.*:onstate:offstate'.
        The start event will update the key with a notification with
        state '*onstate*'; the stop event will update the key with a
        notification with state 'offstate'.
        </li>
      </ul>
      </dd>
      <dt>Activity duration in seconds (*duration*)</dt>
      <dd>
      Number seconds between activity start and stop events.
      </dd>
      <dt>Delay start by this many seconds (*delay*)</dt>
      <dd>
      Number of seconds between the activity being started and the
      issuing of a start event.
      </dd>
      <dt>How many times to repeat (*iterate*)</dt>
      <dd>
      Number of times to repeat the activity (0 says forever).
      </dd>
    </dl>
  </dl>
</dl>
# Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>