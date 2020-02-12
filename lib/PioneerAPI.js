'use strict';

const { EventEmitter } = require('events');
const net = require('net');

const DELIMITER = '\r\n';

class PioneerAPI extends EventEmitter {

  constructor({ mac, address }) {
    super();

    this.mac = mac;
    // console.debug(`Pioneer API - constructor(): ${address}`);

    this.port = 23;
    this.model = 'VSX';

    this._debug = process.env.PIONEER_DEBUG === '1';

    this.address = address;
    this._state = 'disconnected';
    this._rxBuffer = ''; // TODO couple this buffer directly to .net onData?
  }

  // TODO use this insead of console.debug
  // Debug(...props) {
  // If(!this._debug) return;
  // Console.log('[Debug]', `[${new Date()}]`, ...props);
  // }

  setAddress(address) {
    if (address !== this.address) {
      this.address = address;
      // console.debug('Pioneer API - setAddress() - ${address}');
    }
  }

  async connect() {
    // console.debug('Pioneer API - connect()');

    return this._connect();
  }

  async _connect() {
    // console.debug('Pioneer API - _connect()');

    if (this._state === 'connected') {
      // console.debug('Pioneer API - _connect()  - Already connected');
      return Promise.resolve();
    }

    if (this._state === 'connecting') {
      // console.debug('Pioneer API - _connect()  - Busy connecting');
      return this._connectPromise;
    }

    if (this._state === 'disconnecting') {
      // console.debug('Pioneer API - _connect()  - Busy disconnecting');
      try {
        await this._disconnectPromise;
        await new Promise(resolve => process.nextTick(resolve));
      } catch (err) {}
    }

    this._connectPromise = new Promise((resolve, reject) => {
      this._setState('connecting');

      this._socket = new net.Socket();
      this._socket
        .setTimeout(300000)
        .once('connect', () => {
          // console.debug('Pioneer API - Socket onConnect');
        })
        .on('error', err => {
          this._socket.destroy();
          // console.debug('Pioneer API - Socket onError ', err);
          return reject(err);
        })
        .on('timeout', () => {
          // console.debug('Pioneer API - Socket onTimeout');
          this._socket.destroy();
          this.emit('timeoutError');
          reject(new Error('Socket timeout'));
        })
        .on('end', () => {
          // console.debug('Pioneer API - Socket onEnd');
        })
        .on('close', () => {
          // console.debug('Pioneer API - Socket onClose');

          this._socket.removeAllListeners();
          this._socket.destroy();
          this._socket = null;
          this._connectPromise = null;
          this._setState('disconnected');
          reject(new Error('Closed'));
        })
        .on('data', data => {
          if (this._state !== 'connected') {
            this._setState('connected');
          }
          // console.debug(`Pioneer API - Socket onData: ${data.toString()}`);
          this._rxBuffer += data;
          this._parseRXBuffer();
        })
        .connect(this.port, this.address, () => {
          // console.debug('Socket onConnect Callback');
          this._setState('connected');

          resolve();
        });
    });

    return this._connectPromise;
  }

  async disconnect() {
    // console.debug('Pioneer API - disconnect()');

    return this._disconnect();
  }

  async _disconnect() {
    // console.debug('Pioneer API - _disconnect()');

    if (this._state === 'disconnected') {
      return Promise.resolve();
    }

    if (this._state === 'disconnecting') {
      return this._disconnectPromise;
    }

    if (this._state === 'connecting') {
      try {
        await this._connectPromise;
      } catch (err) {}
    }

    this._setState('disconnecting');

    this._disconnectPromise = new Promise((resolve, reject) => {
      this._socket.once('end', () => {
        // console.debug('Pioneer API -  _disconnect() - Socket onEnd');
      });
      this._socket.once('close', () => {
        // console.debug('Pioneer API - _disconnect() -Socket onClose');
        resolve();
      });
      this._socket.end();
    });

    return this._disconnectPromise;
  }

  async reconnect() {
    /* If(this._state !== 'disconnected')
    {
      return;
    } */
    // console.debug('Pioneer API - reconnect()');

    if (this._reconnectPromise) {
      return this._reconnectPromise;
    }

    this._reconnectPromise = Promise.resolve().then(() => this._connect()
      .then(() => {
        // console.debug('Pioneer API - reconnect() - Reconnected');
        this._reconnectPromise = null;
      })
      .catch(err => {
        // console.error('Pioneer API - reconnect() - Reconnection error:', err);
        this._reconnectPromise = null;
        // This.emit('reconnectError', err);
        throw Error(`Reconnection error${err}`);
      }));

    return this._reconnectPromise;
  }

  _parseRXBuffer() {
    // TODO for loop instead of recalling the _parseRXBuffer again at the end??
    const rxBufferArr = this._rxBuffer.split(DELIMITER);
    if (rxBufferArr.length > 1) {
      const rxBufferItem = rxBufferArr.shift();
      this._rxBuffer = rxBufferArr.join(DELIMITER);

      const event = rxBufferItem.match(/[A-Z]{2,3}/); // / Match first 2 or 3 characters
      const data = rxBufferItem.split(/[A-Z]{2,3}(.+)/)[1];

      this.emit('event', {
        event,
        data,
      });
      this.emit(event, data);

      this._parseRXBuffer();
    }
  }

  async sendCommand(command) {
    // console.debug('Pioneer API - sendCommand()');

    if (this._state !== 'connected') {
      return Promise.reject(new Error('Not connected with device'));
    }

    this._socket.write(`${command}\r`);
    return Promise.resolve();
  }

  _setState(state) {
    this._state = state;
    // console.debug(`Pioneer API - _setState(): ${state}`);
  }

}

module.exports = PioneerAPI;
