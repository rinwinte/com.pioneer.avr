const Homey = require('homey');
const { Log } = require('homey-log');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const PioneerAPI = require('../../lib/PioneerAPI');
const { XMLMinifier } = require('../../lib/XMLMinifier');

const minifier = XMLMinifier();

class PioneerVSXDriver extends Homey.Driver {

  driverLog(...message) {
    this.log('VSX Driver ', ...message);
  }

  onInit(...props) {
    super.onInit(...props);
    this.homeyLog = new Log({ homey: this.homey });

    this.homey.on('cpuwarn', () => this.homeyLog.captureException('CPU warning'));
    this.homey.on('memwarn', () => this.homeyLog.captureException('Memory warning'));

    this._cronInterval = setInterval(this.onInterval, 60000, this.getDevices());

    this._powerUpTrigger = this.homey.flow.getDeviceTriggerCard('onoff_true')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardTrigger - ${args.zone} onoff_true`);
        return Promise.resolve(state.zone === args.zone);
      });

    this._powerDownTrigger = this.homey.flow.getDeviceTriggerCard('onoff_false')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardTrigger - ${args.zone} onoff_false`);
        return Promise.resolve(state.zone === args.zone);
      });

    this._inputSourceChangedTrigger = this.homey.flow.getDeviceTriggerCard('input_source_changed')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardTrigger - ${args.zone} input_source_changed: arg: ${args.input_source}, new: ${state.source}`);

        let inputSourceMatched = (state.source === args.input_source);
        const zoneMatched = (state.zone === args.zone);

        if (args.input_source === 'any') {
          inputSourceMatched = true;
        }

        return Promise.resolve(inputSourceMatched && zoneMatched);
      });

    this.homey.flow
      .getConditionCard('on')
      .registerRunListener(async (args, state) => {
        const isOn = args.device.getCapabilityValue(`onoff.${args.zone}`);

        this.driverLog(`FlowCardCondition - ${args.zone} isOn: ${isOn}`);
        return Promise.resolve(isOn);
      });

    this.homey.flow
      .getConditionCard('input_source_is')
      .registerRunListener(async (args, state) => {
        const capabilityValue = args.device.getCapabilityValue(`input_source.${args.zone}`);

        this.driverLog(`FlowCardCondition - ${args.zone} input_source_is: ${args.input_source}, capability value: ${capabilityValue}`);
        const MatchingInputSource = (capabilityValue === args.input_source);
        return Promise.resolve(MatchingInputSource);
      });

    this.homey.flow
      .getActionCard('off')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardAction - ${args.zone} off`);
        return args.device.onCapabilityOnOff(args.zone, false);
      });

    this.homey.flow
      .getActionCard('on')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardAction - ${args.zone} on`);
        return args.device.onCapabilityOnOff(args.zone, true);
      });

    this.homey.flow
      .getActionCard('toggle')
      .registerRunListener(async (args, state) => {
        const powerState = await args.device.getCapabilityValue(`onoff.${args.zone}`);
        this.driverLog(`FlowCardAction - ${args.zone} toggle`);
        return args.device.onCapabilityOnOff(args.zone, !powerState);
      });

    this.homey.flow
      .getActionCard('input_source_set')
      .registerRunListener(async (args, state) => {
        this.driverLog(`FlowCardAction - ${args.zone} input_source_set: ${args.input_source}`);
        return args.device.onCapabilityInputSource(args.zone, args.input_source);
      });

    this.homey.flow
      .getActionCard('listening_mode_set')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - listening_mode_set: ', args.mode);
        return args.device.triggerCapabilityListener('listening_mode', args.mode, {});
      });

    /*
    this.homey.flow
      .getActionCard('hmg_browsing')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - hmg_browsing: ', args.item);
        return args.device.BrowseHMGItem(args.item.toLowerCase());
      }); */
    this.homey.flow
      .getActionCard('set_tuner_frequency')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - set_tuner_frequency: ', args.frequency);
        return args.device.SetTunerFrequency(args.frequency);
      });

    this.homey.flow
      .getActionCard('set_tuner_preset')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - set_tuner_preset: ', args.preset_letter + args.preset_number);
        return args.device.SetTunerPreset(args.preset_letter + args.preset_number);
      });

    this.homey.flow
      .getActionCard('custom_command')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - custom_command: ', args.command);
        return args.device.CustomCommand(args.command);
      });

    this.homey.flow
      .getActionCard('set_screen_brightness')
      .registerRunListener(async (args, state) => {
        this.driverLog('FlowCardAction - set_screen_brightness: ', args.brightness);
        return args.device.SetScreenBrightness(args.brightness);
      });
  }

  onDeleted() {
    clearInterval(this._cronInterval);
  }

  async triggerPowerOnOffChangedFlow(device, zone, powerState) {
    const tokens = {};
    const state = { zone };

    if (powerState === true) {
      // Device turned on
      this._powerUpTrigger.trigger(device, tokens, state)
        .catch(this.error);
    } else {
      // Device turned off
      this._powerDownTrigger.trigger(device, tokens, state)
        .catch(this.error);
    }
  }

  triggerInputSourceChangedFlow(device, zone, source) {
    const tokens = {};
    const state = { zone, source };

    this._inputSourceChangedTrigger.trigger(device, tokens, state)
      .catch(this.error);
  }

  async onPair(session) {
    const discoveryStrategy = this.getDiscoveryStrategy();

    let pairingDevice = null;

    session.setHandler('list_devices', async data => {
      // Emit when devices are still being searched

      if (pairingDevice == null) {
        const discoveryResults = discoveryStrategy.getDiscoveryResults();

        const existingDevices = await this.getDevices();

        // Wait untill all discovery results are processed
        const pDevices = await Promise.all(Object.values(discoveryResults).map(discoveryResult => {
          // Check whether discovery result is a valid device
          return this.getDeviceByDiscoveryResult(discoveryResult);
        }))
          // When all discovery results are processed filter the valid devices
          .then(async devices => {
            this.driverLog(`list_devices - ${devices.length} Device(s) found`);

            devices = devices.filter(item => {
              return item !== null && existingDevices.filter(existingDevice => {
                return item.id === existingDevice.getData().id;
              }).length === 0;
            });

            this.driverLog(`list_devices - ${devices.length} new Pioneer device(s) found`);

            if (devices.length !== 0) {
              return devices;
            }

            await session.showView('search_device');
            return [];
          });

        return pDevices;
      }

      this.driverLog('list_devices - Manual list_devices');

      return pairingDevice;
    });

    session.setHandler('validate_data', async data => {
      this.driverLog(`validate_data, IP: ${data.ipAddress}, port: ${data.port}`);
      // Continue to next view
      session.showView('loading');

      if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(data.ipAddress) === false) {
        this.driverLog('validate_data - Invalid IP entered');
        await session.showView('search_device');
        Promise.reject(new Error('Invalid IP address entered'));
      }

      const uid = new Date().valueOf(); // Create Unique ID

      if (data.validate === false) {
        pairingDevice = {
          id: data.friendlyName + uid,
          name: data.friendlyName,
          data: {
            id: data.ipAddress,
            manually: true,
          },
          settings: {
            ipAddress: data.ipAddress,
            port: parseInt(data.port, 10),
          },
        };
        this.driverLog(`validate_data, id: ${pairingDevice.id}`);

        await session.showView('list_devices');
      } else {
        this.driverLog(`IP address: ${data.ipAddress}, port: ${data.port}`);

        const api = new PioneerAPI({
          ipAddress: data.ipAddress,
          port: data.port,
        });

        await api.connect()
          .then(async () => {
            this.driverLog('Connection established');
            await api.disconnect();

            pairingDevice = {
              id: data.friendlyName + uid,
              name: data.friendlyName,
              data: {
                id: data.ipAddress,
                manually: true,
              },
              settings: {
                ipAddress: data.ipAddress,
                port: parseInt(data.port, 10),
              },
            };
            this.driverLog(pairingDevice);
            session.showView('list_devices');
          })
          .catch(async err => {
            this.homeyLog.captureException(err);
            await session.showView('search_device');
            return Promise.reject(err);
          });
      }
    });

    // Received when a view has changed
    session.setHandler('showView', async viewId => {
      this.driverLog(`showView: ${viewId}`);
    });
  }

  getDeviceByDiscoveryResult(discoveryResult) {
    this.driverLog('getDeviceByDiscoveryResult()');

    if (typeof discoveryResult.headers === 'undefined'
        || discoveryResult.headers === null
        || typeof discoveryResult.headers.location === 'undefined'
        || discoveryResult.headers.location === null
    ) {
      this.driverLog('Pioneer Receiver discovery result does not contain ssdp details location.');
    }

    const ssdpDetailsLocation = discoveryResult.headers.location;

    this.homeyLog.captureBreadcrumb(
      'ssdp',
      'location address',
      {
        location: ssdpDetailsLocation,
      },
      Log.Severity.Info,
    );

    const defaultDevice = {
      id: discoveryResult.id,
      name: `Pioneer VSX ['${discoveryResult.address}']`,
      data: {
        id: discoveryResult.id,
        manually: false,
      },
      settings: {
        ipAddress: discoveryResult.address,
        port: 8102,
      },
    };

    return new Promise((resolve, reject) => {
      this.getDeviceBySSDPDetailsLocation(ssdpDetailsLocation, defaultDevice)
        .then(device => {
          resolve(device);
        })
        .catch(error => {
          if (typeof error === 'string') {
            this.homeyLog.captureMessage(error);
          } else {
            this.homeyLog.captureException(error);
          }
          resolve(null); // This indicates the device is not a pioneer. Reject is not possible here.
        });
    });
  }

  getDeviceBySSDPDetailsLocation(ssdpDetailsLocation, device) {
    return new Promise((resolve, reject) => {
      fetch(ssdpDetailsLocation).then(async res => {
        if (!res.ok) {
          this.homeyLog.captureMessage(`Fetch error: ${res.statusText}`);
          throw new Error(res.statusText);
        }

        const body = await res.text();

        this.homeyLog.captureBreadcrumb(
          'ssdp',
          'Description.xml',
          {
            body: minifier.minify(body),
          },
          Log.Severity.Info,
        );

        xml2js.parseStringPromise(body)
          .then(result => {
            if (typeof result.root.device === 'undefined') {
              this.driverLog('xml2js - could not verify data');
              reject(new Error('Could not verify SSDP xml data'));
            }

            const xmlDeviceDescription = result.root.device[0];

            if (!xmlDeviceDescription.manufacturer[0].toLowerCase().match(/pioneer/g)) {
              this.driverLog('xml2js - wrong manufacturer');
              reject(new Error('Wrong manufacturer'));
            } else {
              device.name = xmlDeviceDescription.friendlyName[0];
              device.data.modelName = xmlDeviceDescription.modelName[0];
              device.settings.port = parseInt(xmlDeviceDescription['av:X_ipRemoteTcpPort'][0]['_'], 10);
              resolve(device);
            }
          });
      }).catch(err => {
        this.homeyLog.captureException(err);
        reject(new Error(`${err}`));
      });
    });
  }

  onInterval(devices) {
    devices.forEach(device => {
      device.onCheckAvailability();
    });
  }

}

module.exports = PioneerVSXDriver;
