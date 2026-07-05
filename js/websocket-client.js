/**
 * WebSocketClient - a wrapper around the native WebSocket API for SSH terminal communication.
 * Runs entirely in the browser using the native WebSocket API.
 * Features: auto-reconnect with exponential backoff, heartbeats, connection timeout.
 */
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 3;
    this._reconnectDelay = 2000;
    this._connectTimeout = 15000; // 15 second connection timeout
    this._heartbeatInterval = 30000; // 30 second heartbeat
    this._heartbeatTimer = null;
    this._connectTimer = null;
    this._reconnectTimer = null;
    this._manualClose = false; // flag to distinguish manual close from error close
    this._lastPingTime = 0;
    // Callbacks
    this._onOpen = null;
    this._onMessage = null;
    this._onError = null;
    this._onClose = null;
    this._onReconnecting = null;
    this._onReconnectFailed = null;
  }

  /**
   * @param {Function} callback
   */
  set onOpen(callback) {
    this._onOpen = callback;
  }

  get onOpen() {
    return this._onOpen;
  }

  /**
   * @param {Function} callback
   */
  set onMessage(callback) {
    this._onMessage = callback;
  }

  get onMessage() {
    return this._onMessage;
  }

  /**
   * @param {Function} callback
   */
  set onError(callback) {
    this._onError = callback;
  }

  get onError() {
    return this._onError;
  }

  /**
   * @param {Function} callback - receives (code, reason) extracted from CloseEvent
   */
  set onClose(callback) {
    this._onClose = callback;
  }

  get onClose() {
    return this._onClose;
  }

  /**
   * @param {Function} callback - receives (attemptNumber, maxAttempts)
   */
  set onReconnecting(callback) {
    this._onReconnecting = callback;
  }

  get onReconnecting() {
    return this._onReconnecting;
  }

  /**
   * @param {Function} callback
   */
  set onReconnectFailed(callback) {
    this._onReconnectFailed = callback;
  }

  get onReconnectFailed() {
    return this._onReconnectFailed;
  }

  /**
   * Opens the WebSocket connection and attaches all event listeners.
   * If the WebSocket constructor throws, onError is called with the exception.
   */
  connect() {
    try {
      this._manualClose = false;
      this._clearTimers();

      this.ws = new WebSocket(this.url);

      // Connection timeout — if connection doesn't open in 15s, close and trigger reconnect
      this._connectTimer = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.warn('WebSocketClient: connection timeout');
          try {
            this.ws.close();
          } catch (e) {
            // ws may already be closing
          }
        }
      }, this._connectTimeout);

      this.ws.onopen = (event) => this._onOpenHandler(event);
      this.ws.onmessage = (event) => this._onMessageHandler(event.data);
      this.ws.onclose = (event) => this._onCloseHandler(event);
      this.ws.onerror = (event) => this._onErrorHandler(event);
    } catch (err) {
      console.warn('WebSocketClient: failed to create WebSocket', err);
      if (typeof this._onError === 'function') {
        try {
          this._onError(err);
        } catch (e) {
          console.warn('WebSocketClient: onError callback error', e);
        }
      }
      if (!this._manualClose) {
        this._scheduleReconnect();
      }
    }
  }

  /**
   * Sends a string of data over the WebSocket connection.
   * @param {string} data
   * @returns {boolean} whether the data was sent
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
        return true;
      } catch (err) {
        console.warn('WebSocketClient: send error', err);
        return false;
      }
    }
    console.warn('WebSocketClient: cannot send — connection is not open');
    return false;
  }

  /**
   * Closes the WebSocket connection.
   */
  close() {
    this._manualClose = true;
    this._stopHeartbeat();
    this._clearReconnectTimer();
    this._clearConnectTimer();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ws may already be closing
      }
    }
  }

  /**
   * Returns whether the WebSocket connection is currently open.
   * @returns {boolean}
   */
  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ---- Internal Handlers ----

  /**
   * Internal onopen handler.
   * Clears connection timeout, starts heartbeat, resets reconnect counter.
   */
  _onOpenHandler(event) {
    try {
      this._clearConnectTimer();
      this._reconnectAttempts = 0;
      this._startHeartbeat();
      if (typeof this._onOpen === 'function') {
        this._onOpen(event);
      }
    } catch (err) {
      console.warn('WebSocketClient: _onOpenHandler error', err);
    }
  }

  /**
   * Internal onmessage handler.
   * Intercepts '{"type":"pong"}' heartbeats and discards them from user callbacks.
   */
  _onMessageHandler(data) {
    try {
      // Check for heartbeat pong
      try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.type === 'pong') {
          this._lastPingTime = Date.now();
          return; // Do not forward pong to user callback
        }
      } catch (e) {
        // Not valid JSON — treat as normal message
      }

      if (typeof this._onMessage === 'function') {
        this._onMessage(data);
      }
    } catch (err) {
      console.warn('WebSocketClient: _onMessageHandler error', err);
    }
  }

  /**
   * Internal onclose handler.
   * Distinguishes manual close from error close to decide whether to reconnect.
   */
  _onCloseHandler(event) {
    try {
      this._stopHeartbeat();
      this._clearConnectTimer();

      if (!this._manualClose) {
        this._scheduleReconnect();
      } else {
        if (typeof this._onClose === 'function') {
          this._onClose(event.code, event.reason);
        }
      }
    } catch (err) {
      console.warn('WebSocketClient: _onCloseHandler error', err);
    }
  }

  /**
   * Internal onerror handler.
   * Forwards the event to the user-provided onError callback.
   */
  _onErrorHandler(event) {
    try {
      if (typeof this._onError === 'function') {
        this._onError(event);
      }
    } catch (err) {
      console.warn('WebSocketClient: _onErrorHandler error', err);
    }
  }

  // ---- Reconnection Logic ----

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * Notifies the onReconnecting callback and manages attempt limit.
   */
  _scheduleReconnect() {
    try {
      this._reconnectAttempts++;

      if (this._reconnectAttempts > this._maxReconnectAttempts) {
        // All attempts exhausted — notify failure
        if (typeof this._onReconnectFailed === 'function') {
          try {
            this._onReconnectFailed();
          } catch (e) {
            console.warn('WebSocketClient: onReconnectFailed callback error', e);
          }
        }
        if (typeof this._onClose === 'function') {
          try {
            this._onClose(1006, 'Max reconnection attempts reached');
          } catch (e) {
            console.warn('WebSocketClient: onClose callback error', e);
          }
        }
        return;
      }

      // Notify reconnecting with attempt number and max
      if (typeof this._onReconnecting === 'function') {
        try {
          this._onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);
        } catch (e) {
          console.warn('WebSocketClient: onReconnecting callback error', e);
        }
      }

      // Exponential backoff: 2s, 4s, 6s
      const delay = this._reconnectDelay * this._reconnectAttempts;
      this._reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } catch (err) {
      console.warn('WebSocketClient: _scheduleReconnect error', err);
    }
  }

  // ---- Heartbeat ----

  /**
   * Starts the heartbeat interval that sends ping messages.
   */
  _startHeartbeat() {
    try {
      this._stopHeartbeat();
      this._heartbeatTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send('{"type":"ping"}');
          } catch (e) {
            // Connection may have dropped — next close event will handle reconnect
          }
        }
      }, this._heartbeatInterval);
    } catch (err) {
      console.warn('WebSocketClient: _startHeartbeat error', err);
    }
  }

  /**
   * Stops the heartbeat interval.
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ---- Timer Helpers ----

  _clearConnectTimer() {
    if (this._connectTimer !== null) {
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
    }
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _clearTimers() {
    this._clearConnectTimer();
    this._clearReconnectTimer();
    this._stopHeartbeat();
  }
}

// Expose as global for browser environments
window.WebSocketClient = WebSocketClient;
