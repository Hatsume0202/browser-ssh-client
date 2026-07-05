# Browser SSH Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based SSH client that allows users to connect to SSH servers through a browser using a Node.js proxy and xterm.js terminal emulation.

**Architecture:** A two-tier architecture: (1) A Node.js proxy server that accepts WebSocket connections and bridges them to SSH servers via the ssh2 library, (2) A browser frontend using xterm.js for terminal emulation with a connection configuration panel. Communication flows: Browser → WebSocket → Proxy → SSH Server.

**Tech Stack:**
- Node.js 24 with built-in HTTP/WebSocket servers (no Express dependency)
- `ws` library for WebSocket server (proxy side)
- `ssh2` library for SSH connections (proxy side)
- `xterm.js` and `xterm-addon-fit` for terminal emulation (frontend)
- Vanilla JS (no framework) for frontend orchestration
- CSS custom properties for theming

**Directory Structure:**
```
browser-ssh-client/
├── proxy/
│   ├── package.json
│   ├── server.js          # HTTP + WebSocket server entry
│   ├── ssh-bridge.js      # WebSocket ↔ SSH bridge logic
│   └── test/
│       └── ssh-bridge.test.js
├── js/
│   ├── app.js             # Main app entry, initializes UI
│   ├── connection-form.js  # Connection configuration form
│   ├── terminal-ui.js      # Terminal lifecycle management
│   └── websocket-client.js # WebSocket client wrapper
├── css/
│   ├── style.css           # Layout and component styles
│   └── terminal-theme.css  # xterm.js theme overrides
├── index.html              # Main HTML page (served by proxy)
├── package.json            # Root project config
└── docs/superpowers/
    └── plans/
        └── 2026-07-05-browser-ssh-client.md
```

## Global Constraints

- Node.js >= 20 (target v24 compatibility)
- No Express or other HTTP framework — use built-in `http` + `ws` library
- All frontend JS is vanilla (no React/Vue/etc.)
- CSS uses custom properties for theming — all colors defined as variables in `:root`
- SSH passwords/keys never stored in browser storage
- Terminal must auto-resize on window resize
- Proxy must gracefully handle SSH disconnect
- All error states must render visible feedback to the user

---

### Task 1: Project Scaffolding and Root Package Setup

**Files:**
- Create: `/work/browser-ssh-client/package.json`
- Create: `/work/browser-ssh-client/proxy/package.json`
- Create: `/work/browser-ssh-client/.gitignore`
- Create: `/work/browser-ssh-client/index.html`

**Interfaces:**
- Consumes: Nothing
- Produces: Project skeleton with proper dependency declarations

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "browser-ssh-client",
  "version": "1.0.0",
  "private": true,
  "description": "Web-based SSH client with terminal emulation",
  "scripts": {
    "start": "node proxy/server.js",
    "test": "node --test proxy/test/*.test.js"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "ssh2": "^1.15.0"
  }
}
```

- [ ] **Step 2: Create proxy/package.json**

```json
{
  "name": "browser-ssh-client-proxy",
  "version": "1.0.0",
  "private": true,
  "description": "WebSocket-to-SSH proxy server"
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browser SSH Client</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css">
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/terminal-theme.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>SSH Client</h1>
    </header>
    <main>
      <section id="connection-panel">
        <form id="connection-form">
          <div class="form-group">
            <label for="host">Host</label>
            <input type="text" id="host" placeholder="example.com" required>
          </div>
          <div class="form-group">
            <label for="port">Port</label>
            <input type="number" id="port" value="22" min="1" max="65535" required>
          </div>
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="root" required>
          </div>
          <div class="form-group">
            <label for="auth-type">Authentication</label>
            <select id="auth-type">
              <option value="password">Password</option>
              <option value="key">Private Key</option>
            </select>
          </div>
          <div class="form-group" id="password-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="••••••••">
          </div>
          <div class="form-group" id="key-group" style="display:none">
            <label for="private-key">Private Key</label>
            <textarea id="private-key" rows="5" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."></textarea>
          </div>
          <div class="button-group">
            <button type="submit" id="connect-btn">Connect</button>
            <button type="button" id="disconnect-btn" disabled>Disconnect</button>
          </div>
        </form>
        <div id="connection-status" class="status-disconnected">Not connected</div>
      </section>
      <section id="terminal-container" style="display:none">
        <div id="terminal"></div>
      </section>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
  <script src="js/websocket-client.js"></script>
  <script src="js/terminal-ui.js"></script>
  <script src="js/connection-form.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Install dependencies**

Run: `cd /work/browser-ssh-client && npm install`
Expected: `node_modules/` created with `ws` and `ssh2`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold project structure"
```

---

### Task 2: WebSocket Client (Frontend)

**Files:**
- Create: `/work/browser-ssh-client/js/websocket-client.js`

**Interfaces:**
- Consumes: Nothing (standalone module)
- Produces: `class WebSocketClient`
  - `constructor(url)` — Creates WebSocket connection
  - `onOpen` callback
  - `onMessage(data: string)` callback
  - `onError(error: Event)` callback
  - `onClose(code: number, reason: string)` callback
  - `send(data: string)` — Send data through WebSocket
  - `close()` — Close the connection
  - `isConnected() → boolean`

- [ ] **Step 1: Write the failing test**

This is a frontend module. Verification will be done via manual testing in the browser. Create the implementation directly with defensive error handling.

- [ ] **Step 2: Create websocket-client.js**

```javascript
/**
 * WebSocket client wrapper for SSH terminal communication.
 * Manages the lifecyle of a WebSocket connection to the proxy server.
 */
class WebSocketClient {
  /**
   * @param {string} url - WebSocket server URL (e.g., "ws://localhost:3000")
   */
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.onOpen = null;
    this.onMessage = null;
    this.onError = null;
    this.onClose = null;
  }

  /**
   * Establish the WebSocket connection.
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      if (this.onError) this.onError(err);
      return;
    }

    this.ws.addEventListener('open', (event) => {
      if (this.onOpen) this.onOpen(event);
    });

    this.ws.addEventListener('message', (event) => {
      if (this.onMessage) this.onMessage(event.data);
    });

    this.ws.addEventListener('error', (event) => {
      if (this.onError) this.onError(event);
    });

    this.ws.addEventListener('close', (event) => {
      if (this.onClose) this.onClose(event.code, event.reason);
      this.ws = null;
    });
  }

  /**
   * Send data through the WebSocket connection.
   * @param {string} data
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('WebSocket: cannot send, not connected');
    }
  }

  /**
   * Close the WebSocket connection.
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if the WebSocket is currently connected.
   * @returns {boolean}
   */
  isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add js/websocket-client.js
git commit -m "feat: add WebSocket client wrapper"
```

---

### Task 3: Terminal UI Manager (Frontend)

**Files:**
- Create: `/work/browser-ssh-client/js/terminal-ui.js`

**Interfaces:**
- Consumes: `xterm.js` Terminal, `xterm-addon-fit` FitAddon
- Produces: `class TerminalUI`
  - `constructor(containerId: string)` — Initialize terminal in container element
  - `write(data: string)` — Write data to terminal
  - `onData(callback: (data: string) => void)` — Subscribe to user input
  - `fit()` — Resize to fit container
  - `reset()` — Clear and reset terminal
  - `focus()` — Focus the terminal

- [ ] **Step 1: Create terminal-ui.js**

```javascript
/**
 * Manages an xterm.js terminal instance with fit addon.
 */
class TerminalUI {
  /**
   * @param {string} containerId - DOM element ID to mount the terminal in
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Terminal container #${containerId} not found`);
    }

    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'Courier New', Courier, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.container);
    this.fit();

    this._dataHandler = null;
  }

  /**
   * Write data to the terminal display.
   * @param {string} data
   */
  write(data) {
    this.terminal.write(data);
  }

  /**
   * Register a callback for terminal user input.
   * @param {function(string): void} callback
   */
  onData(callback) {
    this._dataHandler = callback;
    this.terminal.onData((data) => {
      if (this._dataHandler) {
        this._dataHandler(data);
      }
    });
  }

  /**
   * Resize terminal to fit container dimensions.
   */
  fit() {
    try {
      this.fitAddon.fit();
    } catch (err) {
      console.warn('Terminal fit failed:', err);
    }
  }

  /**
   * Reset the terminal to initial state.
   */
  reset() {
    this.terminal.reset();
  }

  /**
   * Focus the terminal input.
   */
  focus() {
    this.terminal.focus();
  }

  /**
   * Clean up terminal resources.
   */
  dispose() {
    this._dataHandler = null;
    this.terminal.dispose();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/terminal-ui.js
git commit -m "feat: add terminal UI manager with xterm.js"
```

---

### Task 4: Connection Form UI (Frontend)

**Files:**
- Create: `/work/browser-ssh-client/js/connection-form.js`

**Interfaces:**
- Consumes: Nothing (standalone UI module)
- Produces: `class ConnectionForm`
  - `constructor(formId: string)` — Initialize form with auth toggle
  - `onConnect(callback: (config: object) => void)` — Connect button handler (config: {host, port, username, password?, privateKey?})
  - `onDisconnect(callback: () => void)` — Disconnect button handler
  - `setStatus(text: string, state: string)` — Update status bar (states: 'disconnected'|'connecting'|'connected'|'error')
  - `setConnected(connected: boolean)` — Toggle button states
  - `getValues() → object` — Get current form values

- [ ] **Step 1: Create connection-form.js**

```javascript
/**
 * Manages the SSH connection configuration form and status display.
 */
class ConnectionForm {
  /**
   * @param {string} formId - DOM element ID of the connection form
   */
  constructor(formId) {
    this.form = document.getElementById(formId);
    if (!this.form) {
      throw new Error(`Form #${formId} not found`);
    }

    this.hostInput = document.getElementById('host');
    this.portInput = document.getElementById('port');
    this.usernameInput = document.getElementById('username');
    this.authTypeSelect = document.getElementById('auth-type');
    this.passwordInput = document.getElementById('password');
    this.keyTextarea = document.getElementById('private-key');
    this.passwordGroup = document.getElementById('password-group');
    this.keyGroup = document.getElementById('key-group');
    this.connectBtn = document.getElementById('connect-btn');
    this.disconnectBtn = document.getElementById('disconnect-btn');
    this.statusEl = document.getElementById('connection-status');
    this.terminalContainer = document.getElementById('terminal-container');
    this.connectionPanel = document.getElementById('connection-panel');

    this._connectHandler = null;
    this._disconnectHandler = null;

    this._setupAuthToggle();
    this._setupFormSubmit();
    this._setupDisconnect();
  }

  /** Toggle between password and private key auth methods. */
  _setupAuthToggle() {
    this.authTypeSelect.addEventListener('change', () => {
      const isPassword = this.authTypeSelect.value === 'password';
      this.passwordGroup.style.display = isPassword ? '' : 'none';
      this.keyGroup.style.display = isPassword ? 'none' : '';
      // Reset required attributes
      this.passwordInput.required = isPassword;
      this.keyTextarea.required = !isPassword;
    });
  }

  /** Handle form submission. */
  _setupFormSubmit() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this._connectHandler) {
        const config = this.getValues();
        this._connectHandler(config);
      }
    });
  }

  /** Handle disconnect button click. */
  _setupDisconnect() {
    this.disconnectBtn.addEventListener('click', () => {
      if (this._disconnectHandler) {
        this._disconnectHandler();
      }
    });
  }

  /**
   * Register connect callback.
   * @param {function(object): void} callback
   */
  onConnect(callback) {
    this._connectHandler = callback;
  }

  /**
   * Register disconnect callback.
   * @param {function(): void} callback
   */
  onDisconnect(callback) {
    this._disconnectHandler = callback;
  }

  /**
   * Update the connection status display.
   * @param {string} text - Status message
   * @param {string} state - 'disconnected' | 'connecting' | 'connected' | 'error'
   */
  setStatus(text, state) {
    this.statusEl.textContent = text;
    this.statusEl.className = 'status-' + state;
  }

  /**
   * Toggle between connected and disconnected UI states.
   * @param {boolean} connected
   */
  setConnected(connected) {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;
    if (connected) {
      this.terminalContainer.style.display = '';
      this.connectionPanel.classList.add('connected');
    } else {
      this.terminalContainer.style.display = 'none';
      this.connectionPanel.classList.remove('connected');
    }
  }

  /**
   * Get current form values as a config object.
   * @returns {object}
   */
  getValues() {
    const config = {
      host: this.hostInput.value.trim(),
      port: parseInt(this.portInput.value, 10),
      username: this.usernameInput.value.trim(),
    };

    if (this.authTypeSelect.value === 'password') {
      config.password = this.passwordInput.value;
    } else {
      config.privateKey = this.keyTextarea.value;
    }

    return config;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/connection-form.js
git commit -m "feat: add SSH connection form UI"
```

---

### Task 5: Main App Entry Point (Frontend)

**Files:**
- Create: `/work/browser-ssh-client/js/app.js`

**Interfaces:**
- Consumes: `WebSocketClient` (Task 2), `TerminalUI` (Task 3), `ConnectionForm` (Task 4)
- Produces: Application entry point that wires all frontend modules together

- [ ] **Step 1: Create app.js**

```javascript
/**
 * Main application entry point.
 * Wires together the connection form, terminal UI, and WebSocket client.
 */
(function () {
  'use strict';

  const WS_URL = `ws://${window.location.hostname}:${window.location.port}`;
  let wsClient = null;
  let terminal = null;
  let resizeObserver = null;

  function initialize() {
    // Initialize UI components
    const form = new ConnectionForm('connection-form');

    form.onConnect((config) => {
      form.setConnected(true);
      form.setStatus('Connecting...', 'connecting');

      terminal = new TerminalUI('terminal');
      terminal.write('\x1b[32mConnecting to ' + config.host + ':' + config.port + '...\x1b[0m\r\n');

      wsClient = new WebSocketClient(WS_URL);
      wsClient.onOpen = () => {
        form.setStatus('Connected to ' + config.host, 'connected');
        // Send connection config as first message
        wsClient.send(JSON.stringify({
          type: 'connect',
          ...config,
        }));
        terminal.focus();
      };

      wsClient.onMessage = (data) => {
        // Terminal data from proxy
        if (terminal) {
          terminal.write(data);
        }
      };

      wsClient.onError = () => {
        form.setStatus('Connection error', 'error');
      };

      wsClient.onClose = (code, reason) => {
        form.setConnected(false);
        const msg = reason || 'Disconnected (code: ' + code + ')';
        form.setStatus(msg, 'disconnected');
        if (terminal) {
          terminal.write('\r\n\x1b[31m' + msg + '\x1b[0m\r\n');
        }
        cleanupTerminal();
      };

      // Wire terminal input to WebSocket
      terminal.onData((data) => {
        if (wsClient && wsClient.isConnected()) {
          wsClient.send(data);
        }
      });

      // Handle resize events
      resizeObserver = new ResizeObserver(() => {
        if (terminal) {
          terminal.fit();
        }
      });
      resizeObserver.observe(document.getElementById('terminal'));
    });

    form.onDisconnect(() => {
      if (wsClient) {
        wsClient.close();
      }
      form.setConnected(false);
      form.setStatus('Disconnected', 'disconnected');
      cleanupTerminal();
    });
  }

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

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat: add main app entry point wiring frontend modules"
```

---

### Task 6: CSS Styles

**Files:**
- Create: `/work/browser-ssh-client/css/style.css`
- Create: `/work/browser-ssh-client/css/terminal-theme.css`

**Interfaces:**
- Consumes: HTML structure from Task 1
- Produces: Styled UI with responsive layout

- [ ] **Step 1: Create style.css**

```css
/* style.css - Main application layout and component styles */
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --text-primary: #d4d4d4;
  --text-secondary: #969696;
  --border-color: #3c3c3c;
  --accent-color: #0078d4;
  --accent-hover: #1a8ae8;
  --danger-color: #f14c4c;
  --success-color: #23d18b;
  --warning-color: #e5e510;
  --error-bg: #5a1d1d;
  --font-mono: 'Courier New', Courier, monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --radius: 4px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  line-height: 1.5;
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header */
header {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
}

header h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Main layout */
main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Connection Panel */
#connection-panel {
  width: 320px;
  min-width: 320px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  overflow-y: auto;
  flex-shrink: 0;
}

#connection-panel.connected {
  width: 48px;
  min-width: 48px;
  overflow: hidden;
}

#connection-panel.connected .form-group,
#connection-panel.connected header h1,
#connection-panel.connected .button-group {
  display: none;
}

#connection-panel.connected #connect-btn {
  display: none;
}

#connection-panel.connected #disconnect-btn {
  display: block;
  width: 32px;
  height: 32px;
  padding: 4px;
  font-size: 10px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

/* Form Groups */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input,
.form-group select,
.form-group textarea {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-primary);
  padding: var(--spacing-sm);
  font-size: 14px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--accent-color);
}

.form-group textarea {
  font-family: var(--font-mono);
  font-size: 12px;
  resize: vertical;
}

/* Button Group */
.button-group {
  display: flex;
  gap: var(--spacing-sm);
}

button {
  background-color: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 14px;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background-color 0.15s;
}

button:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#disconnect-btn {
  background-color: var(--danger-color);
}

#disconnect-btn:hover:not(:disabled) {
  background-color: #e03535;
}

#connect-btn {
  flex: 1;
}

/* Connection Status */
#connection-status {
  font-size: 12px;
  padding: var(--spacing-sm);
  border-radius: var(--radius);
  text-align: center;
}

.status-disconnected {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
}

.status-connecting {
  background-color: #1a3a5c;
  color: var(--accent-color);
}

.status-connected {
  background-color: #0d3a22;
  color: var(--success-color);
}

.status-error {
  background-color: var(--error-bg);
  color: var(--danger-color);
}

/* Terminal Container */
#terminal-container {
  flex: 1;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

#terminal {
  flex: 1;
  min-height: 200px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  main {
    flex-direction: column;
  }

  #connection-panel {
    width: 100%;
    min-width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  #connection-panel.connected {
    width: 100%;
    min-width: 100%;
    max-height: 48px;
    flex-direction: row;
    align-items: center;
    padding: var(--spacing-sm);
  }

  #connection-panel.connected #disconnect-btn {
    width: auto;
    height: auto;
    writing-mode: horizontal-tb;
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 12px;
  }
}
```

- [ ] **Step 2: Create terminal-theme.css**

```css
/* terminal-theme.css - xterm.js theme overrides */
#terminal .xterm {
  height: 100%;
  padding: 4px;
}

#terminal .xterm-viewport {
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

#terminal .xterm-viewport::-webkit-scrollbar {
  width: 8px;
}

#terminal .xterm-viewport::-webkit-scrollbar-track {
  background: transparent;
}

#terminal .xterm-viewport::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

#terminal .xterm-cursor {
  transition: none !important;
}

.xterm-rows span {
  font-variant-ligatures: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/style.css css/terminal-theme.css
git commit -m "feat: add application styles and terminal theme"
```

---

### Task 7: SSH Bridge (Proxy - Core Logic)

**Files:**
- Create: `/work/browser-ssh-client/proxy/ssh-bridge.js`
- Create: `/work/browser-ssh-client/proxy/test/ssh-bridge.test.js`

**Interfaces:**
- Consumes: `ssh2` library `Client` class
- Produces: `class SshBridge`
  - `constructor(ws: WebSocket)` — Takes a WebSocket connection
  - `connect(config: object, callback: (err?: Error) => void)` — Connect to SSH server. config: {host, port, username, password?, privateKey?, readyTimeout?}
  - `write(data: string)` — Send data to SSH session
  - `resize(cols: number, rows: number)` — Resize PTY
  - `close()` — Graceful shutdown
  - Events: 'error', 'close'

- [ ] **Step 1: Write the failing test**

```javascript
// proxy/test/ssh-bridge.test.js
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');

// We'll test what we can without an actual SSH server
// The SSH bridge is inherently integration-test heavy

describe('SshBridge', () => {
  it('should be creatable', () => {
    const SshBridge = require('../ssh-bridge');
    const mockSocket = { on: () => {}, send: () => {} };
    const bridge = new SshBridge(mockSocket);
    assert.ok(bridge);
    bridge.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test /work/browser-ssh-client/proxy/test/ssh-bridge.test.js`
Expected: FAIL with "Cannot find module '../ssh-bridge'"

- [ ] **Step 3: Implement ssh-bridge.js**

```javascript
// proxy/ssh-bridge.js
const { Client } = require('ssh2');

class SshBridge {
  /**
   * @param {import('ws').WebSocket} ws - The WebSocket connection to bridge
   */
  constructor(ws) {
    this.ws = ws;
    this.sshClient = new Client();
    this.stream = null;
    this._closed = false;
  }

  /**
   * Connect to the SSH server and set up the bridge.
   * @param {object} config
   * @param {string} config.host
   * @param {number} config.port
   * @param {string} config.username
   * @param {string} [config.password]
   * @param {string} [config.privateKey]
   * @param {number} [config.readyTimeout=10000]
   * @param {function(Error|null): void} callback
   */
  connect(config, callback) {
    const sshConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: config.readyTimeout || 10000,
    };

    if (config.password) {
      sshConfig.password = config.password;
    } else if (config.privateKey) {
      sshConfig.privateKey = config.privateKey;
    }

    this.sshClient.on('ready', () => {
      this.sshClient.shell({
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
      }, (err, stream) => {
        if (err) {
          callback(err);
          return;
        }

        this.stream = stream;

        // Forward SSH stdout → WebSocket
        stream.on('data', (data) => {
          if (!this._closed && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(data.toString('utf-8'));
          }
        });

        // Handle stream close
        stream.on('close', (code) => {
          this._cleanup();
          if (!this._closed) {
            this._closed = true;
            this.ws.close(1000, 'SSH session ended (code: ' + code + ')');
          }
        });

        stream.stderr.on('data', (data) => {
          if (!this._closed && this.ws.readyState === this.ws.OPEN) {
            this.ws.send('\x1b[91m' + data.toString('utf-8') + '\x1b[0m');
          }
        });

        callback(null);
      });
    });

    this.sshClient.on('error', (err) => {
      if (!this._closed) {
        this._closed = true;
        this.ws.close(1011, err.message);
      }
      callback(err);
    });

    this.sshClient.on('close', () => {
      if (!this._closed) {
        this._closed = true;
        this.ws.close(1000, 'SSH connection closed');
      }
    });

    this.sshClient.connect(sshConfig);
  }

  /**
   * Send data to the SSH session (from WebSocket).
   * @param {string|Buffer} data
   */
  write(data) {
    if (this.stream && this.stream.writable) {
      this.stream.write(data);
    }
  }

  /**
   * Resize the terminal PTY.
   * @param {number} cols
   * @param {number} rows
   */
  resize(cols, rows) {
    if (this.stream && this.stream.writable) {
      this.stream.setWindow(rows, cols, 0, 0);
    }
  }

  /**
   * Close the SSH connection gracefully.
   */
  close() {
    this._cleanup();
    this.sshClient.end();
  }

  /** Internal cleanup of stream references. */
  _cleanup() {
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
  }
}

module.exports = SshBridge;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test /work/browser-ssh-client/proxy/test/ssh-bridge.test.js`
Expected: PASS (test 1 passes)

- [ ] **Step 5: Commit**

```bash
git add proxy/ssh-bridge.js proxy/test/ssh-bridge.test.js
git commit -m "feat: add SSH bridge for WebSocket-to-SSH relay"
```

---

### Task 8: Proxy Server (Server Entry)

**Files:**
- Create: `/work/browser-ssh-client/proxy/server.js`

**Interfaces:**
- Consumes: `SshBridge` (Task 7), `ws` WebSocket server, http module
- Produces: HTTP server on port 3000 (configurable via PORT env) that:
  - Serves static files (index.html, js/, css/)
  - Accepts WebSocket connections on `/ws`
  - Creates SshBridge per connection
  - Handles connect/disconnect/resize messages via JSON protocol
  - Logs connections to stdout

- [ ] **Step 1: Create server.js**

```javascript
#!/usr/bin/env node
// proxy/server.js - HTTP + WebSocket server for browser SSH client

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const SshBridge = require('./ssh-bridge');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Serve static files from the project root.
 */
function serveStatic(req, res) {
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: serve index.html for unknown routes
        fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  serveStatic(req, res);
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[ws] Client connected');
  let bridge = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      // Not JSON — treat as terminal input if bridge exists
      if (bridge) {
        bridge.write(raw.toString());
      }
      return;
    }

    if (data.type === 'connect') {
      if (bridge) {
        ws.send(JSON.stringify({ type: 'error', message: 'Already connected' }));
        return;
      }

      bridge = new SshBridge(ws);
      bridge.connect(data, (err) => {
        if (err) {
          console.error('[ssh] Connection failed:', err.message);
          bridge = null;
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        } else {
          console.log('[ssh] Connected to ' + data.host + ':' + data.port);
          ws.send(JSON.stringify({ type: 'connected', message: 'SSH session established' }));
        }
      });
    } else if (data.type === 'resize') {
      if (bridge) {
        bridge.resize(data.cols || 80, data.rows || 24);
      }
    } else if (data.type === 'disconnect') {
      if (bridge) {
        bridge.close();
        bridge = null;
      }
    }
  });

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
    if (bridge) {
      bridge.close();
      bridge = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[ws] Error:', err.message);
    if (bridge) {
      bridge.close();
      bridge = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Browser SSH Client running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
```

- [ ] **Step 2: Commit**

```bash
git add proxy/server.js
git commit -m "feat: add HTTP+WebSocket proxy server"
```

---

### Task 9: Integration Verification and Testing

**Files:**
- Modify: (none new, verification only)

**Interfaces:**
- Consumes: All completed tasks
- Produces: Verified working application

- [ ] **Step 1: Verify server starts without errors**

Run: `cd /work/browser-ssh-client && timeout 5 node proxy/server.js 2>&1 || true`
Expected: "Browser SSH Client running at http://localhost:3000" printed before timeout

- [ ] **Step 2: Verify all tests pass**

Run: `cd /work/browser-ssh-client && npm test`
Expected: All tests pass (TAP output shows 1..1 ok)

- [ ] **Step 3: Verify file structure is complete**

Run: `ls -la index.html js/ css/ proxy/`
Expected: All expected files present

- [ ] **Step 4: Final commit if changes made**

```bash
git add -A
git commit -m "chore: final integration adjustments"
```
