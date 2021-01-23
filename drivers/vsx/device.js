'use strict';

const GeneralPioneerVSXDevice = require('../../lib/GeneralPioneerVSXDevice');

class PioneerVSXDevice extends GeneralPioneerVSXDevice {

  registerEvents() {
    this.log('VSX Device - registerEvents()');
    super.registerEvents();

    this.api.on('PWR', super.onPowerInfo.bind(this));
    this.api.on('VOL', super.onVolumeInfo.bind(this));
    this.api.on('FN', super.onSourceInfo.bind(this));
    this.api.on('RGC', super.onNetworkStandbyModeInfo.bind(this));
    // This.api.on('FL', super.on.bind(this)); // Display information
    // This.api.on('SSI', super.on.bind(this)); // ??
    // This.api.on('RGB', super.on.bind(this)); // Custom sources name (friendly name)
    // This.api.on('RGD', super.on.bind(this)); // Device/Version information
    // This.api.on('RGF', super.on.bind(this)); // Input info??
    // This.api.on('GEH', super.on.bind(this)); // Song information
  }

}

module.exports = PioneerVSXDevice;
