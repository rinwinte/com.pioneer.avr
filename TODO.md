
TODO next release

- Comply with newest homey SDK
- Delete unrequired files from Github
- Update git files following warning from github













https://www.pioneerelectronics.com/PUSA/Support/Home-Entertainment-Custom-Install/RS-232+&+IP+Codes/A+V+Receivers

http://192.168.1.107/StatusHandler.asp => laat alle friendly input namen zien en alle beschikbare inputs
?F current input name. returning input number FN00-31
**FN setting input dmv number 00-31
?RGB** Request input name (friendly name). returninh RGB**x"name". x = 0 is default and 1 if custom
 name
Name is max 14 characters

Rename input source:
0RGB** ==> rename to default
"name"1RGB** ==> rename to specific "name" 


- Bij opstarten Ga door en lijst met predifined id's inside device.js
	- {00, 01, 02, 04, 05, 06, 12, 13, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 33, 34, 38, 41, 44, 45, 47, 48, 49, 53 }
	- de APP vraagt op (VSX-921): {01, 02, 03, 04, 05, 10, 14, 15, 17, 25, 26, 33}
	- Marcos app support: {00, 01, 02, 03, 04, 05, 06, 14, 15, 17, 19, 20, 21, 22, 23, 24, 25, 38, 45, 48, 49}
	- errors op: {06, 13, 24, 34, 38, 41, 44, 45, 47, 48, 49, 53}






HOW TO DEPLOY NEW FIRMWARE:
1. Inside package.json increase version number
2. run command: sudo npm i -g eslint
3. run command: sudo npm build
4. run command: sudo npm install -g homey
5. run command: homey app validate --level publish
6. run command: homey app publish
7. run command: git push origin master
8. run command: git commit -m "commit text"




- Closing irrellevant firefox tabs
- Refactor current code
	- change _var to real private variables?? voornamelijk in pioneerapi.js
	- rxBuffer direct koppelen aan .net onData functie?
	- are explicit states required or use socket.connected
		- otherwise: change state strings to an enum
	- For loop inside _parseRXBuffer() instead of recalling itself
- Use Homey Log (Sentry) and/or Homey Log insight.
- If volume at start is higher than max supported reduce the volume to the max (e.g. due to remote)
- Add minimal time between send commands of 100ms. Using send buffer?
- Queuing option for send and wait until response is received/timeout before sending new one?
  - Preventing volume higher then max by pressing the + button fastly. The current vollume is not updated fast enough 
  - or the queuing function checks whether the VU command is permitted when taking in from to queue to send
  - or a button debounce timer.. button press implementation only executed after x time between consecutive presses
- Buttons should not work when device is off. or it should reconnect first in case of network standby is enabled. 
- Homey cpuwar, memwarn & unload see, https://apps.developer.athom.com/module-Homey.html
- API calls reject after 'close' and 'timeout'. How to handle these. e.g. mark unavailable? 
- when call device.api.reconnect() -> first check whether device is disconnected at all
	- call _disconnect and add forced _socket.destroy(). Inside 'timeout' await disconnectPromis? insead of directly called socket.destroy()
- Add actions for when device suddently is disconnected or has an error --> device unavailable
- Add periodically check whether system is muted, current volume, current channel or maby only when device is turned on. 
- Fault behavior when device is not connected to the network anymore. 
- Add sources 
- Add source friendly name
- Add selection of which sourcefiles to put in the list in settings menu
- API logging with datetime.
- change sendcommand functions to be command independent. The command ID should be in device.js
	- make a dictionary inside device.js and pass to generalpioneervsxdevice?
	- or call sendPWRCommand etc and overwrite this function inside device.js. Force overwrite??
- Add send queue
	- 100ms between commands as suggested in manual
	- wait till sending next command until response to this command is received or timeout
- Add release of COM port when app is not used / no command is send / device is off
	- When device is put on without Homey it is detected after 15 min max.
- Look at On/Off procedure. When doing it fastly after one another the device does not respond anymore.
- move/delete cron job to application level instead of device level. and let it call the X function of all devices.
	- let the app be connected till it is off the network and reconnect when device is last seen changed or IP changed
- Get maximal volume of the Pioneer device and change max volume input capability accordingly




 // For the time being treat command like event. It is the same with an IR Remote and it is not really important whether the command arrives
 // Create a construction so that when a message is sent we know a response to that message is received.
 // it looks like denon can make a difference between event/ and response/ if it is a response then when there is a currentSendQueueItem available is resolves the received response to the caller. 

 // Maby I can look whether the currentSendQueueItem === incomming command response & resolve
 // however:
 		- ?V, VU, VD are coupled to VOL
		- ?P, PWR are coupled to PWR
		- ?M, MO, MF coupled to MUT
		- ?F coupled to FN
		- etc.
		- so, a conversion table should be made to see whether outgoing is incoming
			- checkCoupling(currentSendQueueCommand, IncomingCommand);
				- implement in device child
				- if ?V || VU || VD == currentSend && IncomingCOmmand == VOL ==? resolve()
				- response data is analyzed by earlier onInfo callback.
		- check what happens if the currentSendItem is not resolved.. what does Denon?
			- does Denon put a new item on the queue but never sends it? until a timeout on the current item		
 // Other option to make a tranceiveCommand instead of sendCommand(). 
 	However:
 		- What if for example: FL comes before VOL
 // Or just do not couple command to response. (command is event)
    However:
         - when no response a command. User does not know it. like timouts

 returing a promise directly can be done by: return Promise.resolve( value ); instead of using new.

        - press receiver button and subsequently the HOME MENU button. 
        - select 4. System Settings and press Enter
        - select d. Network Settings and press Enter
          - select 1. IP-address Proxy and press Enter (to change into static IP)
            - Change DHCP to OFF
            - Fill in a IP-address, subnet-mask, standard gateway. 
          - select 2. Network Standby and press Enter
            - Change Network Standby to ON
          - select 3. Friendly Name and press enter(to change the default device name)
            - select "Change name" and press enter.



// CRON EXAMPLE

    // TODO the cron task should be commented out for initial release. 
    // TODO When required it should probalby be moved to a place it is only called one time and not for each device e.g. MyApp onInit()? inside app.js?. 
    //const task = await this.task('checkconnection');
    //await Homey.ManagerCron.unregisterAllTasks(); /// Used to unregister all tasks

    //task.on('run', settings => {
      //this.log('Pioneer Device - ', settings); 
      //device.api.reconnect(); //todo check wheter device is offline in Homey here
    //});

  // TODO only uncomment when cron is required
  //async task(name) {
    //try {
    	//this.log('Pioneer Device - Cron Task already excists', name);
      	//return await Homey.ManagerCron.getTask(name);
    //} 
    //catch(e) {
      	//this.log('Pioneer Device - Register Cron Task ', name);
      	//return await Homey.ManagerCron.registerTask(name, '* * * * * *', { name })
      	//return 0;
    //}
  //}
