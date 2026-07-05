/**
 * Manages the SSH connection configuration form.
 */
class ConnectionForm {
  constructor(formId) {
    this.form = document.getElementById(formId);
    if (!this.form) {
      throw new Error(`Form element with id "${formId}" not found`);
    }

    this.host = document.getElementById('host');
    this.port = document.getElementById('port');
    this.username = document.getElementById('username');
    this.authType = document.getElementById('auth-type');
    this.password = document.getElementById('password');
    this.privateKey = document.getElementById('private-key');
    this.passwordGroup = document.getElementById('password-group');
    this.keyGroup = document.getElementById('key-group');
    this.connectBtn = document.getElementById('connect-btn');
    this.disconnectBtn = document.getElementById('disconnect-btn');
    this.connectionStatus = document.getElementById('connection-status');
    this.terminalContainer = document.getElementById('terminal-container');
    this.connectionPanel = document.getElementById('connection-panel');

    this._connectHandler = null;
    this._disconnectHandler = null;

    this._setupEventListeners();
    this._updateAuthFields();
  }

  /** @private */
  _setupEventListeners() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this._connectHandler) {
        this._connectHandler(this.getValues());
      }
    });

    this.disconnectBtn.addEventListener('click', () => {
      if (this._disconnectHandler) {
        this._disconnectHandler();
      }
    });

    this.authType.addEventListener('change', () => {
      this._updateAuthFields();
    });
  }

  /** @private */
  _updateAuthFields() {
    const isPassword = this.authType.value === 'password';

    this.passwordGroup.style.display = isPassword ? '' : 'none';
    this.keyGroup.style.display = isPassword ? 'none' : '';

    this.password.required = isPassword;
    this.password.disabled = !isPassword;
    this.privateKey.required = !isPassword;
    this.privateKey.disabled = isPassword;
  }

  /**
   * Registers a handler for form submit.
   * @param {Function} callback - Receives config object {host, port, username, password|privateKey}
   */
  onConnect(callback) {
    this._connectHandler = callback;
  }

  /**
   * Registers a handler for disconnect button click.
   * @param {Function} callback
   */
  onDisconnect(callback) {
    this._disconnectHandler = callback;
  }

  /**
   * Updates the connection status display.
   * @param {string} text - Status message text
   * @param {'disconnected'|'connecting'|'connected'|'error'} state - CSS class suffix
   */
  setStatus(text, state) {
    this.connectionStatus.textContent = text;
    this.connectionStatus.className = `status-${state}`;
  }

  /**
   * Toggles UI between connected and disconnected states.
   * @param {boolean} connected
   */
  setConnected(connected) {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;

    // Disable form inputs while connected
    const inputs = this.form.querySelectorAll('input, select, textarea');
    for (const input of inputs) {
      if (input !== this.connectBtn && input !== this.disconnectBtn) {
        input.disabled = connected;
      }
    }

    this.terminalContainer.style.display = connected ? '' : 'none';

    if (connected) {
      this.connectionPanel.classList.add('connected');
    } else {
      this.connectionPanel.classList.remove('connected');
    }
  }

  /**
   * Returns current form values as a config object.
   * @returns {{host: string, port: number, username: string, password?: string, privateKey?: string}}
   */
  getValues() {
    const values = {
      host: this.host.value.trim(),
      port: parseInt(this.port.value, 10),
      username: this.username.value.trim(),
    };

    if (this.authType.value === 'password') {
      values.password = this.password.value;
    } else {
      values.privateKey = this.privateKey.value;
    }

    return values;
  }
}
