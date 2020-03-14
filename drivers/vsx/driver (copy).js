'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');

function matchBetweenTags(tagName, input) {
  const re = new RegExp(`<${tagName}.*>(.*?)</${tagName}>`);

  const result = input.match(re);
  if (result && typeof result[1] === 'string') {
    return result[1];
  }
  return null;
}

class PioneerVSXDriver extends Homey.Driver {

  onInit() {
    this.log('VSX Driver - onInit()');

    this.devices = {};

    const discoveryStrategy = Homey.ManagerDiscovery.getDiscoveryStrategy('pioneer');
    discoveryStrategy.on('result', this.onDiscoveryResult.bind(this));
  }

  onDiscoveryResult( discoveryResult ) {
    fetch(discoveryResult.headers.location).then(async res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }

      const body = await res.text();

      let address = discoveryResult.address;

      this.log(`VSX Driver - description.xml ${body}`);

      const manufacturer = matchBetweenTags('manufacturer', body);
      if (manufacturer !== 'PIONEER CORPORATION') {
          // TODO: leads to an error during pairing.
          // Instead it should result in no new devices found
          return;
      }

      const friendlyName = matchBetweenTags('friendlyName', body);
      if (friendlyName) friendlyName = friendlyName.replace('Pioneer VSX');
      
      let udn = matchBetweenTags('UDN', body).replace('uuid:', '');
      let port = matchBetweenTags('av:X_ipRemoteTcpPort', body);

      this.log(`VSX Driver - description.xml - port ${port}`);

      if( this.devices[udn] ) {
        this.devices[udn].address = address;
        this.devices[udn].port = port;
      } else {     
        const device = this.devices[udn] = {
          name: friendlyName,
          data: {
            id: udn,
            address: address,
            port: (port ? parseInt(port, 10) : 8102),
          }
         // modelName: matchBetweenTags('modelName', body),
         // modelNumber: matchBetweenTags('modelNumber', body),
         // deviceId: matchBetweenTags('DeviceID', body),
         // wlanMac: matchBetweenTags('wlanMac', body),
        };
        
        // this.emit(`device:${device.udn}`, device);
        this.log(`VSX Driver - Found device [${device.data.id}] ${device.name} @ ${device.data.address}:${device.data.port}`);
      }
      }).catch(this.error);
  }

  // This method is called when a user is adding a device
  // and the 'list_devices' view is called
  async onPairListDevices(data, callback) {
    this.log('VSX Driver - onPairListDevices()');
    const devices = Object.values(this.devices).map(device => {
      return device;
    });
    return callback(null, devices);
  }

}

module.exports = PioneerVSXDriver;
