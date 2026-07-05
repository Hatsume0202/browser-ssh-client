/**
 * WebSocketClient - a wrapper around the native WebSocket API for SSH terminal communication.
 */
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
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
   * Opens the WebSocket connection and attaches all event listeners.
   * If the WebSocket constructor throws, onError is called with the exception.
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      if (typeof this._onError === 'function') {
        this._onError(err);
      }
      return;
    }

    this.ws.onopen = (event) => {
      if (typeof this._onOpen === 'function') {
        this._onOpen(event);
      }
    };

    this.ws.onmessage = (event) => {
      if (typeof this._onMessage === 'function') {
        this._onMessage(event.data);
      }
    };

    this.ws.onerror = (event) => {
      if (typeof this._onError === 'function') {
        this._onError(event);
      }
    };

    this.ws.onclose = (event) => {
      if (typeof this._onClose === 'function') {
        this._onClose(event.code, event.reason);
      }
    };
  }

  /**
   * Sends a string of data over the WebSocket connection.
   * @param {string} data
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocketClient: cannot send — connection is not open');
    }
  }

  /**
   * Closes the WebSocket connection.
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Returns whether the WebSocket connection is currently open.
   * @returns {boolean}
   */
  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

