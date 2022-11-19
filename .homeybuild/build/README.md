# Pioneer AVR Control for Athom Homey

Control your Pioneer AV-Receiver with your Homey.

This app connects via Telnet to the Pioneer AVR and monitors the netwerk status using SSDP. Therefore, it is not required to set a static IP address. However, in order to use the ON button and for better performance it is required to enable Network Standby, see details below.

This app uses the default port of the device which in most cases is 8102. Homey claims this port as long as the device is powered and releases it only on power down. Keep this in mind when trying to use Telnet from another source such as a computer or the official Pioneer app.

Some devices require the port settings to change. In the case the device is not found automatically try to change the port settings in the Pioneer menu:
Port 1 ON, 23
Port 2 OFF
Port 3 OFF
Port 4 OFF

## Features
Trigger Flow Cards:
* Volume Changed
* Device turned on
* Device turned off
* Device started playing (In internet/H.M.G. source only)
* Device stopped playing (In internet/H.M.G. source only)
* Album changed (In internet/H.M.G. source only)
* Track changed (In internet/H.M.G. source only)
* Artist changed (In internet/H.M.G. source only)
* Input source changed

Condition Flow Cards:
* Device is on
* Device is playing (In internet/H.M.G. source only)
* Input source is ...

Action Flow Cards:
* Set volume to
* Set relative volume to
* Put device on
* Put device off
* Set device on/off
* Decrease the volume by one step
* Mute the device
* Unmute the device
* Increase the volume by one step
* Previous track (In internet/H.M.G. source only)
* Next track (In internet/H.M.G. source only)
* Play track (In internet/H.M.G. source only)
* Pause track (In internet/H.M.G. source only)
* Toggle play/pause (In internet/H.M.G. source only)
* Browse to Internet/H.M.G item (In internet/H.M.G. source only)
* Set tuner preset (In tuner source only)
* Set tuner frequency (In tuner source only)
* Set screen brightness
* Set listening mode
* Set input source
* Send custom command

## Supported Devices
Most Pioneer models that can be controlled grough Telnet should work.
## Confirmed
* VSX-921
* VSX-926
* VSX-1021
* VSX-1026

## Not supported
*


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

## Configuring Static IP (only required when manually adding device)
A static IP is required to prevent the Pioneer receiver from getting a new IP address resulting in the app not finding the device anymore. This can be done in your router or by disabling DHCP inside your pioneer setting menu.

* Press "receiver" and subsequently the "HOME MENU" button on the Pioneer remote.
* Select option 4. "System Settings" and press "Enter".
* Select d."Network Settings" and press "Enter".
* Select 1. "IP-address, Proxy" and press "Enter".
* Change "DHCP" to OFF.
* Fill in your static IP address, Subnet-mask and standard gateway

## Future updates
These features could be added:

* Zone 2 & 3 control; channel select and volume.
* Cursor remote
* Tone control; Bass & Trebble
* Sleep 30-90 min
* Remote and/or panel lock (disables remote/panel)
* Adapter port operation (Play, Pause, Next etc)

