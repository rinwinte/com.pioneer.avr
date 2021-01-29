'use strict';

const Homey = require('homey');
const PioneerAPI = require('../../lib/PioneerAPI');

class GeneralPioneerVSXDevice extends Homey.Device {

  async onInit() {
    this.log('Pioneer Device - onInit()');
    // Used to check whether volume UP/DOWN sweep is required
    this.volumeSetTriggered = false;
    // Used to prevent raising the volume faster than receiving the current volume
    this.volumeUpLock = false;
    this.previousInputSource = '--';

     await this.paired();
  }

  onDeleted() {
    this.log('Pioneer Device - onDeleted()');
    if (this.device) {
      this.device.api.disconnect().catch(this.error);

      this.device = null;
    }
  }

  async onSettings(oldSettingsObj, newSettingsObj, changedKeysArr) {
    // Run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed.

    this.log(`Pioneer Device - onSettings() - ${JSON.stringify(newSettingsObj)} / old = ${JSON.stringify(oldSettingsObj)} / changedKeysArr = ${JSON.stringify(changedKeysArr)}`);

    try {
      changedKeysArr.forEach(key => {
        switch (key) {
          case 'ip':
          {
            if (!this.device.api.setAddress(newSettingsObj['ip'])) {
              throw Error('Wrong IP format');
            }
            break;
          }
          case 'telnetPort':
          {
            this.device.api.setPort(newSettingsObj['telnetPort']);
            break;
          }
          case 'maxVolume':
          {
            const options = {
              min: -80,
              max: newSettingsObj['maxVolume'],
              step: 0.5,
            };

            this.setCapabilityOptions('volume_set', options);
            break;
          }
          default:
            break;
        }
      });
    } catch (error) {
      this.log(`Pioneer Device - onSettings(): ${error}`);
    }
  }

  onDiscoveryResult(discoveryResult) {
    const result = discoveryResult.id.split(':')[1] === this.getData().id;

    this.log(`Pioneer Device - onDiscoveryResult() OK: - ${result}`);

    // Return a truthy value here if the discovery result matches your device.
    return result;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been discovery paired
    this.log('Pioneer Device - onDiscoveryAvailable()');
  }

  async paired() {
    // This method will be executed once when a device is paired
    this.log('Pioneer Device - paired()');

    this.api = new PioneerAPI({
      address: this.getData()['address'],
      port: this.getData()['port'],
    });

    this.setSettings({
      telnetPort: this.getData()['port'],
      ip: String(this.getData()['address']),
    }).catch(err => {
      this.log(`Pioneer Device - paired() - settings: ${err}`);
    });

    this.device = this;

    this.registerEvents();

    this.registerCapabilityListerners();

    this.setAvailable();

    // When this throws, the device will become unavailable.
    return this.api.connect()
      .then(async () => {
        await this.api.sendCommand('?RGC'); // TODO: should be a function and implemented in device.js
        await this.device.api.sendCommand('?V'); // TODO: function call
        await this.device.api.sendCommand('?M'); // TODO: function call
        await this.device.api.sendCommand('?F'); // TODO: function call
        await this.device.api.sendCommand('?P'); // TODO: function call
      })
      .catch(err => {
        this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
        this.setCapabilityValue('onoff', false).catch(this.error);
        this.setUnavailable();
      });
  }

  async onDiscoveryAddressChanged(discoveryResult) {
    this.log('Pioneer Device - onDiscoveryAddressChanged()');
    // / Update your connection details here, reconnect when the device is offline
    if (this.device) {
      this.log('Pioneer Device - onDiscoveryAddressChanged() - setAddress ');
      this.device.api.setAddress(discoveryResult.address);
      await this.device.api.reconnect()
        .catch(err => {
          this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
        });

      this.setSettings({
        ip: discoveryResult.address,
      }).catch(err => {
        this.log(`Pioneer Device - onDiscoveryAddressChanged() - settings: ${err}`);
      });
    }
  }

  async onDiscoveryLastSeenChanged(discoveryResult) {
    // Called every minute from Homey core
    this.log('Pioneer Device - onDiscoveryLastSeenChanged()');
    await this.lastSeen();
  }

  async onCheckAvailabilty(){
    // Called every minute from Pioneer driver
    this.log('Pioneer Device - onCheckAvailabilty() - mannually added: ' + this.getData()['mannually']);

    if(this.getData()['mannually'])
    {
      // Only execute when mannually paired otherwise the function is called by onDiscoveryLastSeenChanged()
      await this.lastSeen();
    }
  }

  async lastSeen() {
    this.log('Pioneer Device - lastSeen()');

    if (this.device) {

      this.log('Pioneer Device - lastSeen() - reconnect');

      await this.device.api.reconnect()
        .then(async () => {
          if (!this.getAvailable()) {
            this.setAvailable();
          }
          await this.device.api.sendCommand('?RGC'); // TODO: function call
          await this.device.api.sendCommand('?P'); // TODO: function call
          if (this.getCapabilityValue('onoff')) {
          	await this.device.api.sendCommand('?V'); // TODO: function call
          	await this.device.api.sendCommand('?M'); // TODO: function call
          	await this.device.api.sendCommand('?F'); // TODO: function call
		  }
        })
        .catch(err => {
          this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
          this.setCapabilityValue('onoff', false).catch(this.error);
          this.setUnavailable();
        });
    }
    return Promise.resolve();
  }

  registerEvents() {
    this.log('Pioneer Device - registerEvents()');

    this.device.api.on('event', this.onPioneerData.bind(this));
    this.device.api.on('timeoutError', this.onPioneerTimeout.bind(this));
  }

  registerCapabilityListerners() {
    this.log('Pioneer Device - registerCapabilityListerners()');

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('volume_set', this.onCapabilityVolumeSet.bind(this));
    this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));
    this.registerCapabilityListener('volume_up', this.onCapabilityVolumeUp.bind(this));
    this.registerCapabilityListener('volume_down', this.onCapabilityVolumeDown.bind(this));
    this.registerCapabilityListener('input_source', this.onCapabilityInputSource.bind(this));
  }

  /*
   * Pioneer API Event Listeners
   */

  onPioneerData({ event, data }) {
    this.log(`Pioneer Device - onPioneerData() - ${event} - data: ${data}`);
  }

  onPioneerTimeout() {
    this.log('Pioneer Device - onPioneerTimeout()');
    this.setUnavailable('Lost connection with device, check network connection');
  }

  async onPowerInfo(data) {
    this.log(`Pioneer Device - onPowerInfo() - ${data}`);

    if (parseInt(data, 10) === 0) {
      this.setCapabilityValue('onoff', true)
        .catch(this.error);
    } else {
      await this.device.api.disconnect();
      this.setCapabilityValue('onoff', false)
        .catch(this.error);
    }
  }

  async onVolumeInfo(data) {
    this.log(`Pioneer Device - onVolumeInfo() - ${data}`);

    const db = (parseInt(data, 10) - 161) / 2;
    this.log(`Pioneer Device - onVolumeInfo() - dB${db}`);

    // This volume up and volume down commands are required for devices
    // that do not support the Volume Level (VL) command.
    // Possibly this has to be moved to a seperate device driver
    if (this.volumeSetTriggered === true) {
      const volSetting = this.getCapabilityValue('volume_set');
      if (volSetting > db) {
        await this.device.api.sendCommand('VU'); // TODO: function call
      } else if (volSetting < db) {
        await this.device.api.sendCommand('VD'); // TODO: function call
      } else {
        this.volumeSetTriggered = false;
      }
    } else {
      this.log('Pioneer Device - onVolumeInfo() - volume_set');

      this.setCapabilityValue('volume_set', db)
        .then(() => {
          this.volumeUpLock = false;
        })
        .catch(this.error);
    }
  }

  async onSourceInfo(data) {
    this.log(`Pioneer Device - onSourceInfo() - ${data}`);

    if (data === this.previousInputSource) {
      this.log(`Pioneer Device - onSourceInfo() - resolve: ${data} === ${this.previousInputSource}`);

      return Promise.resolve();
    }

    return this.setCapabilityValue('input_source', data)
      .then(() => {
        this.unsetWarning();

        this.previousInputSource = data;
        this._driver = this.getDriver();
        this._driver.ready(() => {
          const state = { input_source: data };
          this._driver.triggerInputSourceChangedFlow(this, state);
        });
      })
      .catch(err => {
        this.log(`Pioneer Device - onSourceInfo() - ${err}`);
        this.setWarning(Homey.__('invalidsrc'));
      });
  }

  async onNetworkStandbyModeInfo(data) {
    this.log(`Pioneer Device - onNetworkStandbyModeInfo() - ${data}`);

    if (parseInt(data[0], 10) === 0) {
      this.setWarning(Homey.__('networkstby'));
    } else {
      this.unsetWarning();
    }
  }

  /*
   * Homey Capability Listeners
   */

  async onCapabilityOnOff(value) {
    this.log('Pioneer Device - onCapiblityOnOff()');

    if (value === true) {
      return this.device.api.reconnect()
        .then(() => {
          return this.device.api.sendCommand('PO'); // TODO: should be a function
        })
        .catch(err => {
          this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
        });
    }

    return this.device.api.sendCommand('PF'); // TODO: should be a function
  }

  async onCapabilityVolumeSet(value) {
    this.log('Pioneer Device - onCapiblityVolumeSet()');
    // [0 .. 185] 1 = -80dB , 161 = 0dB, 185 = +12dB, each step is 0.5dB

    let val = 0;
    const maxVolume = this.getSetting('maxVolume');
    if (typeof value === 'undefined' || value === null) {
      val = 0;
    } else if (value < -80) {
      val = 0;
    } else if (value > maxVolume) {
      val = Math.round(maxVolume * 2) + 161;
    } else if (value > 12) {
      val = 185;
    } else {
      val = Math.round((value * 2) + 161);
    }

    let level = val.toString();
    while (level.length < 3) {
      level = `0${level}`;
    }

    await this.device.api.sendCommand(`${level}VL`); // TODO: should be a function

    // Next onVolumeInfo, volume sweep is activated when VL does not work
    this.volumeSetTriggered = true;

    return this.device.api.sendCommand('?V'); // This command is required to initiate the PU/PD sequence required for some Pioneer devices not supporting Volume Level (VL) // TODO: should be a function
  }

  async onCapabilityVolumeMute(value) {
    this.log('Pioneer Device - onCapiblityVolumeMute()');

    let command;

    if (value === true) {
      command = 'MO'; // TODO: should be a function
    } else {
      command = 'MF'; // TODO: should be a function
    }

    return this.device.api.sendCommand(command);
  }

  async onCapabilityVolumeUp(value) {
    const currentVolume = this.getCapabilityValue('volume_set');
    this.log(`Pioneer Device - onCapiblityVolumeUp() - currentVolume: ${currentVolume}`);

    // Pressed Volume UP to fast
    if (this.volumeUpLock === true) {
      return Promise.resolve();
    }
    this.volumeUpLock = true;

    if (currentVolume >= this.getSetting('maxVolume')) {
      this.log(`Pioneer Device - onCapiblityVolumeUp - Max volume reached: ${this.getSetting('maxVolume')}`);
      return Promise.reject(new Error('Maximum volume reached'));
    }

    this.log('Pioneer Device - onCapabilityVolumeUp() - sendCommand');
    return this.device.api.sendCommand('VU'); // TODO: should be a function
  }

  async onCapabilityVolumeDown(value) {
    this.log('Pioneer Device - onCapiblityVolumeDown()');

    return this.device.api.sendCommand('VD'); // TODO: should be a function
  }

  async onCapabilityInputSource(value) {
    this.log(`Pioneer Device - onCapabilityInputSource() - ${value}`);

    return this.device.api.sendCommand(`${value}FN`); // TODO: should be a function
  }

}

module.exports = GeneralPioneerVSXDevice;