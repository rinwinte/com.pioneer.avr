LINKS:

	Link to Pioneer IP/RS232 protocol:
	https://www.pioneerelectronics.com/PUSA/Support/Home-Entertainment-Custom-Install/RS-232+&+IP+Codes/A+V+Receivers

	Link to examples of Eventhandler HTTP commands:
	https://github.com/rwifall/pioneer-receiver-notes
	e.g. => http://192.168.1.107/StatusHandler.asp => laat alle friendly input namen zien en alle beschikbare inputs

	Link to IR prontohex commands:
	http://www.remotecentral.com/cgi-bin/files/rcfiles.cgi?area=pronto&db=discrete&br=pioneer&dv=receiver



APP INFORMATION:
	Navigation to NL internet Radio: 1,1,5,33,2,3



TODO ideas next release:

	- volume lock (en andere locks), volumetrigger uitzetten na een command timeout
	- volume changed trigger alleen aanroepen bij vd/vu of vsp = ?V. als te gecompliceerd in latere release doen. Dit voorkomt dat bij apparaten die geen VL hebben er 
          continue getriggered wordt bij sweepen
	- Flow card mainzone input source changed trigger card werkt niet
	- Depending the serial number of the device presenting the correct input sources and capabilities
	- Create classes for the zone/main functionality instead all required variables
	- Make log text more structured (text build up, the same structure)
	- Add more error feadback during manual pairing (ask for help) .emit and .alert do not work
	- Add option to skip the manual pair validation. checkbox standard on.
	- Check where to use locales translations files instead of in the file
	- Interval voor systeemcommandos/on op 20 seconde. onAvailable uitzetten?
	- Research auto poweron function when HMI button pressed. Be cautious because these capabilities are used for flows as well. Could be that if a device is off and a flow is active the flow auto 		  turns on the device. That could be unwanted. 
	- Optimize minify file
	- IR on option & info in readme for devices that do not have network standby
		--> Check wheter in can by in current driver (size issues etc)
		--> If network stby enabel use telnet ortherwise send IR.
		--> Change readme.md and readme.txt
	- Find nice development framework for homey (with autocomplete etc)
	- Build in get model number when manually paired (Telnet command)
	- Code refactoring
	- Code/performance optimalization
	- Mechanism to check wheter manually entered device is valid
	- Zone commandos
		Zone on/off
		Zone volume
		Zone mute
		Zone input
		This can be done by volume_set.zone1. Flow cards for the main en zones must be added in that case. 
		Setting to enable zone? If enable off then disable capabilities
	- Zone capabilities enable/disable using settings
	- If tuner is selected enable make capability visible to enter a preference channel and/or tuner freq
	- HMG browse using list names --> automatically searching name in current list, if not fount --> GGH to next part of list, repeat till found/end of list. If found GFH the list number
	- HMG browse complete path and auto send using list names
	- Add selection of which sources to put in the list in settings menu. Custom setting menu has to be supported to add a list of checkboxes + textboxnames. To select all desirable sources.



HELP REMARKS:
	If HOMEY OFFLINE Message: restart computer and not only the VirtualBox

	Added captureBreadcrumb method and Severity enum to node-homey-log Log file



H.M.G FUNCTION:

functionalities disabled because not tested yet:
driver.compose.json capabilities:
    "speaker_prev",
    "speaker_next",
    "speaker_playing",
    "speaker_album",
    "speaker_track",
    "speaker_artist",
    "speaker_position"
Uncommented r106-r112 of drivers/receiver/driver.js
removed hmg_browsing.json from .homeycompose/flow/actions and temporarily placed it under Workdir



HOW TO DEPLOY NEW FIRMWARE:
	- Use CTRL + B in .js files for eslint check
	- Sublime --> Tools eslint fix for auto fix
	1. //Inside package.json increase version number
	2. //run command: sudo npm i -g eslint
	3. //run command: sudo npm build
	4. //run command: sudo npm install -g homey
	5. run command: homey app validate --level publish
	6. run command: homey app publish
		-> Choose Yes for updating version number
		-> Choose witch version number to increase, must be the same as in package.json
		-> Enter a changelog text
		-> Choose Yes
	7. run command to add all files to the repository: git add --all
	8. run command to view which files are added: git status
	9. run command: git commit -m "commit text" 
	10. run command: git push https://github.com/rinwinte/com.pioneer.avr.git
		-> Add username: rinwinte
		-> Add password: see token on account

