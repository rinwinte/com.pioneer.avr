# Pioneer AVR Control for Athom Homey

Control your Pioneer AV-Receiver with your Homey.

This app connects via Telnet to the Pioneer AVR and monitors the netwerk status using SSDP. Therefore, it is not required to set a static IP address. However, in order to use the ON button and for better performance it is required to enable Network Standby, see details below.

This app uses the default port of the device which in most cases is 8102. Homey claims this port as long as the device is powered and releases it only on power down. Keep this in mind when trying to use Telnet from another source such as a computer or the official Pioneer app.

## Features
Action Flow Cards:
* Turn your Pioneer AVR on and off
* Increase or decrease volume with steps of 0.5dB
* Set volume to a fixed dB value
* Mute/Unmute or toggle mute

Conditoin Flow Cards:
* Is the Pioneer AVR powered on?
* Is the Pioneer AVR muted?

## Supported Devices
Most Pioneer models that can be controlled grough Telnet should work.
## Confirmed
* VSX-921
* VSX-926
* VSX-1021
* VSX-1026

Please let me know if your Pioneer model is supported.

## Configuring Network Standby
The Network Standby option is required to control the Pioneer receiver even when it is off. In order to turn the device on again this setting has to be ON. Furthermore, it ensures a stable connection with the device.

* Press "receiver" and subsequently the "HOME MENU" button on the Pioneer remote.
* Select option 4. "System Settings" and press "Enter".
* Select d."Network Settings" and press "Enter".
* Select 2. "Network Standby" and press "Enter".
* Change "Network Standby" to ON.

## Configuring Pioneer Friendly Name
The receiver by default has the name VSX-xxx when finding it on the network. This name can be changed following the steps below. When adding the device to the Homey Pioneer app, it will automatically take over this name. 

* Press "receiver" and subsequently the "HOME MENU" button on the Pioneer remote.
* Select option 4. "System Settings" and press "Enter".
* Select d."Network Settings" and press "Enter".
* Select 3. "Friendly Name" and press "Enter".
* Change "Change name" and press "Enter".

## Future updates
These features ar in the planning:
* Source control and Action cards
* Setting option to select which sources the Pioneer supports and the Homey app will display in the remote.
* Channel friendly name support
* Power consumption prediction

If there is demand for it, these option might be added as well:
* Zone2 control; channel select and volume.
* Listening mode selection; Movie, action, drama rock.pop etc.
* Cursor remote
* Tone control; Bass & Trebble
* Display brightness
* Sleep 30-90 min
* Remote and/or panel lock (disables remote/panel)
* Radio Tuner control
* Home Media Gallery Operation(Internet Radio) (Play, Pause, Next etc)
* Adapter port operation (Play, Pause, Next etc)

## Version 0.0.1
* Initial commit
