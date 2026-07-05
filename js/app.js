(function () {
  'use strict';

  // WebSocket URL: by default connect to same host with /ws path
  // Can be overridden by setting window.__WS_URL before loading this script
  const WS_URL = window.__WS_URL || (function() {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return protocol + '//' + loc.hostname + ':' + loc.port + '/ws';
  })();
  
  let wsClient = null;
  let terminal = null;
  let resizeObserver = null;

  /**
   * 清理终端、ResizeObserver 和 WebSocket 引用
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
   * DOM 加载完成后初始化应用
   */
  function initialize() {
    var form = new ConnectionForm('connection-form');

    form.onConnect(function (config) {
      // 清理之前的会话
      if (wsClient) {
        wsClient.close();
        wsClient = null;
      }
      cleanupTerminal();

      form.setConnected(true);
      form.setStatus('Connecting...', 'connecting');

      // 创建终端并显示连接信息
      terminal = new TerminalUI('terminal');
      terminal.write('\x1b[32m正在连接 ' + config.host + ':' + config.port + '...\r\n\x1b[0m');

      // 显示终端容器
      document.getElementById('terminal-container').style.display = 'block';

      // 创建 WebSocket 连接
      wsClient = new WebSocketClient(config.wsUrl || WS_URL);

      wsClient.onOpen = function () {
        // 发送连接认证信息
        var msg = {
          type: 'connect',
          host: config.host,
          port: config.port,
          username: config.username
        };
        if (config.password) {
          msg.password = config.password;
        } else if (config.privateKey) {
          msg.privateKey = config.privateKey;
        }
        wsClient.send(JSON.stringify(msg));
        form.setStatus('已连接', 'connected');
        terminal.focus();
      };

      wsClient.onMessage = function (data) {
        terminal.write(data);
      };

      wsClient.onError = function () {
        form.setStatus('连接出错', 'error');
        terminal.write('\x1b[31mWebSocket 连接失败！请确保代理服务器正在运行。\r\n\x1b[0m');
      };

      wsClient.onClose = function (code, reason) {
        form.setConnected(false);
        if (terminal) {
          var msg = '\x1b[33m连接已断开';
          if (reason) {
            msg += ': ' + reason;
          }
          msg += ' (code: ' + code + ')\r\n\x1b[0m';
          terminal.write(msg);
        }
        cleanupTerminal();
      };

      // 注册终端输入处理器：用户输入 → WebSocket → SSH
      terminal.onData(function (data) {
        wsClient.send(data);
      });

      // 监听终端容器大小变化，自动调整终端尺寸
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
      form.setStatus('已断开', 'disconnected');
      document.getElementById('terminal-container').style.display = 'none';
      cleanupTerminal();
    });
  }

  // 等待 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
