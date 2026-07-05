/**
 * ConnectionForm - 管理 SSH 连接配置表单
 * 提供表单值的读取、状态切换、认证方式切换、连接历史管理等功能
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

    // NEW: History dropdown element
    this.historySelect = document.getElementById('connection-history');

    // NEW: Demo mode button
    this.demoButton = document.getElementById('demo-btn');

    // Callbacks
    this._connectHandler = null;
    this._disconnectHandler = null;
    this._demoHandler = null;

    // Initialize
    this._setupEventListeners();
    this._updateAuthFields();
    this._loadConnectionHistory();
    this._renderHistoryDropdown();
  }

  /** @private 设置表单事件监听 */
  _setupEventListeners() {
    // 表单提交 → 连接
    this.form.addEventListener('submit', function(event) {
      event.preventDefault();
      if (this._connectHandler) {
        try {
          this._connectHandler(this.getValues());
        } catch (err) {
          this.setStatus('⚠️ ' + err.message, 'error');
        }
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

    // Demo 按钮点击
    this.demoButton.addEventListener('click', function(e) {
      if (this._demoHandler) {
        this._demoHandler();
      }
    }.bind(this));

    // 连接历史选择变更 → 填充表单
    this.historySelect.addEventListener('change', function() {
      var val = this.historySelect.value;
      if (val) {
        this._populateFromHistory(val);
      }
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
   * 注册 Demo 模式回调
   * @param {Function} callback
   */
  onDemoMode(callback) {
    this._demoHandler = callback;
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

    // Demo 按钮在连接时禁用（防止连接中误触）
    if (this.demoButton) {
      this.demoButton.disabled = connected;
    }

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
   * 获取当前表单值（含校验）
   * @returns {{host: string, port: number, username: string, password?: string, privateKey?: string, wsUrl?: string}}
   * @throws 校验失败时抛出 Error
   */
  getValues() {
    var host = this.host.value.trim();
    var port = parseInt(this.port.value, 10);
    var username = this.username.value.trim();

    // 校验
    if (!host) {
      throw new Error('主机地址不能为空');
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('端口号必须在 1-65535 之间');
    }
    if (!username) {
      throw new Error('用户名不能为空');
    }
    if (this.authType.value === 'password' && !this.password.value) {
      throw new Error('密码不能为空');
    }

    var values = {
      host: host,
      port: port,
      username: username
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

  /**
   * 校验表单值，显示校验状态
   * @returns {boolean} 是否通过校验
   */
  validate() {
    try {
      this.getValues();
      this.setStatus('', 'disconnected');
      return true;
    } catch (err) {
      this.setStatus('⚠️ ' + err.message, 'error');
      return false;
    }
  }

  /**
   * 保存成功连接配置到 localStorage 历史记录
   * @param {{host: string, port: number, username: string, authType?: string}} config
   */
  _saveConnectionHistory(config) {
    if (!config || !config.host || !config.port || !config.username) {
      return;
    }

    var history = this._loadConnectionHistory();
    var authType = config.authType || this.authType.value;

    // 构建新条目
    var entry = {
      host: config.host,
      port: config.port,
      username: config.username,
      authType: authType,
      timestamp: new Date().toISOString()
    };

    // 移除重复项（相同 host+port+username）
    var filtered = [];
    for (var i = 0; i < history.length; i++) {
      var item = history[i];
      if (item.host === entry.host && item.port === entry.port && item.username === entry.username) {
        continue;
      }
      filtered.push(item);
    }

    // 新条目插入最前
    filtered.unshift(entry);

    // 最多保持 5 条
    if (filtered.length > 5) {
      filtered = filtered.slice(0, 5);
    }

    try {
      localStorage.setItem('ssh-connection-history', JSON.stringify(filtered));
    } catch (e) {
      // localStorage 不可用时静默失败
    }

    // 更新内部缓存并重新渲染
    this._history = filtered;
    this._renderHistoryDropdown();
  }

  /**
   * 从 localStorage 载入连接历史
   * @returns {Array}
   */
  _loadConnectionHistory() {
    var stored = [];
    try {
      var raw = localStorage.getItem('ssh-connection-history');
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch (e) {
      stored = [];
    }
    this._history = stored;
    return stored;
  }

  /**
   * 渲染历史记录下拉框
   */
  _renderHistoryDropdown() {
    if (!this.historySelect) {
      return;
    }

    // 清空当前选项
    this.historySelect.innerHTML = '';

    // 默认占位选项
    var defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    if (this._history && this._history.length > 0) {
      defaultOption.textContent = '📋 最近连接...';
    } else {
      defaultOption.textContent = '📋 暂无历史连接';
    }
    this.historySelect.appendChild(defaultOption);

    // 渲染历史条目
    if (this._history && this._history.length > 0) {
      for (var i = 0; i < this._history.length; i++) {
        var item = this._history[i];
        var option = document.createElement('option');
        option.value = JSON.stringify(item);
        option.textContent = item.username + '@' + item.host + ':' + item.port;
        this.historySelect.appendChild(option);
      }
      this.historySelect.style.display = '';
    } else {
      this.historySelect.style.display = 'none';
    }
  }

  /**
   * 从历史记录条目填充表单
   * @param {string} jsonValue - JSON 序列化的历史条目
   */
  _populateFromHistory(jsonValue) {
    try {
      var entry = JSON.parse(jsonValue);

      if (entry.host) {
        this.host.value = entry.host;
      }
      if (entry.port) {
        this.port.value = entry.port;
      }
      if (entry.username) {
        this.username.value = entry.username;
      }
      if (entry.authType) {
        this.authType.value = entry.authType;
        this._updateAuthFields();
      }

      // 视觉提示表单已被填充
      this.setStatus('✅ 已加载连接配置: ' + entry.username + '@' + entry.host + ':' + entry.port, 'disconnected');
    } catch (err) {
      this.setStatus('⚠️ 连接历史解析失败', 'error');
    }
  }

  /**
   * 重置表单到默认值
   */
  resetForm() {
    this.form.reset();
    this._updateAuthFields();
    this.setStatus('', 'disconnected');
    this.connectBtn.disabled = false;
    this.disconnectBtn.disabled = true;

    // 恢复所有输入框为可用
    var inputs = this.form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].disabled = false;
    }

    if (this.demoButton) {
      this.demoButton.disabled = false;
    }
  }
}

window.ConnectionForm = ConnectionForm;
