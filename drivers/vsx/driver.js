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

    this.devices = [];
    
    const cronInterval = setInterval(this.onInterval, 60000, this.getDevices());

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
  	this.log('VSX Driver - onDiscoveryResult() - id', discoveryResult.id);
    this.log('VSX Driver - onDiscoveryResult() - headers: ', discoveryResult.headers);
    fetch(discoveryResult.headers.location).then(async res => {
      if (!res.ok) {
      	this.log('VSX Driver - onDiscoveryResult() - error: ', res.statusText);
        throw new Error(res.statusText);
      }

      const body = await res.text();

      const { address } = discoveryResult;

      this.log(`VSX Driver - description.xml ${body}`);

      const manufacturer = matchBetweenTags('manufacturer', body);
      if (manufacturer !== 'PIONEER CORPORATION') {
        // TODO: leads to an error during pairing.
        // Instead it should result in no new devices found
        this.log('VSX Driver - onDiscoveryResult() - wrong manufacturer: ', manufacturer);
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
            address: address,
            port: (port ? parseInt(port, 10) : 8102),
            mannually: false,
          },
        };

        this.log(`VSX Driver - Found device [${device.data.id}] ${device.name} @ ${device.data.address}:${device.data.port}`);
      }
    })
    .catch(err => {
        this.log('VSX Driver - onDiscoveryResult() - fetch error: ', this.error);
    });
  }

  onPair( socket ) {
    this.log('VSX - Driver - onPair');
    const pioneerDevices = this.devices;

    // Received when a view has changed
    socket.on('showView', ( viewId, callback ) => {
      callback();
      console.log('View: ' + viewId);

	  if(Object.keys(this.devices).length == 0 && viewId == 'list_devices')
      {
      	console.log('view changed to manual_pairing');
      	socket.showView('manual_pairing');
      }
    });


    socket.on('list_devices', function( data, callback ) {

      const devices = Object.values(pioneerDevices).map(device => {
        return device;
      });

      console.log(data);

      if (Object.keys(data).length == 0)
      {
        console.log("ssdp devices")
        callback( null, devices );
      }
      else
      {
        callback(null, [data]);
      }
    });
  }

  onInterval(devices) {
    devices.forEach(device => {
      device.onCheckAvailabilty();
    });

  }
}

module.exports = PioneerVSXDriver;
