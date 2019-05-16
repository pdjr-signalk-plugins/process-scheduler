# signalk-process-scheduler

[Signal K Node Server](https://github.com/SignalK/signalk-server-node) plugin
which implements a simple process scheduler using the host notification system
as a control medium.

An arbitrary number of processes can be scheduled with each process modelled
as a three-phase life cycle consisting of a start phase followed by an iterative
phase and terminating with an end phase.  Any (or all) phases can be omitted
from scheduler control.

![alt text](readme/processcontrol.png)

Each phase is characterised by a user-defined delay and duration.  The delay is
a period of quiescence before the controlled process is started, whilst duration
is the process execution time within the containing phase.

Scheduled control of a particular process is initiated and terminated by the
appearance of one or more user-defined notifications on the Signal K server bus and
the scheduler emits user-defined notifications to signal operation of each
process.

Signalk-process-scheduler was developed to control a stern gland lubrication
pump and this activity is configured in the following way:

1. Signal K's "engine start" data value is processed by signalk-threshold-notifier
into an "alert" notification signalling the process scheduler to start scheduling
the lubrication process.

2. The lubrication process is configured to consist of a start phase (delay = 0s,
duration = 300s) and an iterative phase (delay = 1800s, duration = 120s).  This
means that on engine start the lubrication pump will immediately run for five
minutes and will then run for two minutes every thirty minutes.

3. signalk-switchbank is used to translate the "run process" notifications issued
by the scheduler into NMEA 2000 PGN127502 messages which operate a relay controlling
the lube pump power supply.
## System requirements

__signalk-threshold-notifier__ has no special system requirements.
## Installation

Download and install __signalk-threshold-notifier__ using the _Appstore_ link
in your Signal K Node server console.

The plugin can also be downloaded from the
[project homepage](https://github.com/preeve9534/signalk-threshold-notifier)
and installed using
[these instructions](https://github.com/SignalK/signalk-server-node/blob/master/SERVERPLUGINS.md).
## Usage

 __signalk-threshold-notifier__ is configured through the Signal K Node server
plugin configuration interface.
Navigate to _Server_->_Plugin config_ and select the _Threshold notifier_ tab.

![Configuration panel](readme/config.png)

The plugin configuration consists of a list of rules, each of which specifies
a Signal K path which should be monitored, upper and lower limits against
which notifications should be raised and the attributes of such notifications.
On first use the list of monitored paths will be empty.

New rules can be added by clicking the __[+]__ button and any existing,
unwanted, rules can be deleted by clicking their adjacent __[x]__ button.

Each rule includes the following fields.

__Monitored path__  
A required text value which specifies the Signal K Node server path which
should be monitored.
There is no default value.

Enter here the full Signal K path for the value which you would like to
monitor, for example, "tanks.wasteWater.0.currentValue".

__Options->Enabled?__  
Whether or not to process this rule.
Default value is yes (checked).

__Notification message__  
An optional text message which will be assigned to the message property of
all notifications generated by the rule.
The default value is a simple, automatically generated, message.

Enter here the text of the message you would like to be issued when the
monitored path value crosses one of the defined thresholds.
If the option is left blank then the plugin will insert just the monitored
path text as an identifier when it raises a notification.

Any of the following tokens may be used in the supplied message text and these
will be interpolated with the described value when the notification message is
composed.

_${path}_ will be replaced by the value of the _Monitored path_ option.

_${test}_ will be replaced by one of "above", "below" or "between" dependant
upon the threshold being crossed and the direction of crossing.

_${threshold}_ will be replaced with the value of the threshold triggering the
rule or, in the case of the path value being between thresholds with the
string "_n_ and _m_" where _n_ is the low threshold and _m_ is the high
threshold.

_${value}_ will be replaced with the instantaneous value of the monitored path
that triggered the rule.

_${vessel}_ will be replaced with Signal K's idea of the vessel name.

An example message text might be "${vessel}: ${path} is ${test} ${threshold} (currently ${value})".

__Path prefix__  
A notification path component which will be inserted after the "notifications."
root and before the value of _Monitored path_.
This allows semantic classification of notifications and supports overlapping
notifications on the same monitored path.
Default is "none" which places notifications directly under the "notifications."
root. 

__Low threshold__  
An optional numerical value which sets the lower threshold against which the
monitored path value will be compared.
The default value is a blank entry which disables monitoring of the low
threshold.

If a value is specified and the monitored path value falls below this limit
then a notification of the type defined by _Alarm state_ will be issued.

__Alarm state__  
A required value which will be assigned to the notification _state_ property
which is used to signal the severity of the notification.
Default is to set the alarm state to "alert".

Choose a value appropriate to the notification event.
Remember that notifications in Signal K may be processed by downstream handlers
and the chosen state could have significance elsewhere: an example is the
__signalk-switchbank__ plugin which treats "normal" and non-"normal" alarm
states as part of a switching signal.

__Suggested method__  
An optional value which will be assigned to the notification _method_ property
which is used to suggest to downstream notification handlers a preference for
how a notification may be handled.
Default is to express no preference.

Choose any values which you think appropriate, or none at all.
Once again, some downstream notification handlers may require a particular
value or combination of values in order to perform their function.

The cluster of options associated with defining a high threshold have similar
semantics to those described above: the __High threshold__ option itself,
naturally, defines an upper threshold against which the monitored path value
will be tested for a low-to-high transition.
## Use cases

__Managing *Beatrice*'s waste tank__

Once upon a time the black water tank on _Beatrice_ overflowed: I had failed
to take note of the tank gauge and had no audible alarm.
I now use Signal K to implement an escalating response to waste tank filling
which might ensure that there is never a repeat of this catastrophe.

My first line of defense is to raise a notification which is picked up by my
helm annunciator and also detected by __signalk-renotifier__ which forwards
the notification to my cell phone via SMS.
```
{
    "path": "tanks.wasteWater.0.currentLevel",
    "message": "${vessel}: waste water level is ${test} ${threshold}",
    "highthreshold": {
        "value": 0.8,
        "state": "warning",
        "method": [ "visual" ]
    }
    "options": [ "enabled" ],
    "prefix": "none"
}
```

Notwithstanding this precaution, I have an end-stop strategy which should make
sure that there is never again a problem: this environmentally unfriendly
last-ditch solution automatically starts my discharge pump if the waste tank
level becomes critical.

I use the __signalk-switchbank__ plugin to operate the pump and this requires
a notification to start the pump and a subsequent notification to stop it.
The configuration file snippet for the rule I use looks like this:
```
{
    "path": "tanks.wasteWater.0.currentLevel",
    "message": "${vessel}: waste water automatic discharge: level is ${test} ${threshold} (${value})",
    "highthreshold": {
        "value": 0.9,
        "state": "alert",
        "method": [ ]
    },
    "lowthreshold": {
        "value": 0.01,
        "state": "normal",
        "method": [ ]
    },
    "options": [ "enabled" ],
    "prefix": "control."
}
```
The notification which starts the pump must have a state which is not equal to
"normal" (in this case it is "alert") and the notification which stops the
pump must have a state equal to "normal".

## Messages

__signalk-threshold-notifier__ issues the following message to the Signal K
Node server console and system logging facility.

__Monitoring *n* path__[__s__]  
The plugin has initialised and is monitoring *n* Signal K paths.

Additionally, the following messages are issued just to the system logging
facility.

__cancelling notification on '*path*'__  
The monitored value has returned between the low and high thresholds and the
notification on _path_ is being removed. 

__issuing '*state*' notification on '*path*'__  
The monitored value has passed a threshold and a notification of type *state*
has been issued on *path*.
