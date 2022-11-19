const Power = {
  main: {
    PowerOn: 'PO',
    PowerOff: 'PF',
    RequestPowerStatus: '?P',
  },
  zone2: {
    PowerOn: 'APO',
    PowerOff: 'APF',
    RequestPowerStatus: '?AP',
  },
};

const Volume = {
  main: {
    VolumeUp: 'VU',
    VolumeDown: 'VD',
    VolumeSet: 'VL',
    RequestVolumeLevel: '?V',
    VolumeMin: 0,
    VolumeMax: 185,
  },
  zone2: {
    VolumeUp: 'ZU',
    VolumeDown: 'ZD',
    VolumeSet: 'ZV',
    RequestVolumeLevel: '?ZV',
    VolumeMin: 0,
    VolumeMax: 81,
  },
};

const Mute = {
  main: {
    MuteOn: 'MO',
    MuteOff: 'MF',
    RequestMuteStatus: '?M',
  },
  zone2: {
    MuteOn: 'Z2MO',
    MuteOff: 'Z2MF',
    RequestMuteStatus: '?Z2M',
  },
};

const Input = {
  main: {
    InputChange: 'FN',
    RequestInputSource: '?F',
  },
  zone2: {
    InputChange: 'ZS',
    RequestInputSource: '?ZS',
  },
};

const ListeningMode = {
  ListeningModeSet: 'SR',
  RequestListeningMode: '?S',
};

const Tuner = {
  RequestTunerFrequency: '?FR',
  RequestTunerPreset: '?PR',
  DirectAccess: 'TAC',
  TunerPresetDirectSet: 'PR',
  TunerPreset: 'TP',
};

const AMP = {
  Dimmer: 'SAA',
};

const HMGOperation = {
  Play: '10NW',
  Pause: '11NW',
  Previous: '12NW',
  Next: '13NW',
  Stop: '20NW',
  Menu: '36NW',
  GetCurrentList: '?GAH',
  SelectListContent: 'GFH',
  DisplayList: 'GGH',
};

const InfoRequest = {
  RequestFLDispalyInformation: '?FL',
  DisplayInformation: 'FL',
  RequestInputNameInformation: '?RGB',
  RequestNetworkStandbyInformation: '?RGC',
  RequestDeviceModelInformation: '?RGD',
};

module.exports = {
  Power, Volume, Mute, Input, ListeningMode, Tuner, AMP, HMGOperation, InfoRequest,
};
