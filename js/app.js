(function () {
  'use strict';

  /**
   * BrowserSSHApp - Main application coordinator.
   * Connects all modules (ConnectionForm, TerminalUI, SSHClient, SimulatedShell)
   * and manages state transitions between disconnected, SSH-connected, and demo modes.
   */
  class BrowserSSHApp {
    constructor() {
      this.terminal = null;
      this.connectionForm = null;
      this.sshClient = null;
      this.simulatedShell = null;
      this.mode = null; // 'ssh' | 'demo' | null

      this._dataHandler = null;
      this._resizeHandler = null;
      this._unsubscribeSSHData = null;
      this._unsubscribeSSHStatus = null;
      this._unsubscribeDemoOutput = null;

      this._init();
    }

    // -----------------------------------------------------------------------
    // Private: Initialization
    // -----------------------------------------------------------------------

    /** @private Initialize the application and wire all modules together. */
    _init() {
      var self = this;

      // 1. Create ConnectionForm instance
      this.connectionForm = new ConnectionForm('connection-form');

      // 2. Show terminal-container (it starts hidden per HTML) so TerminalUI
      //    can mount and calculate correct dimensions.
      this._showTerminalContainer();

      // 3. Create TerminalUI instance (mounts to #terminal)
      this.terminal = new TerminalUI('terminal');
      this.terminal.write('\x1b[32m终端就绪，请连接 SSH 或启动演示模式\x1b[0m\r\n');

      // 4. Register form callbacks
      this.connectionForm.onConnect(function (config) {
        if (config.wsUrl && config.wsUrl.trim() !== '') {
          // WebSocket URL filled -> try SSH proxy
          self._connectSSH(config);
        } else {
          // WebSocket URL empty -> auto-enter demo mode
          self._startDemoMode();
        }
      });

      this.connectionForm.onDisconnect(function () {
        self._disconnect();
      });

      // Look for a "demo mode" button (#demo-btn or [data-action="demo"])
      // and wire it to start demo mode directly
      this._wireDemoButton();

      // 5. Set initial status
      this.connectionForm.setStatus('⏹️ 未连接', 'disconnected');

      // Initial fit after the container is visible
      this._deferFit();
    }

    /** @private Find a demo-mode button and attach a click handler. */
    _wireDemoButton() {
      var btn = document.getElementById('demo-btn') ||
                document.querySelector('[data-action="demo"]');
      if (!btn) return;
      var self = this;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        self._startDemoMode();
      });
    }

    // -----------------------------------------------------------------------
    // Private: SSH Connection
    // -----------------------------------------------------------------------

    /**
     * @private Connect to a remote host via the WebSocket SSH proxy.
     * @param {Object} config - Connection configuration from the form.
     */
    _connectSSH(config) {
      // Clean up any previous session first
      this._cleanupSession();

      // Validate that required fields are present
      if (!config.host || !config.port) {
        this.connectionForm.setStatus('❌ 请填写主机地址和端口', 'error');
        return;
      }

      // Set status to connecting
      this.connectionForm.setStatus('🔄 连接中...', 'connecting');

      // Ensure terminal container is visible
      this._showTerminalContainer();

      // Register terminal data/resize forwarding (these will be re-registered
      // each time, and TerminalUI.dispose() cleans up the old ones internally)
      var self = this;
      this.terminal.onData(function (data) {
        self._handleTerminalData(data);
      });
      this.terminal.onResize(function (cols, rows) {
        self._handleTerminalResize(cols, rows);
      });

      // Fit and clear terminal for fresh session
      this.terminal.fit();
      this.terminal.reset();

      // Create the SSH client
      this.sshClient = new SSHClient();

      // Register SSHClient callbacks
      this._unsubscribeSSHData = this.sshClient.onData(function (data) {
        if (self.terminal) {
          self.terminal.write(data);
        }
      });

      this._unsubscribeSSHStatus = this.sshClient.onStatus(function (status, message) {
        self._handleSSHStatus(status, message);
      });

      // Initiate connection
      this.sshClient.connect(config);

      // Save connection to history (delegates to ConnectionForm)
      try {
        this.connectionForm._saveConnectionHistory(config);
      } catch (e) {
        // Silently ignore storage errors
      }

      // Set mode
      this.mode = 'ssh';
    }

    /**
     * @private Handle status changes from the SSH client.
     * @param {string} status - Status string (disconnected|connecting|connected|error|reconnecting).
     * @param {string} [message] - Optional status message.
     */
    _handleSSHStatus(status, message) {
      switch (status) {
        case 'disconnected':
          this.connectionForm.setConnected(false);
          this.connectionForm.setStatus('⏹️ 未连接', 'disconnected');
          this.mode = null;
          if (this.terminal) {
            this.terminal.write('\r\n\x1b[33m连接已断开\x1b[0m\r\n');
          }
          break;

        case 'connecting':
          this.connectionForm.setStatus('🔄 连接中...', 'connecting');
          break;

        case 'connected':
          this.connectionForm.setConnected(true);
          // Host is tracked from the config; status message doesn't need it here.
          this.connectionForm.setStatus('✅ 已连接', 'connected');
          if (this.terminal) {
            this.terminal.focus();
          }
          break;

        case 'error':
          this.connectionForm.setConnected(false);
          this.connectionForm.setStatus('❌ ' + (message || '连接出错'), 'error');
          if (this.terminal) {
            this.terminal.write('\x1b[31m连接失败：' + (message || '未知错误') + '\x1b[0m\r\n');
          }
          break;

        case 'reconnecting':
          this.connectionForm.setStatus('🔄 重新连接中 (' + message + ')', 'connecting');
          if (this.terminal) {
            this.terminal.write('\x1b[33m正在重新连接...\x1b[0m\r\n');
          }
          break;

        default:
          this.connectionForm.setStatus(status || '', 'disconnected');
          break;
      }
    }

    // -----------------------------------------------------------------------
    // Private: Demo / Simulated Mode
    // -----------------------------------------------------------------------

    /** @private Start the demo (simulated) terminal session. */
    _startDemoMode() {
      // If a session is active, clean it up first
      if (this.mode !== null) {
        this._cleanupSession();
      }

      // Ensure terminal container is visible
      this._showTerminalContainer();

      // Ensure terminal exists
      if (!this.terminal) {
        this.terminal = new TerminalUI('terminal');
      }

      // Reset and prepare terminal
      this.terminal.reset();
      this.terminal.fit();
      this.terminal.focus();

      // Register terminal data forwarding for demo mode
      var self = this;
      this.terminal.onData(function (data) {
        self._handleTerminalData(data);
      });

      // Check that SimulatedShell is loaded
      if (typeof SimulatedShell === 'undefined') {
        this.connectionForm.setStatus('❌ 演示模式不可用', 'error');
        if (this.terminal) {
          this.terminal.write('\x1b[31m错误：模拟终端模块未加载\x1b[0m\r\n');
        }
        return;
      }

      // Create SimulatedShell
      this.simulatedShell = new SimulatedShell();

      // Register shell output -> terminal write
      this._unsubscribeDemoOutput = this.simulatedShell.onOutput(function (data) {
        if (self.terminal) {
          self.terminal.write(data);
        }
      });

      // Start the shell (shows welcome banner etc.)
      try {
        this.simulatedShell.connect();
      } catch (err) {
        this.connectionForm.setStatus('❌ 演示模式启动失败', 'error');
        if (this.terminal) {
          this.terminal.write('\x1b[31m演示模式启动失败：' + err.message + '\x1b[0m\r\n');
        }
        this.simulatedShell = null;
        return;
      }

      // Update form UI for demo mode
      this.connectionForm.setConnected(true);
      this.connectionForm.setStatus('🎮 演示模式', 'connected');

      this.mode = 'demo';
    }

    // -----------------------------------------------------------------------
    // Private: Disconnect & Cleanup
    // -----------------------------------------------------------------------

    /** @private Disconnect the current session and reset UI state. */
    _disconnect() {
      this._cleanupSession();

      // Reset form
      this.connectionForm.setConnected(false);
      this.connectionForm.setStatus('⏹️ 未连接', 'disconnected');

      // Keep terminal visible with a notice
      if (this.terminal) {
        this.terminal.write('\r\n⏹️ 已断开连接\r\n');
      }

      this.mode = null;
    }

    /**
     * @private Tear down the current session's resources without touching the form state.
     * Safely handles any mode (ssh, demo, or null).
     */
    _cleanupSession() {
      // Disconnect SSH client if in SSH mode
      if (this.mode === 'ssh' && this.sshClient) {
        try {
          this.sshClient.disconnect();
        } catch (e) {
          console.warn('BrowserSSHApp: error disconnecting SSH client:', e);
        }
        this.sshClient = null;
      }

      // Disconnect simulated shell if in demo mode
      if (this.mode === 'demo' && this.simulatedShell) {
        try {
          this.simulatedShell.disconnect();
        } catch (e) {
          console.warn('BrowserSSHApp: error disconnecting simulated shell:', e);
        }
        this.simulatedShell = null;
      }

      // Unsubscribe SSHClient callbacks
      if (this._unsubscribeSSHData) {
        try { this._unsubscribeSSHData(); } catch (e) { /* ignore */ }
        this._unsubscribeSSHData = null;
      }
      if (this._unsubscribeSSHStatus) {
        try { this._unsubscribeSSHStatus(); } catch (e) { /* ignore */ }
        this._unsubscribeSSHStatus = null;
      }

      // Unsubscribe demo shell output
      if (this._unsubscribeDemoOutput) {
        try { this._unsubscribeDemoOutput(); } catch (e) { /* ignore */ }
        this._unsubscribeDemoOutput = null;
      }

      // Reset terminal display (but keep the terminal instance alive)
      if (this.terminal) {
        try {
          this.terminal.reset();
        } catch (e) {
          console.warn('BrowserSSHApp: error resetting terminal:', e);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Private: Terminal I/O Routing
    // -----------------------------------------------------------------------

    /**
     * @private Route terminal input to the active session.
     * @param {string} data - The data chunk from the user's keyboard.
     */
    _handleTerminalData(data) {
      if (this.mode === 'ssh' && this.sshClient) {
        try {
          this.sshClient.send(data);
        } catch (e) {
          console.warn('BrowserSSHApp: sshClient.send failed:', e);
        }
      } else if (this.mode === 'demo' && this.simulatedShell) {
        try {
          this.simulatedShell.handleInput(data);
        } catch (e) {
          console.warn('BrowserSSHApp: simulatedShell.handleInput failed:', e);
        }
      }
    }

    /**
     * @private Route terminal resize to the active session (SSH only).
     * @param {number} cols - New number of columns.
     * @param {number} rows - New number of rows.
     */
    _handleTerminalResize(cols, rows) {
      if (this.mode === 'ssh' && this.sshClient) {
        try {
          this.sshClient.resize(cols, rows);
        } catch (e) {
          console.warn('BrowserSSHApp: sshClient.resize failed:', e);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Private: Helpers
    // -----------------------------------------------------------------------

    /** @private Show the terminal-container by removing display:none. */
    _showTerminalContainer() {
      var el = document.getElementById('terminal-container');
      if (el) {
        el.style.display = 'block';
      }
    }

    /**
     * @private Defer a terminal fit() call to the next animation frame
     * so the container has a chance to lay out after being shown.
     */
    _deferFit() {
      var self = this;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(function () {
          if (self.terminal) {
            self.terminal.fit();
          }
        });
      } else {
        setTimeout(function () {
          if (self.terminal) {
            self.terminal.fit();
          }
        }, 50);
      }
    }

  }

  // Expose globally
  window.BrowserSSHApp = BrowserSSHApp;

  // Auto-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window._browserSSH = new BrowserSSHApp();
    });
  } else {
    window._browserSSH = new BrowserSSHApp();
  }
})();
