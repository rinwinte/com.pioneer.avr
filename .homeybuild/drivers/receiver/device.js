const { GeneralPioneerVSXDevice, Zones } = require('../../lib/GeneralPioneerVSXDevice');

class PioneerVSXDevice extends GeneralPioneerVSXDevice {

  registerEvents() {
    this.log('VSX Device - registerEvents()');
    super.registerEvents();

    this.api.on('RGD', super.onPioneerModelInformation.bind(this)); // Device model information
    this.api.on('E', super.onErrorMessage.bind(this)); // Some error occured
    this.api.on('PWR', super.onPowerInfo.bind(this, Zones.Main)); // Power information
    this.api.on('APR', super.onPowerInfo.bind(this, Zones.Zone2)); // Power information Zone 2
    this.api.on('VOL', super.onVolumeInfo.bind(this, Zones.Main)); // Current volume
    this.api.on('ZV', super.onVolumeInfo.bind(this, Zones.Zone2)); // Current volume Zone 2
    this.api.on('MUT', super.onMuteInfo.bind(this, Zones.Main)); // Current mute information
    this.api.on('Z2MUT', super.onMuteInfo.bind(this, Zones.Zone2)); // Current mute information Zone 2
    this.api.on('FN', super.onSourceInfo.bind(this, Zones.Main)); // Current source
    this.api.on('Z2F', super.onSourceInfo.bind(this, Zones.Zone2)); // Current source Zone 2
    this.api.on('RGC', super.onNetworkStandbyModeInfo.bind(this)); // Get network standby information
    // this.api.on('GBH', super.onHMGMaxNrList.bind(this)); // H.M.G. Maximum number of list
    // this.api.on('GCH', super.onHMGScreenInfo.bind(this)); // H.M.G. Screen information
    // this.api.on('GDH', super.onHMGListLineInfo.bind(this)); // H.M.G. List & Line Information
    // this.api.on('GEH', super.onHMGDisplayInfo.bind(this)); // H.M.G. Display information
    this.api.on('SR', super.onListeningMode.bind(this)); // Current listening mode
    this.api.on('PRA', super.onTunerPresetChannel.bind(this, 'A')); // Current preset A channel of the tuner
    this.api.on('PRB', super.onTunerPresetChannel.bind(this, 'B')); // Current preset B channel of the tuner
    this.api.on('PRC', super.onTunerPresetChannel.bind(this, 'C')); // Current preset C channel of the tuner
    this.api.on('PRD', super.onTunerPresetChannel.bind(this, 'D')); // Current preset D channel of the tuner
    this.api.on('PRE', super.onTunerPresetChannel.bind(this, 'E')); // Current preset E channel of the tuner
    this.api.on('PRF', super.onTunerPresetChannel.bind(this, 'F')); // Current preset F channel of the tuner
    this.api.on('PRG', super.onTunerPresetChannel.bind(this, 'G')); // Current preset G channel of the tuner
    this.api.on('FRF', super.onTunerFrequency.bind(this)); // Current FM frequency of the tuner
  }

}

module.exports = PioneerVSXDevice;
