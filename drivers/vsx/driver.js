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

  onInit(...props) {
    super.onInit(...props);

    this.log('VSX Driver - onInit()');

    this.devices = {};

    const discoveryStrategy = Homey.ManagerDiscovery.getDiscoveryStrategy('pioneer');
    discoveryStrategy.on('result', this.onDiscoveryResult.bind(this));

    this._flowTriggerInputSourceChanged = new Homey.FlowCardTriggerDevice('input_source_changed')
      .register().registerRunListener((args, state) => {
        this.log(`VSX Driver - Flow trigger input source changed args: ${args.input_source}, state: ${state.input_source}`);

        let input_source_matched = (state.input_source === args.input_source);

        if(args.input_source === "any")
        {
          input_source_matched = true;
        }
        
        return Promise.resolve(input_source_matched);
      });

    new Homey.FlowCardCondition('input_source_is')
      .register()
      .registerRunListener((args, state) => {
        const CapabilityValue = args.device.getCapabilityValue('input_source');
        this.log(`VSX Driver - FlowCardCondition - input_source_is args: ${args.input_source}, capability value: ${CapabilityValue}`);
        const MatchingInputSource = (CapabilityValue === args.input_source);
        return Promise.resolve(MatchingInputSource);
      });

    new Homey.FlowCardAction('input_source_set')
      .register()
      .registerRunListener((args, state) => {
        this.log('VSX Driver - FlowCardAction - input_source_set args: ', args.input_source);
        return args.device.triggerCapabilityListener('input_source', args.input_source, {});
      });
  }

  triggerInputSourceChangedFlow(device, state) {
    const tokens = {};

    this._flowTriggerInputSourceChanged
      .trigger(device, tokens, state)
      .then(this.log)
      .catch(this.error);
  }

  onDiscoveryResult(discoveryResult) {
    fetch(discoveryResult.headers.location).then(async res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }

      const body = await res.text();

      const { address } = discoveryResult;

      this.log(`VSX Driver - description.xml ${body}`);

      const manufacturer = matchBetweenTags('manufacturer', body);
      if (manufacturer !== 'PIONEER CORPORATION') {
        // TODO: leads to an error during pairing.
        // Instead it should result in no new devices found
        return;
      }

      let friendlyName = matchBetweenTags('friendlyName', body);
      if (friendlyName) friendlyName = friendlyName.replace('Pioneer VSX');

      const udn = matchBetweenTags('UDN', body).replace('uuid:', '');
      const port = matchBetweenTags('av:X_ipRemoteTcpPort', body);

      this.log(`VSX Driver - description.xml - port ${port}`);

      if (this.devices[udn]) {
        this.devices[udn].address = address;
        this.devices[udn].port = port;
      } else {
        const device = this.devices[udn] = {
          name: friendlyName,
          data: {
            id: udn,
            address,
            port: (port ? parseInt(port, 10) : 8102),
          },
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
