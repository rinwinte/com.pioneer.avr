const Homey = require('homey');

class PioneerVSXDriver extends Homey.Driver {

  onInit(...props) {
    super.onInit(...props);

    this.log('VSX Driver - onInit()');

    const devices = this.getDevices();

    devices.forEach(device => {
      device.setWarning(this.homey.__('deprecated_driver'));
      device.setUnavailable(this.homey.__('deprecated_driver'));
    });
  }

}

module.exports = PioneerVSXDriver;
