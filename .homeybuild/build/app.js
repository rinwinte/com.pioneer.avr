'use strict';

const Homey = require('homey');
const { Log } = require('homey-log');


class MyApp extends Homey.App {

  onInit() {
    this.log('MyApp is running...');
    this.homeyLog = new Log({ homey: this.homey });
  }

}

module.exports = MyApp;
