'use strict';

const { EventEmitter } = require('events');
const net = require('net');

const DELIMITER = '\r\n';

class PioneerAPI extends EventEmitter {

  constructor({ address, port }) {
    super();

    this.port = port;
    this.model = 'VSX';

    this.address = address;
    this._state = 'disconnected';
    this._rxBuffer = ''; // TODO couple this buffer directly to .net onData?
  }

  debug(...props) {
    console.log('[Debug]', `[${new Date()}]`, ...props);
  }

  async setAddress(address) {
    if (address !== this.address) {
      if (net.isIPv4(address)) {
        this.address = address;
        await this.disconnect();
        await this.connect();
        return true;
      }
    }

    this.debug(`Pioneer API - setAddress() - ${address}`);
    return false;
  }

  async setPort(port) {
    this.port = port;
    await this.disconnect();
    await this.connect();
  }

  async connect() {
    this.debug('Pioneer API - connect()');

    return this._connect();
  }

  async _connect() {
    this.debug('Pioneer API - _connect()');

    if (this._state === 'connected') {
      this.debug('Pioneer API - _connect()  - Already connected');
      return Promise.resolve();
    }

    if (this._state === 'connecting') {
      this.debug('Pioneer API - _connect()  - Busy connecting');
      return this._connectPromise;
    }

    if (this._state === 'disconnecting') {
      this.debug('Pioneer API - _connect()  - Busy disconnecting');
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
          this.debug('Pioneer API - Socket onConnect');
        })
        .on('error', err => {
          this._socket.destroy();
          this.debug('Pioneer API - Socket onError ', err);
          return reject(err);
        })
        .on('timeout', () => {
          this.debug('Pioneer API - Socket onTimeout');
          this._socket.destroy();
          this.emit('timeoutError');
          reject(new Error('Socket timeout'));
        })
        .on('end', () => {
          this.debug('Pioneer API - Socket onEnd');
        })
        .on('close', () => {
          this.debug('Pioneer API - Socket onClose');

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
          this.debug(`Pioneer API - Socket onData: ${data.toString()}`);
          this._rxBuffer += data;
          this._parseRXBuffer();
        })
        .connect(this.port, this.address, () => {
          this.debug('Pioneer API - `Socket onConnect Callback');
          this._setState('connected');

          resolve();
        });
    });

    return this._connectPromise;
  }

  async disconnect() {
    this.debug('Pioneer API - disconnect()');

    return this._disconnect();
  }

  async _disconnect() {
    this.debug('Pioneer API - _disconnect()');

    if (this._state === 'disconnected') {
      this.debug('Pioneer API - already disconnected');
      return Promise.resolve();
    }

    if (this._state === 'connecting') {
      try {
        await this._connectPromise;
      } catch (err) {}
    }

    this._setState('disconnecting');

    this._disconnectPromise = new Promise((resolve, reject) => {
      this._socket.once('end', () => {
        this.debug('Pioneer API -  _disconnect() - Socket onEnd');
      });
      this._socket.once('close', () => {
        this.debug('Pioneer API - _disconnect() -Socket onClose');
        this._disconnectPromise = null;
        resolve();
      });
      // destroy() is used instead of end() because some devices does not reply correctly on end()
      this._socket.destroy();
    });

    return this._disconnectPromise;
  }

  async reconnect() {
    this.debug('Pioneer API - reconnect()');

    if (this._reconnectPromise) {
      this.debug('Pioneer API - reconnect() - Return previous reconnect promise');
      return this._reconnectPromise;
    }

    if (this._connectPromise) {
      this.debug('Pioneer API - reconnect() - Return previous connect promise');
      return this._connectPromise;
    }

    this._reconnectPromise = Promise.resolve().then(() => {
      this.debug('Pioneer API - reconnect() - Reconnecting');
      return this._disconnect()
        .catch(err => {
          this.debug('Pioneer API - reconnect() - Disconnection error:', err);
        })
        .then(() => {
          // timeout is required otherwise the pioneer did not release the port
          // after disconnect before new connect
          return new Promise(((resolve, reject) => {
            setTimeout(() => resolve(), 100);
          }));
        })
        .then(() => {
          return this._connect();
        })
        .then(() => {
          this.debug('Pioneer API - reconnect() - Reconnected');
          this._reconnectPromise = null;
        })
        .catch(err => {
          this.debug('Pioneer API - reconnect() - Error:', err);
          this._reconnectPromise = null;
          throw Error(`Reconnection error${err}`);
        });
    });
    return this._reconnectPromise;
  }

  _parseRXBuffer() {
    // TODO for loop instead of recalling the _parseRXBuffer again at the end??
    const rxBufferArr = this._rxBuffer.split(DELIMITER);
    if (rxBufferArr.length > 1) {
      const rxBufferItem = rxBufferArr.shift();
      this._rxBuffer = rxBufferArr.join(DELIMITER);

      this.debug(`Pioneer API - _parseRXBuffer() - string: ${rxBufferItem}`);
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

  _sleep(ms)
  {
    return new Promise(resolve => setTimeout(resolve,ms));
  }

  async sendCommand(command) {
    this.debug(`Pioneer API - sendCommand() - ${command}`);  

    if (this._state !== 'connected') {
      // TODO: Just reconnect and then send??
      return Promise.reject(new Error('Not connected with device'));
    }

    await this._sleep(20); // TODO: A send queue should be added?
    this._socket.write(`${command}\r`)
    
    return Promise.resolve();
  }

  _setState(state) {
    this._state = state;
    this.debug(`Pioneer API - _setState(): ${state}`);
  }

}

module.exports = PioneerAPI;
