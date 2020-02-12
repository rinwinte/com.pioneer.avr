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
  }

  // This method is called when a user is adding a device
  // and the 'list_devices' view is called
  async onPairListDevices(data, callback) {
    this.log('VSX Driver - onPairListDevices()');
    const discoveryStrategy = this.getDiscoveryStrategy();
    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    const devices = await Promise.all(Object.values(discoveryResults).map(async discoveryResult => {
      this.log('VSX Driver - discoveryResult - ', JSON.parse(JSON.stringify(discoveryResult)));
      const device = await fetch(discoveryResult.headers.location).then(async res => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }

        const body = await res.text();

        const manufacturer = matchBetweenTags('manufacturer', body);
        if (manufacturer !== 'PIONEER CORPORATION') {
          // TODO: leads to an error during pairing.
          // Instead it should result in no new devices found
          return null;
        }

        const friendlyName = matchBetweenTags('friendlyName', body);
        const udn = matchBetweenTags('UDN', body).replace('uuid:', '');
        const port = matchBetweenTags('av:X_ipRemoteTcpPort', body);

        return {
          name: friendlyName,
          data: {
            id: udn,
            address: discoveryResult.address,
            port,
          },
        };
      })
        .catch(this.error);

      return device;
    }));

    callback(null, devices);
  }

}

module.exports = PioneerVSXDriver;
