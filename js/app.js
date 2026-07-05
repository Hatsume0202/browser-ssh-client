(function () {
  'use strict';

  const WS_URL = `ws://${window.location.hostname}:${window.location.port}`;
  let wsClient = null;
  let terminal = null;
  let resizeObserver = null;

  /**
   * Cleans up the terminal, resize observer, and wsClient references.
   */
  function cleanupTerminal() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (terminal) {
      terminal.dispose();
      terminal = null;
    }
  }

  /**
   * Initializes the application once the DOM is ready.
   */
  function initialize() {
    const form = new ConnectionForm('connection-form');

    form.onConnect(function (config) {
      // Clean up any previous session before starting a new one
      if (wsClient) {
        wsClient.close();
        wsClient = null;
      }
      cleanupTerminal();

      form.setConnected(true);
      form.setStatus('Connecting...', 'connecting');

      terminal = new TerminalUI('terminal');
      terminal.write('\x1b[32mConnecting to ' + config.host + ':' + config.port + '...\r\n\x1b[0m');

      wsClient = new WebSocketClient(WS_URL);

      wsClient.onOpen = function () {
        var msg = {
          type: 'connect',
          host: config.host,
          port: config.port,
          username: config.username,
        };
        if (config.password) {
          msg.password = config.password;
        } else if (config.privateKey) {
          msg.privateKey = config.privateKey;
        }
        wsClient.send(JSON.stringify(msg));
        form.setStatus('Connected', 'connected');
        terminal.focus();
      };

      wsClient.onMessage = function (data) {
        terminal.write(data);
      };

      wsClient.onError = function () {
        form.setStatus('Connection error', 'error');
      };

      wsClient.onClose = function (code, reason) {
        form.setConnected(false);
        if (terminal) {
          terminal.write('\x1b[31mConnection closed' + (reason ? ': ' + reason : '') + '\r\n\x1b[0m');
        }
        cleanupTerminal();
      };

      terminal.onData(function (data) {
        wsClient.send(data);
      });

      var containerEl = document.getElementById('terminal');
      if (containerEl) {
        resizeObserver = new ResizeObserver(function () {
          if (terminal) {
            terminal.fit();
          }
        });
        resizeObserver.observe(containerEl);
      }

      wsClient.connect();
    });

    form.onDisconnect(function () {
      if (wsClient) {
        wsClient.close();
        wsClient = null;
      }
      form.setConnected(false);
      form.setStatus('Disconnected', 'disconnected');
      cleanupTerminal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
