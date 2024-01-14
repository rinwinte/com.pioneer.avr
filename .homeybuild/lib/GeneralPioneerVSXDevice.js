const Homey = require('homey');
const { Log } = require('homey-log');
const PioneerAPI = require('./PioneerAPI');
const Commands = require('./PioneerCommands');
const DisplayInfoDataTypeEnum = require('./Enums/DisplayInfoDataTypeEnum');
const ScreenInfoDataTypeEnum = require('./Enums/ScreenInfoDataTypeEnum');
const InputChannelDataTypeEnum = require('./Enums/InputChannelDataTypeEnum');

const Zones = {
  Main: 'main',
  Zone2: 'zone2',
};

Number.prototype.map = function map(inMin, inMax, outMin, outMax) {
  return ((this - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

class GeneralPioneerVSXDevice extends Homey.Device {

  deviceLog(...message) {
    this.log('Pioneer Device ', ...message);
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async setCapabilityValue(capabilityId, value) {
    return new Promise((resolve, reject) => {
      super.setCapabilityValue(capabilityId, value).then(resolve).catch(error => {
        this.homeyLog.captureBreadcrumb(
          'general_device',
          'Could not set capability value',
          {
            capabilityId,
            value,
            zone2: this.getSetting('enableZone2Capabilities'),
          },
          Log.Severity.Error,
        );
        this.homeyLog.captureException(error);
        reject(error);
      });
    });
  }

  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    this._onoffTimer = {
      main: null,
      zone2: null,
    };
    this._onoffTimerCheck = {
      main: false,
      zone2: false,
    };
    this._powerState = {
      main: true,
      zone2: true,
      lastSeen:
      {
        main: false,
        zone2: false,
      },
    };
    this._inputSource = {
      main: '--',
      zone2: '--',
    };
    this._volumeState = {
      setpoint:
      {
        main: 0,
        zone2: 0,
      },
      // Used to prevent raising the volume faster than receiving the current volume
      upLock:
      {
        main: false,
        zone2: false,
      },
      // Used to check whether volume UP/DOWN sweep is required
      triggered:
      {
        main: false,
        zone2: false,
      },
    };

    // Used to determine whether device can be powered using Telnet
    this.networkStbyActive = 0;

    this.tunerInfo = { presetChannel: 'A01', frequency: '8750' };

    this.currentHMGList = {
      maxItems: 8, screenType: 0, screenName: '', totalNrItems: 0, lines: { dataType: 0, line: '' },
    };

    this.hmgReceiveBusy = false;

    this.api = new PioneerAPI({
      ipAddress: this.getSetting('ipAddress'),
      port: this.getSetting('port'),
    });

    this.device = this;

    this.registerEvents();

    this.changeZone2Capabilities(false);

    this.registerCapabilityListerners();

    this.setAvailable().catch(this.error);
    this.setCapabilityValue('onoff.main', true).catch(this.error);

    const albumArt = await this.homey.images.createImage();
    albumArt.setPath('../drivers/receiver/assets/images/albumart.png');
    this.setAlbumArtImage(albumArt);

    if (this.getData()['manually']) {
      await this.createConnection();
      await this.sendCommand(Commands.InfoRequest.RequestDeviceModelInformation);
    }
  }

  onDeleted() {
    if (this.device) {
      this.device.api.disconnect().catch(this.error);

      this.device = null;
    }
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    // Run when the user has changed the device's settings in Homey.
    // changedKeys contains an array of keys that have been changed.
    this.deviceLog(`onSettings() - ${JSON.stringify(newSettings)} / old = ${JSON.stringify(oldSettings)} / changedKeysArr = ${JSON.stringify(changedKeys)}`);

    if (changedKeys && changedKeys.length) {
      for (let idx = 0; idx < changedKeys.length; idx++) {
        switch (changedKeys[idx]) {
          case 'ipAddress':
          {
            await this.device.api.setIPAddress(newSettings['ipAddress'])
              .catch(err => {
                throw new Error('Wrong IP format');
              });
            break;
          }
          case 'port':
          {
            await this.device.api.setPort(newSettings['port']);
            break;
          }
          case 'enableZone2Capabilities':
          {
            const state = newSettings['enableZone2Capabilities'];

            await this.changeZone2Capabilities(state);

            break;
          }
          default:
            break;
        }
      }
    }
  }

  async changeZone2Capabilities(state) {
    if (state) {
      this.deviceLog('Zone2 capabilities added');

      if (!this.hasCapability('volume_set.zone2')) {
        await this.addCapability('volume_set.zone2');
      }
      if (!this.hasCapability('onoff.zone2')) {
        await this.addCapability('onoff.zone2');
      }
      if (!this.hasCapability('volume_down.zone2')) {
        await this.addCapability('volume_down.zone2');
      }
      if (!this.hasCapability('volume_mute.zone2')) {
        await this.addCapability('volume_mute.zone2');
      }
      if (!this.hasCapability('volume_up.zone2')) {
        await this.addCapability('volume_up.zone2');
      }
      if (!this.hasCapability('input_source.zone2')) {
        await this.addCapability('input_source.zone2');
      }
      // throw new Error('Zone2 is not supported yet');
    } else {
      this.deviceLog('Zone2 capabilities removed');

      if (this.hasCapability('volume_set.zone2')) {
        await this.removeCapability('volume_set.zone2');
      }
      if (this.hasCapability('onoff.zone2')) {
        await this.removeCapability('onoff.zone2');
      }
      if (this.hasCapability('volume_down.zone2')) {
        await this.removeCapability('volume_down.zone2');
      }
      if (this.hasCapability('volume_mute.zone2')) {
        await this.removeCapability('volume_mute.zone2');
      }
      if (this.hasCapability('volume_up.zone2')) {
        await this.removeCapability('volume_up.zone2');
      }
      if (this.hasCapability('input_source.zone2')) {
        await this.removeCapability('input_source.zone2');
      }
      // throw new Error('Zone2 is not supported yet');
    }
  }

  onDiscoveryResult(discoveryResult) {
    const result = discoveryResult.id === this.getData().id;

    this.homeyLog.captureBreadcrumb(
      'ssdp',
      'Verify discoveryResult',
      {
        result,
      },
      Log.Severity.Info,
    );

    // Return a truthy value here if the discovery result matches your device.
    return result;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been discovery paired
    // When this throws, the device will become unavailable.
    await this.createConnection();
  }

  async onDiscoveryAddressChanged(discoveryResult) {
    // Update your connection details here, reconnect when the device is offline
    if (this.device) {
      this.homeyLog.captureBreadcrumb(
        'ssdp',
        'IP address changed',
        {
          discoveryResult,
        },
        Log.Severity.Info,
      );

      this.device.api.setAddress(discoveryResult.address);
      await this.device.api.reconnect()
        .catch(err => {
          this.homeyLog.captureException(err);
          this.setUnavailable().catch(this.error);
        });

      this.setSettings({
        ip: discoveryResult.address,
      }).catch(err => {
        this.homeyLog.captureException(err);
      });
    }
  }

  async onDiscoveryLastSeenChanged(discoveryResult) {
    // Called every minute from Homey core
    await this.lastSeen();
  }

  async onCheckAvailability() {
    // Called every minute from Pioneer driver
    if (this.getData()['manually']) {
      // Only execute when manually paired otherwise it is called by onDiscoveryLastSeenChanged()
      await this.lastSeen();
    }
  }

  async createConnection() {
    await this.api.connect()
      .then(async () => {
        await this.sendCommand(Commands.InfoRequest.RequestNetworkStandbyInformation, Zones.Main);
        await this.sendCommand(Commands.Power['main'].RequestPowerStatus);
        await this.sendCommand(Commands.Power['zone2'].RequestPowerStatus);
      })
      .catch(err => {
        this.homeyLog.captureException(err);
        this.setCapabilityValue('onoff', false).catch(this.error);
        this.setUnavailable().catch(this.error);
        Promise.reject(err);
      });
  }

  async tryConnecting() {
    // TODO(RW): can this be in create connection? with option for delay and maby for setunavailable
    await this._sleep(2000); // Delay required, otherwise results in EHOSTUNREACH
    return this.device.api.connect()
      .catch(err => {
        this.homeyLog.captureMessage({ message: 'Not able to connect with device', level: Log.Severity.Error });
      });
  }

  async sendCommand(command, powerOnZone = null) {
    this.homeyLog.captureBreadcrumb(
      'sendCommand',
      'send command',
      {
        command,
      },
      Log.Severity.Info,
    );

    if (this.getCapabilityValue('onoff') === false && powerOnZone !== null) {
      await this.onCapabilityOnOff(powerOnZone, true); // Turn device on
    }

    return this.device.api.sendCommand(command)
      .catch(err => {
        this.homeyLog.captureBreadcrumb(
          'sendCommand',
          err,
          {
            command,
          },
          Log.Severity.Info,
        );
        return Promise.reject(err);
      });
  }

  async lastSeen() {
    if (this.device) {
      this.deviceLog('lastSeen() - reconnect');

      await this.device.api.reconnect()
        .then(async () => {
          if (!this.getAvailable()) {
            this.setAvailable().catch(this.error);
          }
          this._powerState.lastSeen['main'] = true;
          this._powerState.lastSeen['zone2'] = true;
          await this.sendCommand(Commands.InfoRequest.RequestNetworkStandbyInformation);
          await this.sendCommand(Commands.Power['main'].RequestPowerStatus);
          await this.sendCommand(Commands.Power['zone2'].RequestPowerStatus);
        })
        .catch(err => {
          this.homeyLog.captureException(err);
          this.setCapabilityValue('onoff', false).catch(this.error);
          this.setUnavailable().catch(this.error);
        });
    }
    return Promise.resolve();
  }

  registerEvents() {
    this.device.api.on('event', this.onPioneerData.bind(this));
    this.device.api.on('timeoutError', this.onPioneerTimeout.bind(this));
    this.device.api.on('sendCommandTimeout', () => {
      this.deviceLog('Send command timeout');
    });
  }

  registerCapabilityListerners() {
    this.registerCapabilityListener('onoff.main', this.onCapabilityOnOff.bind(this, Zones.Main));
    this.registerCapabilityListener('onoff.zone2', this.onCapabilityOnOff.bind(this, Zones.Zone2));
    this.registerCapabilityListener('volume_set.main', this.onCapabilityVolumeSet.bind(this, Zones.Main));
    this.registerCapabilityListener('volume_set.zone2', this.onCapabilityVolumeSet.bind(this, Zones.Zone2));
    this.registerCapabilityListener('volume_mute.main', this.onCapabilityVolumeMute.bind(this, Zones.Main));
    this.registerCapabilityListener('volume_mute.zone2', this.onCapabilityVolumeMute.bind(this, Zones.Zone2));
    this.registerCapabilityListener('volume_up.main', this.onCapabilityVolumeUp.bind(this, Zones.Main));
    this.registerCapabilityListener('volume_up.zone2', this.onCapabilityVolumeUp.bind(this, Zones.Zone2));
    this.registerCapabilityListener('volume_down.main', this.onCapabilityVolumeDown.bind(this, Zones.Main));
    this.registerCapabilityListener('volume_down.zone2', this.onCapabilityVolumeDown.bind(this, Zones.Zone2));
    this.registerCapabilityListener('input_source.main', this.onCapabilityInputSource.bind(this, Zones.Main));
    this.registerCapabilityListener('input_source.zone2', this.onCapabilityInputSource.bind(this, Zones.Zone2));
    this.registerCapabilityListener('listening_mode', this.onCapabilityListeningMode.bind(this));

    this.registerCapabilityListener('speaker_playing', value => {
      if (this.getCapabilityValue('input_source.main') !== InputChannelDataTypeEnum.HMG) {
        return Promise.reject(new Error('H.M.G. is not selected'));
      }

      return value
        ? this.sendCommand(Commands.HMGOperation.Play)
        : this.sendCommand(Commands.HMGOperation.Pause);
    });

    this.registerCapabilityListener('speaker_next', value => {
      if (this.getCapabilityValue('input_source.main') !== InputChannelDataTypeEnum.HMG) {
        this.homeyLog.captureMessage({ message: 'H.M.G. is not selected', level: Log.Severity.Warning });
        return Promise.reject(new Error('H.M.G. is not selected'));
      }
      return this.sendCommand(Commands.HMGOperation.Next);
    });

    this.registerCapabilityListener('speaker_prev', value => {
      if (this.getCapabilityValue('input_source.main') !== InputChannelDataTypeEnum.HMG) {
        this.homeyLog.captureMessage({ message: 'H.M.G. is not selected', level: Log.Severity.Warning });
        return Promise.reject(new Error('H.M.G. is not selected'));
      }
      return this.sendCommand(Commands.HMGOperation.Previous);
    });
  }

  /*
   * Pioneer API Event Listeners
   */

  onPioneerData({ event, data }) {
    if (String(event) !== Commands.InfoRequest.DisplayInformation) {
      this.homeyLog.captureBreadcrumb(
        'deviceData',
        'received data',
        {
          event: event[0],
          data,
        },
        Log.Severity.Info,
      );
    }
  }

  onPioneerTimeout() {
    this.homeyLog.captureMessage({ message: 'Communication timed out!' });
  }

  onPioneerModelInformation(model) {
    this.homeyLog.captureMessage({ message: `Manual device added with model: ${model}`, level: Log.Severity.Info });
  }

  onErrorMessage(error) {
    this.deviceLog(`onError() - ${error}`);
    this.homeyLog.captureMessage({ message: `Error from device received: ${error}`, level: Log.Severity.Error });
  }

  async onPowerInfo(zone, powerState) {
    powerState = (powerState === '0'); // Convert to boolean, powerState 0 is On
    this.deviceLog(`onPowerInfo() - ${zone}: ${powerState}, currentState: ${this._powerState[zone]}`);
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return;
    }
    // Compare previous power state with incoming
    if (powerState !== this._powerState[zone]) {
      this.driver.ready().then(() => {
        this.driver.triggerPowerOnOffChangedFlow(this, zone, powerState);
      });
    }

    this._powerState[zone] = powerState;
    this._powerState.lastSeen[zone] = false;
    await this.setCapabilityValue(`onoff.${zone}`, powerState).catch(this.error);

    if (this._powerState[zone]) {
      await this.sendCommand(Commands.Volume[zone].RequestVolumeLevel);
      await this.sendCommand(Commands.Mute[zone].RequestMuteStatus);
      await this.sendCommand(Commands.Input[zone].RequestInputSource);

      if (this._powerState['main']) {
        await this.sendCommand(Commands.ListeningMode.RequestListeningMode);
      }
    } else if (!this._powerState['main'] && !this._powerState['zone2']
      && !this._powerState.lastSeen['main'] && !this._powerState.lastSeen['zone2']) {
      await this.device.api.disconnect();
    }
  }

  async onVolumeInfo(zone, volume) {
    const volumeInt = parseInt(volume, 10);
    const volMin = this.getSetting('minRangeVolume');
    const volMax = this.getSetting('maxRangeVolume');
    const percentage = Math.round(volumeInt.map(volMin, volMax, 0, 1) * 100) / 100;

    this.deviceLog(`onVolumeInfo() ${zone} - percentage: ${percentage * 100}%`);

    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return;
    }

    const maxVolume = this.getSetting('maxVolume') / 100;
    if (percentage > maxVolume) {
      await this.onCapabilityVolumeSet(zone, maxVolume);
    }

    // This volume up and volume down commands are required for devices
    // that do not support the Volume Level (VL) command.
    if (this._volumeState.triggered[zone] === true){
      if (this._volumeState.setpoint[zone] > percentage) {
        await this.sendCommand(Commands.Volume[zone].VolumeUp);
      } else if (this._volumeState.setpoint[zone] < percentage) {
          await this.sendCommand(Commands.Volume[zone].VolumeDown);
      } else {
          this._volumeState.triggered[zone] = false;
      } 
    }

    if (this._volumeState.triggered[zone] === false) {
      this.deviceLog('onVolumeInfo() - volume_set');
      this.setCapabilityValue(`volume_set.${zone}`, percentage)
        .then(() => {
          this._volumeState.upLock[zone] = false;
          this.driver.ready().then(() => {
            this.driver.triggerVolumeChangedFlow(this, zone);
          });
        })
        .catch(this.error);
    }
  }

  async onMuteInfo(zone, muteState) {
    this.deviceLog(`onMuteInfo() - ${zone}, ${muteState}`);

    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    muteState = (muteState === '0'); // Convert to boolean, powerState 0 is On

    return this.setCapabilityValue(`volume_mute.${zone}`, muteState).catch(this.error);
  }

  async onSourceInfo(zone, source) {
    this.deviceLog(`onSourceInfo() - ${zone}, ${source}, currentSource: ${this._inputSource[zone]}`);

    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    if (source === this._inputSource[zone]) {
      return Promise.resolve();
    }

    if (source === InputChannelDataTypeEnum.HMG) {
      // Reset media capability
      await this.setCapabilityValue('speaker_track', '').catch(this.error);
      await this.setCapabilityValue('speaker_artist', '').catch(this.error);
      await this.setCapabilityValue('speaker_album', '').catch(this.error);
      await this.setCapabilityValue('speaker_position', 0).catch(this.error);

      await this.sendCommand(Commands.HMGOperation.GetCurrentList);
    } else if (source === InputChannelDataTypeEnum.Tuner) {
      await this.sendCommand(Commands.Tuner.RequestTunerPreset);
      await this.sendCommand(Commands.Tuner.RequestTunerFrequency);
    }

    return this.setCapabilityValue(`input_source.${zone}`, source)
      .then(() => {
        this.unsetWarning();

        this._inputSource[zone] = source;
        this.driver.ready().then(() => {
          this.driver.triggerInputSourceChangedFlow(this, zone, source);
        });
      })
      .catch(err => {
        this.homeyLog.captureException(err);
        this.setWarning(this.homey.__('invalidsrc'));
      });
  }

  async onListeningMode(listeningmode) {
    this.deviceLog(`onListeningMode() - ${listeningmode}`);

    if (this.getCapabilityValue('listening_mode') === listeningmode) {
      return Promise.resolve();
    }

    return this.setCapabilityValue('listening_mode', listeningmode)
      .catch(err => {
        this.homeyLog.captureException(err);
        this.setCapabilityValue('listening_mode', '0000').catch(this.error); // Unkown mode
      });
  }

  async onNetworkStandbyModeInfo(data) {
    this.deviceLog(`onNetworkStandbyModeInfo() - ${data}`);

    this.networkStbyActive = parseInt(data[0], 10);
    if (this.networkStbyActive === 0 && this.getSetting('networkStbyWarning') === false) {
      this.setWarning(this.homey.__('networkstby'));
      this.homeyLog.captureMessage({ message: 'Network standby not set', level: Log.Severity.Warning });
    } else {
      this.unsetWarning();
    }
  }

  async onHMGMaxNrList(data) {
    this.currentHMGList.lines = [];
    this.currentHMGList.maxItems = parseInt(data, 10);
    this.hmgReceiveBusy = true; // To indicate stream of HMG data is busy
    this.HMGListCounter = 0;
    this.deviceLog(`onHMGMaxNrList() - maxItems: ${this.currentHMGList.maxItems}`);
  }

  async onHMGScreenInfo(data) {
    this.currentHMGList.screenType = parseInt(data.substring(0, 2), 10);
    this.currentHMGList.screenName = data.substring(7, 32).replace(/"/g, ''); // Take only 24 bytes because somethimes this is the maximum the device is giving back on GCH

    if (this.currentHMGList.screenType === ScreenInfoDataTypeEnum.Playing_Play) {
      this.setCapabilityValue('speaker_playing', true).catch(this.error);
    } else if (this.currentHMGList.screenType === ScreenInfoDataTypeEnum.Playing_Stop
      || this.currentHMGList.screenType === ScreenInfoDataTypeEnum.Playing_Pause) {
      this.setCapabilityValue('speaker_playing', false).catch(this.error);
    }

    this.deviceLog(`onHMGScreenInfo() - screenType: ${this.currentHMGList.screenType}, screenName: ${this.currentHMGList.screenName} `);
  }

  async onHMGListLineInfo(data) {
    this.currentHMGList.totalNrItems = parseInt(data.substring(10), 10);
    this.deviceLog(`onHMGListLineInfo() - totalNrItems: ${this.currentHMGList.totalNrItems}`);
  }

  async onHMGDisplayInfo(data) {
    const currentLineType = parseInt(data.substring(3, 5), 10);
    const currentLineData = data.substring(6, data.length - 1);

    this.currentHMGList.lines[parseInt(data.substring(0, 2), 10) - 1] = {
      dataType: currentLineType, line: currentLineData,
    };

    this.deviceLog(`onHMGDisplayInfo() - current linetype: ${currentLineType}, data: ${currentLineData}`);

    if (this.HMGListCounter++ === this.currentHMGList.maxItems - 1) {
      // All list items received
      this.hmgReceiveBusy = false;
      this.HMGListCounter = 0;
    }

    if (currentLineType === DisplayInfoDataTypeEnum.Track) {
      this.deviceLog(`onHMGDisplayInfo() - Track: ${currentLineData}`);
      this.setCapabilityValue('speaker_track', currentLineData).catch(this.error);
    } else if (currentLineType === DisplayInfoDataTypeEnum.Artist) {
      this.deviceLog(`onHMGDisplayInfo() - Artist: ${currentLineData}`);
      this.setCapabilityValue('speaker_artist', currentLineData).catch(this.error);
    } else if (currentLineType === DisplayInfoDataTypeEnum.Album) {
      this.deviceLog(`onHMGDisplayInfo() - Album: ${currentLineData}`);
      this.setCapabilityValue('speaker_album', currentLineData).catch(this.error);
    } else if (currentLineType === DisplayInfoDataTypeEnum.Chapternr) {
      this.deviceLog(`onHMGDisplayInfo() - Chapternr: ${currentLineData}`);
      this.setCapabilityValue('speaker_position', parseInt(currentLineData, 10)).catch(this.error);
    }
  }

  async onTunerFrequency(frequency) {
    this.tunerInfo.frequency = frequency[0] === '0' ? frequency.substring(1) : frequency;
    this.deviceLog(`onTunerFrequency() - frequency: ${this.tunerInfo.frequency}`);
  }

  async onTunerPresetChannel(channelLetter, channelNumber) {
    this.tunerInfo.presetChannel = channelLetter + channelNumber;
    this.deviceLog(`onTunerPresetChannel() - channel: ${channelLetter}${channelNumber}`);
  }

  /*
   * Homey Capability Listeners
   */

  async onCapabilityOnOff(zone, value) {
    this.deviceLog(`onCapiblityOnOff() ${zone}: ${value}`);
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      Promise.resolve();
    }

    this._onoffTimer[zone] = setTimeout(() => {
      this._onoffTimerCheck[zone] = false;
    }, 3000);

    if (value === true) {
      if (this.networkStbyActive === 0) {
        if (this._onoffTimerCheck[zone] === false) {
          this.deviceLog('Send IR ON Command');
          const pioneerSignal = this.homey.rf.getSignalInfrared('pioneerIRSignal');
          pioneerSignal.cmd(`POWER_ON.${zone}`);
          this.tryConnecting();
          return Promise.resolve(); // Connecting takes too long (>30s), return before timeout
        }
        return Promise.reject(new Error('Pressed to quickly'));
      }
      return this.device.api.reconnect()
        .then(() => {
          return this.sendCommand(Commands.Power[zone].PowerOn);
        })
        .catch(err => {
          this.homeyLog.captureException(err);
          return Promise.reject();
        });
    }

    this._onoffTimerCheck[zone] = true;
    this.sendCommand(Commands.Power[zone].PowerOff);
    return Promise.resolve();
  }

  async onCapabilityVolumeSet(zone, value) {
    this.deviceLog(`onCapiblityVolumeSet() - value: ${value * 100}%`);
    // [0 .. 185] 1 = -80dB , 161 = 0dB, 185 = +12dB, each step is 0.5dB
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    const maxVolume = this.getSetting('maxVolume') / 100;
    if (typeof value === 'undefined' || value === null) {
      this._volumeState.setpoint[zone] = 0;
    } else if (value > maxVolume) {
      this._volumeState.setpoint[zone] = maxVolume;
    } else {
      this._volumeState.setpoint[zone] = value;
    }

    const volMin = this.getSetting('minRangeVolume');
    const volMax = this.getSetting('maxRangeVolume');
    const val = Math.round(this._volumeState.setpoint[zone].map(0, 1, volMin, volMax));

    let level = val.toString();
    while (level.length < 3) {
      level = `0${level}`;
    }

    await this.sendCommand(`${level}${Commands.Volume[zone].VolumeSet}`, zone);

    // Next onVolumeInfo, volume sweep is activated when VL does not work
    this._volumeState.triggered[zone] = true;

    // This command is required to initiate the PU/PD sequence
    // required for some Pioneer devices not supporting Volume Level (VL)
    return this.sendCommand(Commands.Volume[zone].RequestVolumeLevel, zone);
  }

  async onCapabilityVolumeMute(zone, value) {
    this.deviceLog('onCapiblityVolumeMute()');
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    let command;

    if (value === true) {
      command = Commands.Mute[zone].MuteOn;
    } else {
      command = Commands.Mute[zone].MuteOff;
    }
    return this.sendCommand(command, zone);
  }

  async onCapabilityVolumeUp(zone, value) {
    this.deviceLog('onCapabilityVolumeUp()');
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    const currentVolume = this.getCapabilityValue(`volume_set.${zone}`);
    // Pressed Volume UP to fast
    if (this._volumeState.upLock[zone] === true) {
      return Promise.resolve();
    }
    this._volumeState.upLock[zone] = true;

    if (currentVolume >= (this.getSetting('maxVolume') / 100)) {
      this.devicelog(`onCapiblityVolumeUp - Max volume reached: ${this.getSetting('maxVolume')}`);
      return Promise.reject(new Error('Maximum volume reached'));
    }

    this.deviceLog('onCapabilityVolumeUp() - sendCommand');
    return this.sendCommand(Commands.Volume[zone].VolumeUp, zone);
  }

  async onCapabilityVolumeDown(zone, value) {
    this.deviceLog('onCapabilityVolumeDown()');
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    return this.sendCommand(Commands.Volume[zone].VolumeDown, zone);
  }

  async onCapabilityInputSource(zone, value) {
    this.deviceLog(`onCapabilityInputSource()- ${zone}: ${value}`);
    if (zone === Zones.Zone2 && !this.getSetting('enableZone2Capabilities')) {
      return Promise.resolve();
    }

    if (this.getCapabilityValue(`input_source.${zone}`) !== value) {
      await this.sendCommand(`${value}${Commands.Input[zone].InputChange}`, zone);

      if (value === InputChannelDataTypeEnum.HMG) {
        await this._WaitForNextHMGMenu({ dataType: 1, line: 'Top Menu' }, 30000);
      }
    }

    return Promise.resolve();
  }

  async onCapabilityListeningMode(mode) {
    this.deviceLog(`onCapabilityListingMode() - ${mode}`);

    if (this.getCapabilityValue('listening_mode') !== mode && mode !== '0000') {
      await this.sendCommand(`${mode}${Commands.ListeningMode.ListeningModeSet}`, Zones.Main);
    }

    return Promise.resolve();
  }

  async _WaitForNextHMGMenu(browseListInfo, timeoutms) {
    this.deviceLog('_WaitForNextHMGMenu - next item: ', browseListInfo);
    const maxCycles = timeoutms / 100;
    const line = browseListInfo.line.substring(0, 24);
    let sleepCounter = 0;
    let compOutput = true;
    this.hmgReceiveBusy = true;

    while ((this.hmgReceiveBusy || compOutput) && sleepCounter < maxCycles) {
      compOutput = browseListInfo.dataType === DisplayInfoDataTypeEnum.Directory
        ? this.currentHMGList.screenName !== line : false;

      await this._sleep(100);

      sleepCounter++;
    }

    if (sleepCounter === 15) {
      this.homeyLog.captureMessage({ message: 'Wait for next HMG menu error!', level: Log.Severity.Error });
      return Promise.reject(new Error('WaitForNextHMGMenu error'));
    }

    return Promise.resolve();
  }

  async _WaitForNextHMGListItems() {
    let sleepCounter = 0;
    this.hmgReceiveBusy = true;
    while (this.hmgReceiveBusy && sleepCounter < 25) {
      await this._sleep(100);

      sleepCounter++;
    }

    if (sleepCounter === 15) {
      this.homeyLog.captureMessage({ message: 'Wait for next HMG list error!', level: Log.Severity.Error });
      return Promise.reject(new Error('WaitForNextHMGListItems error'));
    }

    return Promise.resolve();
  }

  async BrowseHMGItem(item) {
    const inputSource = this.getCapabilityValue('input_source.main');
    this.deviceLog(`BrowseHMGItem() - inputSource: ${inputSource}FN, item: ${item}`);

    try {
      // Check whether input source is H.M.G.
      if (inputSource !== InputChannelDataTypeEnum.HMG) {
        this.homeyLog.captureMessage({ message: 'Device is not in H.M.G. mode', level: Log.Severity.Error });
        return Promise.reject(new Error('Device is not in H.M.G. mode'));
      }

      if (this.currentHMGList.screenName !== 'Top Menu') {
        await this.sendCommand(Commands.HMGOperation.Menu, Zones.Main); // Navigate to main menu
        await this._WaitForNextHMGMenu({ dataType: 1, line: 'Top Menu' }, 5000);
      }

      const path = item.split(/[\s,/\\]+/);

      for (let i = 0; i < path.length; i++) {
        const browseIdx = parseInt(path[i], 10);
        if (Number.isNaN(browseIdx)) {
          return Promise.reject(new Error(`Path index ${i} is not a number`));
        }

        if (browseIdx > this.currentHMGList.totalNrItems) {
          return Promise.reject(new Error(`Path index ${i} is greater than the number of available items`));
        }

        let listIdx = browseIdx;

        if (browseIdx > this.currentHMGList.maxItems) {
          listIdx = 1;
          await this.sendCommand(`${browseIdx.toString().padStart(5, '0')}${Commands.HMGOperation.DisplayList}`, Zones.Main);
          await this._WaitForNextHMGListItems();
        }

        if (this.currentHMGList.lines[listIdx].dataType === DisplayInfoDataTypeEnum.Normal
          || this.currentHMGList.lines[listIdx].datatype > DisplayInfoDataTypeEnum.Video) {
          return Promise.reject(new Error(`Path index ${i} is not supported`));
        }

        await this.sendCommand(`${listIdx.toString().padStart(2, '0')}${Commands.HMGOperation.SelectListContent}`, Zones.Main);

        if (this.currentHMGList.lines[listIdx - 1].dataType === DisplayInfoDataTypeEnum.Directory) {
          await this._WaitForNextHMGMenu(this.currentHMGList.lines[listIdx - 1], 5000);
        }
      }

      return Promise.resolve();
    } catch (err) {
      this.homeyLog.captureException(err);
      return Promise.reject(err);
    }
  }

  async SetTunerFrequency(frequencyString) {
    const insMain = this.getCapabilityValue('input_source.main');
    let insZone2 = null;
    if (!this.hasCapability('input_source.zone2')) {
      insZone2 = this.getCapabilityValue('input_source.zone2');
    }

    this.deviceLog(`SetTunerFrequency() - inputSource: main: ${insMain}FN zone2: ${insZone2}FN, item: ${frequencyString}`);

    // Check whether input source is tuner
    if (insMain !== InputChannelDataTypeEnum.Tuner && insZone2 !== InputChannelDataTypeEnum.Tuner) {
      this.homeyLog.captureMessage({ message: 'Device is not in tuner mode', level: Log.Severity.Error });
      return Promise.reject(new Error('Device is not in tuner mode'));
    }

    const freqNr = parseFloat(frequencyString);

    if (Number.isNaN(freqNr) || freqNr < 87.5 || freqNr > 108.0) {
      this.homeyLog.captureMessage({ message: 'Not a correct frequency', level: Log.Severity.Error });
      return Promise.reject(new Error('Not a correct frequency'));
    }

    const pre = parseInt((freqNr * 100), 10);
    const freqString = String(pre);

    if (this.tunerInfo.frequency === freqString) {
      return Promise.resolve();
    }

    await this.sendCommand(Commands.Tuner.DirectAccess, Zones.Main);

    this.deviceLog(`SetTunerFrequency() ${freqNr} - freqstr: ${freqString}`);

    for (let i = 0; i < freqString.length; i++) {
      await this.sendCommand(`${freqString[i]}${Commands.Tuner.TunerPreset}`, Zones.Main);
    }

    return Promise.resolve();
  }

  async SetTunerPreset(preset) {
    this.deviceLog(`SetTunerPreset() ${preset}`);

    if (this.tunerInfo.presetChannel === preset) {
      return Promise.resolve();
    }

    return this.sendCommand(`${preset}${Commands.Tuner.TunerPresetDirectSet}`, Zones.Main);
  }

  async CustomCommand(command) {
    this.deviceLog(`CustomCommand() - ${command}`);
    return this.sendCommand(command, Zones.Main);
  }

  async SetScreenBrightness(brightness) {
    this.deviceLog(`SetScreenBrightness() - ${brightness}`);
    return this.sendCommand(`${brightness}${Commands.AMP.Dimmer}`, Zones.Main);
  }

}

module.exports = { GeneralPioneerVSXDevice, Zones };
