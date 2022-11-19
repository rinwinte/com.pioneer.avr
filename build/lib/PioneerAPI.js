const { EventEmitter } = require('events');
const net = require('net');

const DELIMITER = '\r\n';

const ConnectionState = Object.freeze({
  Diconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Disconnecting: 'Disconnecting',
});

class PioneerAPI extends EventEmitter {

  constructor({ ipAddress, port }) {
    super();

    this.port = port;
    this.model = 'VSX';

    this.ipAddress = ipAddress;
    this._state = ConnectionState.Disconnected;
    this._rxBuffer = '';
    this._txBuffer = [];
    this._tranceiveBusy = false;

    this._reconnectPromise = null;
    this._connectPromise = null;

    this._timer = null;
  }

  debug(...props) {
    // console.log('[Debug]', `[${new Date()}]`, ...props);
  }

  async setIPAddress(ipAddress) {
    this.debug(`Pioneer API - setIPAddress() - ${ipAddress}`);

    if (ipAddress !== this.ipAddress) {
      if (net.isIPv4(ipAddress)) {
        this.ipAddress = ipAddress;
        await this.disconnect();
        await this.connect();
        return Promise.resolve();
      }
    }

    return Promise.reject(new Error('Not a valid IP adress'));
  }

  async setPort(port) {
    this.port = port;
    await this.disconnect();
    await this.connect();
    Promise.resolve();
  }

  async connect() {
    this.debug('Pioneer API - connect()');

    return this._connect();
  }

  async _connect() {
    this.debug('Pioneer API - _connect()');

    if (this._state === ConnectionState.Connected) {
      this.debug('Pioneer API - _connect()  - Already connected');
      return Promise.resolve();
    }

    if (this._state === ConnectionState.Connecting) {
      this.debug('Pioneer API - _connect()  - Busy connecting');
      return this._connectPromise;
    }

    if (this._state === ConnectionState.Disconnecting) {
      this.debug('Pioneer API - _connect()  - Busy disconnecting');
      try {
        await this._disconnectPromise;
        await new Promise(resolve => process.nextTick(resolve));
      } catch (err) {}
    }

    this._connectPromise = new Promise((resolve, reject) => {
      this._setState(ConnectionState.Connecting);

      this._socket = new net.Socket();
      this._socket
        .setTimeout(40000) /// 40s timeout
        .once('connect', () => {
          this.debug('Pioneer API - Socket onConnect');
          this._tranceiveBusy = false;
          this._rxBuffer = [];
          this._txBuffer = [];
        })
        .on('error', err => {
          this._socket.destroy();
          this.debug('Pioneer API - Socket onError ', err);
          this._reconnectPromise = null;
          this._connectPromise = null;
          return reject(err);
        })
        .on('timeout', () => {
          this.debug('Pioneer API - Socket onTimeout');
          this._socket.destroy();
          this.emit('timeoutError');
          this._reconnectPromise = null;
          this._connectPromise = null;
          return reject(new Error('Socket timeout'));
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
          this._setState(ConnectionState.Disconnected);
          reject(new Error('Closed'));
        })
        .on('data', data => {
          if (this._state !== ConnectionState.Connected) {
            this._setState(ConnectionState.Connected);
          }
          this._rxBuffer += data;
          this._parseRXBuffer();

          clearTimeout(this._timer);
          // If there is a command on the transmit queue send it
          this._sendCommand();
        })
        .connect(this.port, this.ipAddress, () => {
          this.debug('Pioneer API - `Socket onConnect Callback');
          this._setState(ConnectionState.Connected);

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

    if (this._state === ConnectionState.Disconnected) {
      this.debug('Pioneer API - already disconnected');
      return Promise.resolve();
    }

    if (this._state === ConnectionState.Connecting) {
      try {
        await this._connectPromise;
      } catch (err) {}
    }

    this._setState(ConnectionState.Disconnecting);

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
    this.debug('Pioneer API - reconnect(): ', this._reconnectPromise);

    if (this._reconnectPromise !== null) {
      this.debug('Pioneer API - reconnect() - Return previous reconnect promise');
      return this._reconnectPromise;
    }

    if (this._connectPromise !== null) {
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
          // Timeout is required otherwise the pioneer does not release the port
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
          throw Error(`Reconnection error ${err}`);
        });
    });
    return this._reconnectPromise;
  }

  _parseRXBuffer() {
    const rxBufferArr = this._rxBuffer.split(DELIMITER);

    for (let charNum = 0; charNum < rxBufferArr.length; charNum++) {
      const rxBufferItem = rxBufferArr.shift();
      this._rxBuffer = rxBufferArr.join(DELIMITER);

      const event = rxBufferItem.match(/[A-Z]{1}[A-Z2]{0,1}[A-Z]{0,3}/);
      const data = rxBufferItem.split(/[A-Z]{1}[A-Z2]{0,1}[A-Z]{0,3}(.+)/)[1];

      if (event !== null && data) {
        this.emit('event', {
          event,
          data,
        });
        this.emit(event, data);
      }

      this._tranceiveBusy = false;
    }
  }

  _sendCommand() {
    if (this._socket != null && this._socket.readyState === 'open' && !this._tranceiveBusy && this._txBuffer.length > 0) {
      const that = this;

      this._timer = setTimeout(() => {
        that._transceiveBusy = false;
        this.emit('sendCommandTimeout');
      }, 500);

      this._tranceiveBusy = true;

      const item = this._txBuffer.shift();
      this.debug(`Pioneer API - _sendCommand(): ${item}`);
      this._socket.write(`${item}\r`);
    }
  }

  async sendCommand(command) {
    this.debug(`Pioneer API - sendCommand(): ${command}`);

    if (this._state === ConnectionState.Connecting) {
      await this._connect();
    } else if (this._state !== ConnectionState.Connected) {
      return Promise.reject(new Error('Not connected with device'));
    }

    this._txBuffer.push(command);

    this._sendCommand();

    return Promise.resolve();
  }

  _setState(state) {
    this._state = state;
    this.debug(`Pioneer API - _setState(): ${state}`);
  }

  getState() {
    return this._state;
  }

}

module.exports = PioneerAPI;
