This app connects via Telnet to the Pioneer AVR and monitors the netwerk status using SSDP. Therefore, it is not required to set a static IP address. However, in order to use the ON button and for better performance it is required to enable Network Standby, see details below.

This app uses the default port of the device which in most cases is 8102. Homey claims this port as long as the device is powered and releases it only on power down. Keep this in mind when trying to use Telnet from another source such as a computer or the official Pioneer app.

Please let me know if your Pioneer model is supported.

Network Standby:
The Network Standby option is required to control the Pioneer receiver even when it is off. In order to turn the device on again this setting has to be ON. Furthermore, it ensures a stable connection with the device. See, the Github page or your device manual how to change the setting.


Pioneer Friendly Name:
The receiver by default has the name VSX-xxx when finding it on the network. This name can be changed following the steps below. When adding the device to the Homey Pioneer app, it will automatically take over this name. See, the Github page or your device manual how to change the setting.



