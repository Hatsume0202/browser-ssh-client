/**
 * SSHClient - manages an SSH connection via a WebSocket proxy.
 * Runs entirely in the browser. Uses WebSocketClient from a global script tag.
 */
class SSHClient {
  static STATUS_DISCONNECTED = 'disconnected';
  static STATUS_CONNECTING = 'connecting';
  static STATUS_CONNECTED = 'connected';
  static STATUS_ERROR = 'error';

  constructor() {
    this._status = SSHClient.STATUS_DISCONNECTED;
    this._ws = null;
    this._config = null;
    this._dataCallbacks = [];
    this._statusCallbacks = [];
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 3;
    this._reconnectDelay = 2000;
    this._reconnectTimeout = null;
  }

  /**
   * Connect via WebSocket proxy.
   * @param {Object} config - {host, port, username, password?, privateKey?, wsUrl?}
   */
  connect(config) {
    this._config = config;
    this._setStatus(SSHClient.STATUS_CONNECTING);

    // Determine WebSocket URL
    let wsUrl;
    if (config.wsUrl) {
      wsUrl = config.wsUrl;
    } else {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = protocol + '//' + location.host + '/ws';
    }

    this._ws = new WebSocketClient(wsUrl);

    const self = this;

    this._ws.onOpen = function () {
      // Build auth payload with provided credentials
      const authMsg = {
        type: 'connect',
        host: config.host,
        port: config.port,
        username: config.username
      };
      if (config.password) {
        authMsg.password = config.password;
      } else if (config.privateKey) {
        authMsg.privateKey = config.privateKey;
      }
      self._ws.send(JSON.stringify(authMsg));
      self._setStatus(SSHClient.STATUS_CONNECTED);
      self._reconnectAttempts = 0;
    };

    this._ws.onMessage = function (data) {
      for (let i = 0; i < self._dataCallbacks.length; i++) {
        self._dataCallbacks[i](data);
      }
    };

    this._ws.onError = function () {
      self._setStatus(SSHClient.STATUS_ERROR);
      self._scheduleReconnect();
    };

    this._ws.onClose = function () {
      if (self._status === SSHClient.STATUS_CONNECTED || self._status === SSHClient.STATUS_CONNECTING) {
        self._scheduleReconnect();
      }
    };

    this._ws.connect();
  }

  /**
   * Disconnect from the SSH session.
   */
  disconnect() {
    this._cleanupReconnectTimeout();

    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }

    this._reconnectAttempts = 0;
    this._config = null;
    this._setStatus(SSHClient.STATUS_DISCONNECTED);
  }

  /**
   * Send data through the WebSocket.
   * @param {string} data
   */
  send(data) {
    if (this._ws && this._ws.ws && this._ws.ws.readyState === WebSocket.OPEN) {
      this._ws.send(data);
    }
    // Silently ignore if not connected
  }

  /**
   * Send terminal resize information.
   * @param {number} cols
   * @param {number} rows
   */
  resize(cols, rows) {
    if (this._ws && this._ws.ws && this._ws.ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'resize', cols: cols, rows: rows }));
    }
  }

  /**
   * Register a callback for incoming data.
   * @param {Function} callback - receives data string
   * @returns {Function} unsubscribe function
   */
  onData(callback) {
    this._dataCallbacks.push(callback);
    const self = this;
    return function () {
      const idx = self._dataCallbacks.indexOf(callback);
      if (idx !== -1) {
        self._dataCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Register a callback for status changes.
   * @param {Function} callback - receives (status, message?)
   * @returns {Function} unsubscribe function
   */
  onStatus(callback) {
    this._statusCallbacks.push(callback);
    // Immediately notify of current status
    callback(this._status);
    const self = this;
    return function () {
      const idx = self._statusCallbacks.indexOf(callback);
      if (idx !== -1) {
        self._statusCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Update the internal status and notify all registered status callbacks.
   * @param {string} status
   * @param {string} [message]
   */
  _setStatus(status, message) {
    this._status = status;
    for (let i = 0; i < this._statusCallbacks.length; i++) {
      this._statusCallbacks[i](status, message);
    }
  }

  /**
   * Attempt to reconnect after a delay.
   * Notifies callbacks with a 'reconnecting' status during the attempt.
   */
  _scheduleReconnect() {
    if (this._reconnectTimeout) {
      return; // Already scheduled
    }

    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      this._setStatus('reconnecting', 'Attempt ' + this._reconnectAttempts + ' of ' + this._maxReconnectAttempts);

      const self = this;
      this._reconnectTimeout = setTimeout(function () {
        self._reconnectTimeout = null;
        if (self._config) {
          self.connect(self._config);
        }
      }, this._reconnectDelay);
    } else {
      this._setStatus(SSHClient.STATUS_DISCONNECTED, 'Connection failed after ' + this._maxReconnectAttempts + ' attempts');
    }
  }

  /**
   * Clear any pending reconnect timeout to prevent memory leaks.
   */
  _cleanupReconnectTimeout() {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  }
}

// Expose globally for browser script-tag use
window.SSHClient = SSHClient;
