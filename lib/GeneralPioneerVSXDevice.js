'use strict';

const Homey = require('homey');
const PioneerAPI = require('../../lib/PioneerAPI');

class GeneralPioneerVSXDevice extends Homey.Device {

  onInit() {
    this.log('Pioneer Device - onInit()');
    // Used to check whether volume UP/DOWN sweep is required
    this.volumeSetTriggered = false;
    // Used to prevent raising the volume faster than receiving the current volume
    this.volumeUpLock = false;
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

    this.log(changedKeysArr);

    this.log(newSettingsObj);

    this.log(this.getCapabilityOptions('volume_set'));

    const options = {
      min: -80,
      max: newSettingsObj['maxVolume'],
      step: 0.5,
    };

    this.setCapabilityOptions('volume_set', options);
  }

  onDiscoveryResult(discoveryResult) {
    this.log(`Pioneer Device - onDiscoveryResult() - ${discoveryResult.id.split(':')[1]}` === this.getData().id);

    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id.split(':')[1] === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been found
    this.log('Pioneer Device - onDiscoveryAvailable()');

    this.api = new PioneerAPI({
      mac: discoveryResult.mac,
      address: discoveryResult.address,
    });

    this.device = this;

    this.registerEvents();

    this.registerCapabilityListerners();

    // When this throws, the device will become unavailable.
    await this.api.connect()
      .then(async () => {
        await this.device.api.sendCommand('?P'); // TODO: function call
        await this.api.sendCommand('?RGC'); // TODO: should be a function and implemented in device.js
        await this.device.api.sendCommand('?V'); // TODO: function call
        await this.device.api.sendCommand('?M'); // TODO: function call
      })
      .catch(err => {
        this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
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
    }
  }

  async onDiscoveryLastSeenChanged(discoveryResult) {
    // Called every minute from Homey core
    // When the device is offline, try to reconnect here
    this.log('Pioneer Device - onDiscoveryLastSeenChanged()');

    if (this.device) {
      this.log('Pioneer Device - onDiscoveryLastSeenChanged() - reconnect');

      if (!this.getAvailable()) {
        this.setAvailable();
      }

      await this.device.api.reconnect()
        .then(async () => {
          await this.device.api.sendCommand('?P'); // TODO: function call
          await this.device.api.sendCommand('?RGC'); // TODO: function call
          await this.device.api.sendCommand('?V'); // TODO: function call
          await this.device.api.sendCommand('?M'); // TODO: function call
        })
        .catch(err => {
          this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
        });
    }
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
  }

  /*
   * Pioneer API Event Listeners
   */

  onPioneerData({ event, data }) {
    this.log(`Pioneer Device - onPioneerData() - ${event} - data: ${data}`);
  }

  onPioneerTimeout() {
    this.log('Pioneer Device - onPioneerTimout()');
    this.setUnavailable('Lost connection with device, check netwok connection');
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

    let command = 'PF'; // TODO: should be a function

    if (value === true) {
      await this.device.api.reconnect()
        .catch(err => {
          this.log(`Pioneer Device - onPioneerReconnectError() ${err}`);
        });
      command = 'PO'; // TODO: should be a function
    }

    const res = await this.device.api.sendCommand(command);

    if (value === false) {
      await this.device.api.disconnect();
    }

    return res;
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

}

module.exports = GeneralPioneerVSXDevice;
