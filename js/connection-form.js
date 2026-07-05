/**
 * ConnectionForm - 管理 SSH 连接配置表单
 * 提供表单值的读取、状态切换、认证方式切换等功能
 */
class ConnectionForm {
  constructor(formId) {
    this.form = document.getElementById(formId);
    if (!this.form) {
      throw new Error('未找到表单元素: #' + formId);
    }

    this.host = document.getElementById('host');
    this.port = document.getElementById('port');
    this.username = document.getElementById('username');
    this.authType = document.getElementById('auth-type');
    this.password = document.getElementById('password');
    this.privateKey = document.getElementById('private-key');
    this.passwordGroup = document.getElementById('password-group');
    this.keyGroup = document.getElementById('key-group');
    this.wsUrl = document.getElementById('ws-url');
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

  /** @private 设置表单事件监听 */
  _setupEventListeners() {
    // 表单提交 → 连接
    this.form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (this._connectHandler) {
        this._connectHandler(this.getValues());
      }
    }.bind(this));

    // 断开按钮
    this.disconnectBtn.addEventListener('click', function() {
      if (this._disconnectHandler) {
        this._disconnectHandler();
      }
    }.bind(this));

    // 认证方式切换
    this.authType.addEventListener('change', function() {
      this._updateAuthFields();
    }.bind(this));
  }

  /** @private 根据认证方式切换显示密码/私钥字段 */
  _updateAuthFields() {
    var isPassword = this.authType.value === 'password';
    this.passwordGroup.style.display = isPassword ? '' : 'none';
    this.keyGroup.style.display = isPassword ? 'none' : '';
    this.password.required = isPassword;
    this.password.disabled = !isPassword;
    this.privateKey.required = !isPassword;
    this.privateKey.disabled = isPassword;
  }

  /**
   * 注册连接回调
   * @param {Function} callback - 接收配置对象 {host, port, username, password|privateKey, wsUrl}
   */
  onConnect(callback) {
    this._connectHandler = callback;
  }

  /**
   * 注册断开回调
   * @param {Function} callback
   */
  onDisconnect(callback) {
    this._disconnectHandler = callback;
  }

  /**
   * 更新连接状态显示
   * @param {string} text - 状态文本
   * @param {'disconnected'|'connecting'|'connected'|'error'} state - CSS 类名后缀
   */
  setStatus(text, state) {
    this.connectionStatus.textContent = text;
    this.connectionStatus.className = 'status-' + state;
  }

  /**
   * 切换连接/断开状态下的 UI
   * @param {boolean} connected - 是否已连接
   */
  setConnected(connected) {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;

    // 连接时禁用所有输入框
    var inputs = this.form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (input !== this.connectBtn && input !== this.disconnectBtn) {
        input.disabled = connected;
      }
    }

    // 连接时折叠面板
    if (connected) {
      this.connectionPanel.classList.add('connected');
    } else {
      this.connectionPanel.classList.remove('connected');
    }
  }

  /**
   * 获取当前表单值
   * @returns {{host: string, port: number, username: string, password?: string, privateKey?: string, wsUrl?: string}}
   */
  getValues() {
    var values = {
      host: this.host.value.trim(),
      port: parseInt(this.port.value, 10),
      username: this.username.value.trim()
    };

    if (this.authType.value === 'password') {
      values.password = this.password.value;
    } else {
      values.privateKey = this.privateKey.value;
    }

    // 自定义 WebSocket URL（可选）
    var wsUrlVal = this.wsUrl.value.trim();
    if (wsUrlVal) {
      values.wsUrl = wsUrlVal;
    }

    return values;
  }
}
