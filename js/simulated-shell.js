/**
 * SimulatedShell — A browser-only simulated Linux terminal shell environment.
 *
 * No backend, no Node.js modules. Runs entirely in the browser.
 * Provides a realistic shell experience with a virtual filesystem,
 * command history, tab completion, and 25+ common Linux commands
 * with ANSI-colored output.
 */
class SimulatedShell {
  // ──────────────────────────────────────────────────────────────────────────────
  // Color helper utilities
  // ──────────────────────────────────────────────────────────────────────────────
  static _color = {
    reset: '\x1b[0m',
    red(text) { return `\x1b[0;31m${text}\x1b[0m`; },
    green(text) { return `\x1b[0;32m${text}\x1b[0m`; },
    yellow(text) { return `\x1b[0;33m${text}\x1b[0m`; },
    blue(text) { return `\x1b[1;34m${text}\x1b[0m`; },
    cyan(text) { return `\x1b[0;36m${text}\x1b[0m`; },
    bold(text) { return `\x1b[1m${text}\x1b[0m`; },
    dim(text) { return `\x1b[2m${text}\x1b[0m`; },
  };

  // ──────────────────────────────────────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────────────────────────────────────
  constructor() {
    this._fs = this._buildFilesystem();
    this._cwd = '/home/user';
    this._history = [];
    this._historyIndex = -1;
    this._buffer = '';
    this._onOutput = null;
    this._echoEnabled = true;
    this._connected = false;
    this._savedBuffer = '';

    // Track the resolved real path (no '..' or '.') for nice prompts
    this._resolvedCwd = '/home/user';
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Filesystem builder
  // ──────────────────────────────────────────────────────────────────────────────
  _buildFilesystem() {
    const now = this._timestamp();
    const perm = (mode) => ({ permissions: mode, owner: 'user', modified: now });

    // Helper: make a directory with children
    const dir = (children, extra = {}) => {
      const d = { type: 'dir', content: '', permissions: 'drwxr-xr-x', owner: 'user', modified: now, ...extra };
      if (children) d.children = children;
      return d;
    };

    // Helper: make a file
    const file = (content, extra = {}) => ({
      type: 'file',
      content,
      permissions: extra.executable ? '-rwxr-xr-x' : '-rw-r--r--',
      owner: 'user',
      modified: now,
      size: content ? content.length : 0,
      ...extra,
    });

    return dir({
      home: dir({
        user: dir({
          documents: dir({
            'notes.txt': file('Welcome to the simulated environment!\nThese are your personal notes.\n'),
            'todo.md': file('# TODO List\n\n- [x] Set up project\n- [ ] Write documentation\n- [ ] Deploy to production\n'),
            'personal.txt': file('This is a personal file in the documents directory.\n'),
          }),
          projects: dir({
            'hello.py': file('#!/usr/bin/env python3\nprint("Hello, World!")\n', { executable: true }),
            'README.md': file('# My Project\n\nThis is a sample project for demonstration.\n'),
          }),
          '.bashrc': file('export PS1="\\u@\\h:\\w$ "\nalias ll="ls -la"\nalias la="ls -a"\n'),
          'README.txt': file('Welcome to the Browser SSH Client Demo!\n\nThis is a simulated Linux environment running entirely in your browser.\nType "help" to see available commands.\n'),
        }),
      }),
      etc: dir({
        hostname: file('demo-host\n'),
        passwd: file('root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nuser:x:1000:1000:user,,,:/home/user:/bin/bash\n'),
        issue: file('Debian GNU/Linux 12 (bookworm) \\n \\l\n'),
        'os-release': file('PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nVERSION="12 (bookworm)"\nID=debian\n'),
        shadow: file('root:$6$xyz$hashhashhash:19871:0:99999:7:::\ndaemon:*:19871:0:99999:7:::\n', { permissions: '-rw-------', owner: 'root' }),
        hostname: file('demo-host\n'),
        fstab: file('# /etc/fstab: static file system information\n# <file system> <mount point> <type> <options> <dump> <pass>\n/dev/sda1 / ext4 defaults 0 1\n'),
      }),
      var: dir({
        log: dir({
          'syslog': file('Jul  5 14:00:01 demo-host systemd[1]: Started Daily apt upgrade and clean activities.\nJul  5 14:00:05 demo-host systemd[1]: systemd-journald[342]: Received SIGUSR1 from PID 1.\n'),
          'auth.log': file('Jul  5 14:00:00 demo-host sshd[521]: Server listening on 0.0.0.0 port 22.\nJul  5 14:00:01 demo-host sshd[521]: Accepted password for user from 192.168.1.100 port 54321\n'),
          'dmesg': file('[    0.000000] Linux version 6.1.0-x86_64\n[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-6.1.0-13-amd64 root=/dev/sda1 ro quiet\n[    0.000000] x86/fpu: x87 FPU will use FXSAVE\n'),
        }),
      }),
      usr: dir({
        bin: dir({
          'ls': file('', { executable: true }),
          'cat': file('', { executable: true }),
          'nano': file('', { executable: true }),
          'python3': file('', { executable: true }),
          'gcc': file('', { executable: true }),
          'grep': file('', { executable: true }),
          'head': file('', { executable: true }),
          'tail': file('', { executable: true }),
          'wc': file('', { executable: true }),
          'which': file('', { executable: true }),
          'man': file('', { executable: true }),
          'mkdir': file('', { executable: true }),
          'touch': file('', { executable: true }),
          'rm': file('', { executable: true }),
          'cp': file('', { executable: true }),
          'mv': file('', { executable: true }),
        }),
      }),
      tmp: dir({}),
      proc: dir({
        cpuinfo: file('processor\t: 0\nvendor_id\t: GenuineIntel\ncpu family\t: 6\nmodel\t\t: 158\nmodel name\t: Intel(R) Core(TM) i7-8700K CPU @ 3.70GHz\nstepping\t: 1\ncpu MHz\t\t: 3696.000\ncache size\t: 12288 KB\n'),
        meminfo: file('MemTotal:        8069620 kB\nMemFree:         1876540 kB\nMemAvailable:    4567890 kB\nBuffers:          345678 kB\nCached:          2345678 kB\n'),
        uptime: file('123456.78 987654.32\n'),
      }),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Timestamp helper
  // ──────────────────────────────────────────────────────────────────────────────
  _timestamp() {
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, ' ');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${mon} ${day} ${hh}:${mm}:${ss}`;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Connect / Disconnect
  // ──────────────────────────────────────────────────────────────────────────────
  connect() {
    this._connected = true;
    this._buffer = '';
    this._history = [];
    this._historyIndex = -1;
    this._cwd = '/home/user';
    this._resolvedCwd = '/home/user';

    const banner =
      '\r\n' +
      '\x1b[1;34m' +
      '╔══════════════════════════════════════════════════╗\r\n' +
      '║     🔒 浏览器 SSH 客户端 - 演示模式 (Demo Mode)    ║\r\n' +
      '║        Simulated Linux Shell Environment            ║\r\n' +
      '╚══════════════════════════════════════════════════╝' +
      '\x1b[0m' +
      '\r\n\r\n' +
      "Type 'help' for available commands.\r\n";

    this._write(banner);
    this._showPrompt();
  }

  disconnect() {
    this._connected = false;
    this._buffer = '';
    this._history = [];
    this._historyIndex = -1;
    this._cwd = '/home/user';
    this._resolvedCwd = '/home/user';
    this._onOutput = null;
    this._echoEnabled = true;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Callback registration
  // ──────────────────────────────────────────────────────────────────────────────
  onData(callback) {
    this._onData = callback;
  }

  registerOutputCallback(callback) {
    this._onOutput = callback;
  }

  /**
   * Alias for registerOutputCallback — called by app.js for output registration.
   * @param {Function} callback
   */
  onOutput(callback) {
    this.registerOutputCallback(callback);
  }

  /**
   * Public wrapper for _handleInput. Processes raw terminal input (keystrokes).
   * @param {string} data - Raw input data from the terminal
   */
  handleInput(data) {
    this._handleInput(data);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Prompt
  // ──────────────────────────────────────────────────────────────────────────────
  getPromptString() {
    let displayPath = this._resolvedCwd;
    if (displayPath === '/home/user') {
      displayPath = '~';
    } else if (displayPath.startsWith('/home/user/')) {
      displayPath = '~' + displayPath.slice('/home/user'.length);
    }
    return `\x1b[0;32muser@demo\x1b[0m:\x1b[1;34m${displayPath}\x1b[0m$ `;
  }

  _showPrompt() {
    this._write(this.getPromptString());
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Output writing
  // ──────────────────────────────────────────────────────────────────────────────
  _write(text) {
    if (this._onOutput) {
      this._onOutput(text);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Input handling
  // ──────────────────────────────────────────────────────────────────────────────
  _handleInput(data) {
    if (!this._connected) return;

    // Handle each character
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const charCode = ch.charCodeAt ? ch.charCodeAt(0) : ch;

      // Handle escape sequences (arrow keys etc.)
      if (charCode === 0x1b) {
        // Check if next chars form an escape sequence
        const seq = data.slice(i);
        if (seq.length >= 3) {
          if (seq.startsWith('\x1b[A')) {
            // Up arrow
            this._historyUp();
            i += 2; // skip '[' and 'A' (loop increment adds 1 more)
            continue;
          } else if (seq.startsWith('\x1b[B')) {
            // Down arrow
            this._historyDown();
            i += 2;
            continue;
          } else if (seq.startsWith('\x1b[C')) {
            // Right arrow - just advance cursor (no-op in this simple shell)
            i += 2;
            continue;
          } else if (seq.startsWith('\x1b[D')) {
            // Left arrow - just retreat cursor (no-op)
            i += 2;
            continue;
          }
        }
        // Unrecognized or incomplete escape sequence - skip it
        continue;
      }

      if (charCode === 0x7f) {
        // Backspace
        this._handleBackspace();
      } else if (charCode === 0x0d || charCode === 0x0a) {
        // Enter
        this._handleEnter();
      } else if (charCode === 0x09) {
        // Tab
        this._handleTab();
      } else if (charCode === 0x15) {
        // Ctrl+U - clear line
        this._handleCtrlU();
      } else if (charCode === 0x03) {
        // Ctrl+C
        this._handleCtrlC();
      } else if (charCode === 0x0c) {
        // Ctrl+L - clear screen
        this._handleCtrlL();
      } else if (charCode >= 0x20 && charCode <= 0x7e) {
        // Printable ASCII
        if (this._echoEnabled) {
          this._write(ch);
        }
        this._buffer += ch;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Input sub-handlers
  // ──────────────────────────────────────────────────────────────────────────────
  _handleBackspace() {
    if (this._buffer.length > 0) {
      this._buffer = this._buffer.slice(0, -1);
      this._write('\b \b');
    }
  }

  _handleEnter() {
    this._write('\r\n');
    const cmd = this._buffer;
    this._buffer = '';

    if (cmd.trim()) {
      this._history.push(cmd);
      this._historyIndex = this._history.length;
      this._executeCommand(cmd.trim());
    }
    this._showPrompt();
  }

  _handleTab() {
    const words = this._buffer.split(' ');
    if (this._buffer.endsWith(' ')) {
      // Nothing to complete at end of space
      return;
    }

    if (words.length === 1 && this._buffer.length > 0) {
      // Complete command name
      const partial = words[0];
      const commands = this._getCommandList();
      const matches = commands.filter(c => c.startsWith(partial));
      this._completeFromList(matches, partial);
    } else if (words.length > 1) {
      // Complete file/directory name - complete the last word
      const lastWord = words[words.length - 1];
      const dir = this._getDirectoryContents(this._resolvedCwd);
      if (dir) {
        const entries = Object.keys(dir.children).filter(name => !name.startsWith('.'));
        const matches = entries.filter(e => e.startsWith(lastWord));
        this._completeFromList(matches, lastWord);
      }
    }
  }

  _completeFromList(matches, partial) {
    if (matches.length === 0) {
      return;
    }
    if (matches.length === 1) {
      // Replace partial with full match
      const suffix = matches[0].slice(partial.length);
      this._buffer += suffix;
      this._write(suffix);
    } else {
      // Find common prefix
      let commonPrefix = matches[0];
      for (let i = 1; i < matches.length; i++) {
        while (matches[i].indexOf(commonPrefix) !== 0) {
          commonPrefix = commonPrefix.slice(0, -1);
        }
      }
      if (commonPrefix.length > partial.length) {
        const suffix = commonPrefix.slice(partial.length);
        this._buffer += suffix;
        this._write(suffix);
      } else {
        // Show all matches
        this._write('\r\n');
        let line = '';
        for (const m of matches) {
          const entry = this._findEntry(this._resolvedCwd, m);
          if (entry && entry.type === 'dir') {
            line += SimulatedShell._color.blue(m) + '  ';
          } else if (entry && entry.permissions && entry.permissions.includes('x') && entry.type === 'file') {
            line += SimulatedShell._color.green(m) + '  ';
          } else {
            line += m + '  ';
          }
        }
        this._write(line + '\r\n');
        this._showPrompt();
        this._write(this._buffer);
      }
    }
  }

  _handleCtrlU() {
    if (this._buffer.length > 0) {
      const len = this._buffer.length;
      this._buffer = '';
      for (let i = 0; i < len; i++) {
        this._write('\b \b');
      }
    }
  }

  _handleCtrlC() {
    this._write('^C\r\n');
    this._buffer = '';
    this._showPrompt();
  }

  _handleCtrlL() {
    this._write('\x1b[2J\x1b[H');
    this._showPrompt();
    this._write(this._buffer);
  }

  _historyUp() {
    if (this._history.length === 0) return;
    if (this._historyIndex <= 0) return;
    if (this._historyIndex === this._history.length) {
      // Save current buffer
      this._savedBuffer = this._buffer;
    }
    this._historyIndex--;
    this._replaceBuffer(this._history[this._historyIndex]);
  }

  _historyDown() {
    if (this._history.length === 0) return;
    if (this._historyIndex >= this._history.length) return;
    this._historyIndex++;
    if (this._historyIndex === this._history.length) {
      const saved = this._savedBuffer || '';
      this._replaceBuffer(saved);
    } else {
      this._replaceBuffer(this._history[this._historyIndex]);
    }
  }

  _replaceBuffer(newText) {
    // Erase current buffer
    for (let i = 0; i < this._buffer.length; i++) {
      this._write('\b \b');
    }
    this._buffer = newText;
    this._write(newText);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Command list
  // ──────────────────────────────────────────────────────────────────────────────
  _getCommandList() {
    return [
      'ls', 'cd', 'pwd', 'cat', 'echo', 'whoami', 'date', 'uname',
      'ps', 'df', 'free', 'clear', 'help', 'history', 'mkdir', 'touch',
      'rm', 'cp', 'mv', 'head', 'tail', 'wc', 'grep', 'which', 'man',
    ];
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Command execution
  // ──────────────────────────────────────────────────────────────────────────────
  _executeCommand(input) {
    const args = this._parseArgs(input);
    if (args.length === 0) return;

    const cmd = args[0];
    const cmdArgs = args.slice(1);

    switch (cmd) {
      case 'ls':     this._cmd_ls(cmdArgs); break;
      case 'cd':     this._cmd_cd(cmdArgs); break;
      case 'pwd':    this._cmd_pwd(cmdArgs); break;
      case 'cat':    this._cmd_cat(cmdArgs); break;
      case 'echo':   this._cmd_echo(cmdArgs); break;
      case 'whoami': this._cmd_whoami(cmdArgs); break;
      case 'date':   this._cmd_date(cmdArgs); break;
      case 'uname':  this._cmd_uname(cmdArgs); break;
      case 'ps':     this._cmd_ps(cmdArgs); break;
      case 'df':     this._cmd_df(cmdArgs); break;
      case 'free':   this._cmd_free(cmdArgs); break;
      case 'clear':  this._cmd_clear(cmdArgs); break;
      case 'help':   this._cmd_help(cmdArgs); break;
      case 'history': this._cmd_history(cmdArgs); break;
      case 'mkdir':  this._cmd_mkdir(cmdArgs); break;
      case 'touch':  this._cmd_touch(cmdArgs); break;
      case 'rm':     this._cmd_rm(cmdArgs); break;
      case 'cp':     this._cmd_cp(cmdArgs); break;
      case 'mv':     this._cmd_mv(cmdArgs); break;
      case 'head':   this._cmd_head(cmdArgs); break;
      case 'tail':   this._cmd_tail(cmdArgs); break;
      case 'wc':     this._cmd_wc(cmdArgs); break;
      case 'grep':   this._cmd_grep(cmdArgs); break;
      case 'which':  this._cmd_which(cmdArgs); break;
      case 'man':    this._cmd_man(cmdArgs); break;
      default:
        this._write(SimulatedShell._color.red(`bash: ${cmd}: command not found`) + '\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Argument parsing (handles quoted strings)
  // ──────────────────────────────────────────────────────────────────────────────
  _parseArgs(input) {
    const args = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inQuote) {
        if (ch === quoteChar) {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === ' ') {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current) {
      args.push(current);
    }
    return args;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Filesystem navigation helpers
  // ──────────────────────────────────────────────────────────────────────────────
  _resolvePath(path) {
    if (!path || path === '~') return '/home/user';
    if (path === '.') return this._resolvedCwd;
    if (path === '..') {
      return this._parentPath(this._resolvedCwd);
    }

    let start;
    if (path.startsWith('/')) {
      start = '';
    } else if (path.startsWith('~/')) {
      return '/home/user/' + path.slice(2);
    } else if (path === '~') {
      return '/home/user';
    } else {
      start = this._resolvedCwd;
    }

    // Split into segments and resolve
    const segments = path.split('/').filter(s => s.length > 0);
    const resolved = [];
    const base = start ? start.split('/').filter(s => s.length > 0) : [];

    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') {
        if (resolved.length > 0) resolved.pop();
        else if (base.length > 0) base.pop();
      } else {
        resolved.push(seg);
      }
    }

    const final = '/' + [...base, ...resolved].join('/');
    // Normalize: remove trailing slash unless it's just '/'
    return final === '' ? '/' : final;
  }

  _parentPath(path) {
    if (path === '/') return '/';
    const parts = path.split('/').filter(s => s.length > 0);
    parts.pop();
    return '/' + parts.join('/') || '/';
  }

  _findEntry(path, name) {
    const resolved = name ? this._resolvePath(path + '/' + name) : path;
    if (resolved === '/') return this._fs;
    const segments = resolved.split('/').filter(s => s.length > 0);
    let current = this._fs;
    for (const seg of segments) {
      if (!current.children || !current.children[seg]) return null;
      current = current.children[seg];
    }
    return current;
  }

  _getDirectoryContents(path) {
    const entry = this._findEntry(path);
    if (entry && entry.type === 'dir') {
      return entry;
    }
    return null;
  }

  _isDirectory(path) {
    const entry = this._findEntry(path);
    return entry && entry.type === 'dir';
  }

  _pathExists(path) {
    return this._findEntry(path) !== null;
  }

  _getRealPath(path) {
    // Resolve symbolic path to real filesystem path, normalizing
    const resolved = this._resolvePath(path);
    if (this._pathExists(resolved)) return resolved;
    // Try to find what exists
    const parts = resolved.split('/').filter(s => s.length > 0);
    let current = this._fs;
    let built = '';
    for (const part of parts) {
      if (current.children && current.children[part]) {
        built += '/' + part;
        current = current.children[part];
      } else {
        return null;
      }
    }
    return built || '/';
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 1. ls
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_ls(args) {
    let targetPath = this._resolvedCwd;
    let showAll = false;
    let showLong = false;

    const filtered = [];
    for (const arg of args) {
      if (arg === '-a') showAll = true;
      else if (arg === '-l') showLong = true;
      else if (arg === '-la' || arg === '-al') { showAll = true; showLong = true; }
      else if (arg.startsWith('-')) {
        // Parse combined flags
        for (const flag of arg.slice(1)) {
          if (flag === 'a') showAll = true;
          else if (flag === 'l') showLong = true;
        }
      } else {
        filtered.push(arg);
      }
    }

    // If a path argument is given, use it
    if (filtered.length > 0) {
      targetPath = this._resolvePath(filtered[0]);
    }

    const dir = this._getDirectoryContents(targetPath);
    if (!dir) {
      this._write(SimulatedShell._color.red(`ls: cannot access '${filtered[0] || targetPath}': No such file or directory`) + '\r\n');
      return;
    }

    const names = Object.keys(dir.children).sort();
    const displayNames = showAll ? names : names.filter(n => !n.startsWith('.'));

    if (displayNames.length === 0) return;

    if (showLong) {
      for (const name of displayNames) {
        const entry = dir.children[name];
        const perm = entry.permissions || (entry.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--');
        const owner = entry.owner || 'user';
        const group = 'user';
        const size = entry.type === 'dir' ? 4096 : (entry.size || entry.content.length || 0);
        const modified = entry.modified || this._timestamp();
        const coloredName = entry.type === 'dir'
          ? SimulatedShell._color.blue(name)
          : (entry.permissions && (entry.permissions.includes('x') || entry.executable)
            ? SimulatedShell._color.green(name)
            : name);
        const sizeStr = String(size).padStart(8);
        this._write(`${perm}  ${owner.padEnd(8)}${group.padEnd(8)}${sizeStr} ${modified} ${coloredName}\r\n`);
      }
    } else {
      // Strip ANSI codes for visible width calculation
      const visibleLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
      const minColWidth = 16;
      let line = '';
      let col = 0;
      for (const name of displayNames) {
        const entry = dir.children[name];
        let colored;
        if (entry.type === 'dir') {
          colored = SimulatedShell._color.blue(name);
        } else if (entry.permissions && (entry.permissions.includes('x') || entry.executable)) {
          colored = SimulatedShell._color.green(name);
        } else {
          colored = name;
        }
        // Pad to column width using visible length
        const visLen = visibleLen(colored);
        const paddingNeeded = Math.max(1, minColWidth - visLen);
        const padded = colored + ' '.repeat(paddingNeeded);
        line += padded;
        col++;
        if (col >= 5) {
          this._write(line + '\r\n');
          line = '';
          col = 0;
        }
      }
      if (line) {
        this._write(line + '\r\n');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 2. cd
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_cd(args) {
    let target = args.length === 0 ? '~' : args[0];
    const newPath = this._resolvePath(target);
    if (this._isDirectory(newPath)) {
      this._cwd = newPath;
      this._resolvedCwd = newPath;
    } else {
      this._write(SimulatedShell._color.red(`cd: ${args[0]}: No such file or directory`) + '\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 3. pwd
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_pwd(args) {
    this._write(this._resolvedCwd + '\r\n');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 4. cat
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_cat(args) {
    if (args.length === 0) return;
    let first = true;
    for (const fileArg of args) {
      const filePath = this._resolvePath(fileArg);
      const entry = this._findEntry(filePath);
      if (!entry) {
        this._write(SimulatedShell._color.red(`cat: ${fileArg}: No such file or directory`) + '\r\n');
        continue;
      }
      if (entry.type === 'dir') {
        this._write(SimulatedShell._color.red(`cat: ${fileArg}: Is a directory`) + '\r\n');
        continue;
      }
      if (!first) {
        this._write('\r\n');
      }
      if (args.length > 1) {
        this._write(SimulatedShell._color.yellow(`==> ${fileArg} <==`) + '\r\n');
      }
      this._write(entry.content);
      if (!entry.content.endsWith('\n')) {
        this._write('\r\n');
      }
      first = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 5. echo
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_echo(args) {
    const vars = {
      HOME: '/home/user',
      USER: 'demo',
      SHELL: '/bin/bash',
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      PWD: this._resolvedCwd,
      OLDPWD: '/home',
      TERM: 'xterm-256color',
    };
    const parts = [];
    let skipNext = false;
    for (let i = 0; i < args.length; i++) {
      if (skipNext) { skipNext = false; continue; }
      const arg = args[i];
      if (arg === '-n') continue; // suppress trailing newline
      if (arg === '-e') continue;
      if (arg === '-E') continue;

      // Variable expansion
      let expanded = arg.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
        return vars[varName] !== undefined ? vars[varName] : match;
      });
      // Also support ${VAR} syntax
      expanded = expanded.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, varName) => {
        return vars[varName] !== undefined ? vars[varName] : match;
      });
      // Expand ~ to home
      expanded = expanded.replace(/^~$/, '/home/user');
      parts.push(expanded);
    }
    this._write(parts.join(' ') + '\r\n');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 6. whoami
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_whoami(args) {
    this._write('demo\r\n');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 7. date
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_date(args) {
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dow = days[d.getUTCDay()];
    const mon = months[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, ' ');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    const year = d.getUTCFullYear();
    this._write(`${dow} ${mon} ${day} ${hh}:${mm}:${ss} UTC ${year}\r\n`);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 8. uname
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_uname(args) {
    const all = args.includes('-a');
    if (all) {
      this._write('Linux demo-host 6.1.0-x86_64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\n');
    } else if (args.includes('-s') || args.length === 0) {
      this._write('Linux\r\n');
    } else if (args.includes('-n')) {
      this._write('demo-host\r\n');
    } else if (args.includes('-r')) {
      this._write('6.1.0-x86_64\r\n');
    } else if (args.includes('-v')) {
      this._write('#1 SMP PREEMPT_DYNAMIC\r\n');
    } else if (args.includes('-m')) {
      this._write('x86_64\r\n');
    } else if (args.includes('-o')) {
      this._write('GNU/Linux\r\n');
    } else {
      this._write('Linux\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 9. ps
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_ps(args) {
    const showAux = args.includes('aux') || args.includes('-aux');
    if (showAux) {
      this._write(`USER         PID %CPU %MEM    RSS  STAT TTY      TIME COMMAND\r\n`);
      this._write(`root           1  0.0  0.2  45678 ?        Ss   00:00:45 systemd\r\n`);
      this._write(`root         342  0.0  0.1  23456 ?        Ss   00:02:10 systemd-journal\r\n`);
      this._write(`root         521  0.0  0.0   7890 ?        Ss   00:00:00 sshd\r\n`);
      this._write(`root         522  0.0  0.0   6789 ?        S     00:00:00 sshd\r\n`);
      this._write(`user         678  0.0  0.1  12345 pts/0    Ss   00:00:12 bash\r\n`);
      this._write(`user         701  0.0  0.0   5678 pts/0    R+   00:00:03 ps\r\n`);
    } else {
      this._write(`  PID TTY         TIME CMD\r\n`);
      this._write(`    1 ?        00:00:45 systemd\r\n`);
      this._write(`  342 ?        00:02:10 systemd-journal\r\n`);
      this._write(`  521 ?        00:00:00 sshd\r\n`);
      this._write(`  678 pts/0    00:00:12 bash\r\n`);
      this._write(`  701 pts/0    00:00:03 ps\r\n`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 10. df
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_df(args) {
    const human = args.includes('-h') || args.includes('--human-readable');
    if (human) {
      this._write('Filesystem      Size  Used Avail Use% Mounted on\r\n');
      this._write('/dev/sda1        50G   23G   27G  46% /\r\n');
      this._write('tmpfs           1.6G  1.2M  1.6G   1% /dev/shm\r\n');
      this._write('/dev/sda2       2.0G  345M  1.7G  17% /boot\r\n');
    } else {
      this._write('Filesystem     1K-blocks    Used Available Use% Mounted on\r\n');
      this._write('/dev/sda1       52428800 24117248  28311552  46% /\r\n');
      this._write('tmpfs           1617384     1200   1616184   1% /dev/shm\r\n');
      this._write('/dev/sda2        2097152   353280   1743872  17% /boot\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 11. free
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_free(args) {
    const human = args.includes('-h') || args.includes('--human');
    if (human) {
      this._write('               total     used     free   shared  buff/cache\r\n');
      this._write('Mem:           7.7G     3.2G     1.8G     0.2G     2.7G\r\n');
      this._write('Swap:          2.0G     0.3G     1.7G\r\n');
    } else {
      this._write('               total     used     free   shared  buff/cache\r\n');
      this._write('Mem:         8069620  3355443  1876540   204800  2837637\r\n');
      this._write('Swap:        2097152   314572  1782580\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 12. clear
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_clear(args) {
    this._write('\x1b[2J\x1b[H');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 13. help
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_help(args) {
    const commands = [
      { cmd: 'ls', desc: 'List directory contents' },
      { cmd: 'cd', desc: 'Change directory' },
      { cmd: 'pwd', desc: 'Print working directory' },
      { cmd: 'cat', desc: 'Concatenate and display files' },
      { cmd: 'echo', desc: 'Display a line of text' },
      { cmd: 'whoami', desc: 'Print current user' },
      { cmd: 'date', desc: 'Display current date and time' },
      { cmd: 'uname', desc: 'Print system information' },
      { cmd: 'ps', desc: 'Report process status' },
      { cmd: 'df', desc: 'Report filesystem disk usage' },
      { cmd: 'free', desc: 'Display memory usage' },
      { cmd: 'clear', desc: 'Clear terminal screen' },
      { cmd: 'help', desc: 'Display this help text' },
      { cmd: 'history', desc: 'Show command history' },
      { cmd: 'mkdir', desc: 'Create directories' },
      { cmd: 'touch', desc: 'Create empty files' },
      { cmd: 'rm', desc: 'Remove files or directories' },
      { cmd: 'cp', desc: 'Copy files' },
      { cmd: 'mv', desc: 'Move or rename files' },
      { cmd: 'head', desc: 'Display first lines of a file' },
      { cmd: 'tail', desc: 'Display last lines of a file' },
      { cmd: 'wc', desc: 'Count lines, words, and characters' },
      { cmd: 'grep', desc: 'Search for patterns in files' },
      { cmd: 'which', desc: 'Locate a command' },
      { cmd: 'man', desc: 'Display manual page for a command' },
    ];

    const colWidth = 28;
    this._write('Available commands:\r\n\r\n');
    // Split into two columns
    const half = Math.ceil(commands.length / 2);
    const leftCol = commands.slice(0, half);
    const rightCol = commands.slice(half);
    for (let i = 0; i < half; i++) {
      const left = leftCol[i];
      const right = rightCol[i];
      const leftName = SimulatedShell._color.green(left.cmd);
      const leftPadded = left.desc.length < colWidth
        ? left.desc + ' '.repeat(colWidth - left.desc.length)
        : left.desc.slice(0, colWidth - 3) + '...';
      let line = `  ${leftName}  ${leftPadded}`;
      if (right) {
        const rightName = SimulatedShell._color.green(right.cmd);
        const rightDesc = right.desc.length < colWidth
          ? right.desc + ' '.repeat(colWidth - right.desc.length)
          : right.desc.slice(0, colWidth - 3) + '...';
        line += `  ${rightName}  ${rightDesc}`;
      }
      this._write(line + '\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 14. history
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_history(args) {
    if (this._history.length === 0) return;
    // Respect -c flag to clear history
    if (args.includes('-c')) {
      this._history = [];
      this._historyIndex = -1;
      return;
    }
    const start = Math.max(0, this._history.length - 1000);
    for (let i = start; i < this._history.length; i++) {
      const num = String(i + 1).padStart(5, ' ');
      this._write(`  ${num}  ${this._history[i]}\r\n`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 15. mkdir
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_mkdir(args) {
    let parents = false;
    const paths = [];
    for (const arg of args) {
      if (arg === '-p' || arg === '--parents') {
        parents = true;
      } else {
        paths.push(arg);
      }
    }
    if (paths.length === 0) {
      this._write(SimulatedShell._color.red('mkdir: missing operand') + '\r\n');
      return;
    }
    for (const p of paths) {
      const resolved = this._resolvePath(p);
      if (this._pathExists(resolved)) {
        if (!parents) {
          this._write(SimulatedShell._color.red(`mkdir: cannot create directory '${p}': File exists`) + '\r\n');
        }
        continue;
      }
      const parentPath = this._parentPath(resolved);
      const dirName = resolved.split('/').filter(s => s.length > 0).pop();
      const parent = this._findEntry(parentPath);
      if (!parent || parent.type !== 'dir') {
        if (!parents) {
          this._write(SimulatedShell._color.red(`mkdir: cannot create directory '${p}': No such file or directory`) + '\r\n');
        }
        continue;
      }
      if (!parent.children) parent.children = {};
      parent.children[dirName] = {
        type: 'dir',
        content: '',
        permissions: 'drwxr-xr-x',
        owner: 'user',
        modified: this._timestamp(),
        children: {},
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 16. touch
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_touch(args) {
    if (args.length === 0) {
      this._write(SimulatedShell._color.red('touch: missing file operand') + '\r\n');
      return;
    }
    for (const p of args) {
      if (p.startsWith('-')) continue;
      const resolved = this._resolvePath(p);
      const existing = this._findEntry(resolved);
      if (existing) {
        // Update timestamp
        existing.modified = this._timestamp();
      } else {
        const parentPath = this._parentPath(resolved);
        const fileName = resolved.split('/').filter(s => s.length > 0).pop();
        const parent = this._findEntry(parentPath);
        if (parent && parent.type === 'dir') {
          if (!parent.children) parent.children = {};
          parent.children[fileName] = {
            type: 'file',
            content: '',
            permissions: '-rw-r--r--',
            owner: 'user',
            modified: this._timestamp(),
            size: 0,
          };
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 17. rm
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_rm(args) {
    let recursive = false;
    let force = false;
    const targets = [];
    for (const arg of args) {
      if (arg === '-r' || arg === '-rf' || arg === '-fr') recursive = true;
      if (arg === '-f' || arg === '-rf' || arg === '-fr') force = true;
      if (arg === '-rf' || arg === '-fr') { recursive = true; force = true; }
      if (!arg.startsWith('-')) targets.push(arg);
    }
    // Handle combined args like -rf
    for (const arg of args) {
      if (arg.startsWith('-') && arg !== '-r' && arg !== '-f') {
        for (const flag of arg.slice(1)) {
          if (flag === 'r') recursive = true;
          if (flag === 'f') force = true;
        }
      }
    }

    if (targets.length === 0) {
      this._write(SimulatedShell._color.red('rm: missing operand') + '\r\n');
      return;
    }
    for (const t of targets) {
      const resolved = this._resolvePath(t);
      const entry = this._findEntry(resolved);
      if (!entry) {
        if (!force) {
          this._write(SimulatedShell._color.red(`rm: cannot remove '${t}': No such file or directory`) + '\r\n');
        }
        continue;
      }
      if (entry.type === 'dir' && !recursive) {
        this._write(SimulatedShell._color.red(`rm: cannot remove '${t}': Is a directory`) + '\r\n');
        continue;
      }
      // Remove from parent
      const parentPath = this._parentPath(resolved);
      const name = resolved.split('/').filter(s => s.length > 0).pop();
      const parent = this._findEntry(parentPath);
      if (parent && parent.children) {
        delete parent.children[name];
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 18. cp
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_cp(args) {
    if (args.length < 2) {
      this._write(SimulatedShell._color.red('cp: missing file operand') + '\r\n');
      return;
    }
    const src = this._resolvePath(args[0]);
    const dst = this._resolvePath(args[1]);
    const srcEntry = this._findEntry(src);
    if (!srcEntry) {
      this._write(SimulatedShell._color.red(`cp: cannot stat '${args[0]}': No such file or directory`) + '\r\n');
      return;
    }
    if (srcEntry.type === 'dir') {
      this._write(SimulatedShell._color.red(`cp: omitting directory '${args[0]}'`) + '\r\n');
      return;
    }
    // Determine destination
    let dstPath = dst;
    let dstName;
    const dstEntry = this._findEntry(dst);
    if (dstEntry && dstEntry.type === 'dir') {
      dstName = args[0].split('/').filter(s => s.length > 0).pop() || args[0];
      dstPath = dst + '/' + dstName;
    } else {
      const parts = dst.split('/').filter(s => s.length > 0);
      dstName = parts.pop();
      dstPath = '/' + [...parts, dstName].join('/');
    }

    const dstParentPath = this._parentPath(dstPath);
    const dstParent = this._findEntry(dstParentPath);
    if (!dstParent || dstParent.type !== 'dir') {
      this._write(SimulatedShell._color.red(`cp: cannot create regular file '${args[1]}': No such file or directory`) + '\r\n');
      return;
    }
    if (!dstParent.children) dstParent.children = {};
    dstParent.children[dstName] = {
      type: 'file',
      content: srcEntry.content,
      permissions: srcEntry.permissions,
      owner: 'user',
      modified: this._timestamp(),
      size: srcEntry.content ? srcEntry.content.length : 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 19. mv
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_mv(args) {
    if (args.length < 2) {
      this._write(SimulatedShell._color.red('mv: missing file operand') + '\r\n');
      return;
    }
    const src = this._resolvePath(args[0]);
    const dst = this._resolvePath(args[1]);
    const srcEntry = this._findEntry(src);
    if (!srcEntry) {
      this._write(SimulatedShell._color.red(`mv: cannot stat '${args[0]}': No such file or directory`) + '\r\n');
      return;
    }
    let dstPath = dst;
    let dstName;
    const dstEntry = this._findEntry(dst);
    if (dstEntry && dstEntry.type === 'dir') {
      dstName = args[0].split('/').filter(s => s.length > 0).pop() || args[0];
      dstPath = dst + '/' + dstName;
    } else {
      const parts = dst.split('/').filter(s => s.length > 0);
      dstName = parts.pop();
      dstPath = '/' + [...parts, dstName].join('/');
    }
    const dstParentPath = this._parentPath(dstPath);
    const dstParent = this._findEntry(dstParentPath);
    if (!dstParent || dstParent.type !== 'dir') {
      this._write(SimulatedShell._color.red(`mv: cannot move '${args[0]}' to '${args[1]}': No such file or directory`) + '\r\n');
      return;
    }

    // Copy to destination
    if (!dstParent.children) dstParent.children = {};
    const newEntry = JSON.parse(JSON.stringify(srcEntry));
    newEntry.modified = this._timestamp();
    dstParent.children[dstName] = newEntry;

    // Remove from source
    const srcParentPath = this._parentPath(src);
    const srcName = src.split('/').filter(s => s.length > 0).pop();
    const srcParent = this._findEntry(srcParentPath);
    if (srcParent && srcParent.children) {
      delete srcParent.children[srcName];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 20. head
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_head(args) {
    let lines = 10;
    let fileArg = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && i + 1 < args.length) {
        lines = parseInt(args[i + 1], 10) || 10;
        i++;
      } else if (args[i].startsWith('-n')) {
        lines = parseInt(args[i].slice(2), 10) || 10;
      } else if (!args[i].startsWith('-')) {
        fileArg = args[i];
      }
    }
    if (!fileArg) {
      this._write(SimulatedShell._color.red('head: missing file operand') + '\r\n');
      return;
    }
    const resolved = this._resolvePath(fileArg);
    const entry = this._findEntry(resolved);
    if (!entry) {
      this._write(SimulatedShell._color.red(`head: ${fileArg}: No such file or directory`) + '\r\n');
      return;
    }
    if (entry.type === 'dir') {
      this._write(SimulatedShell._color.red(`head: ${fileArg}: Is a directory`) + '\r\n');
      return;
    }
    const contentLines = entry.content.split('\n');
    // Remove trailing empty element if content ends with newline
    if (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
      contentLines.pop();
    }
    const showLines = contentLines.slice(0, lines);
    for (const line of showLines) {
      this._write(line + '\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 21. tail
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_tail(args) {
    let lines = 10;
    let fileArg = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && i + 1 < args.length) {
        lines = parseInt(args[i + 1], 10) || 10;
        i++;
      } else if (args[i].startsWith('-n')) {
        lines = parseInt(args[i].slice(2), 10) || 10;
      } else if (!args[i].startsWith('-')) {
        fileArg = args[i];
      }
    }
    if (!fileArg) {
      this._write(SimulatedShell._color.red('tail: missing file operand') + '\r\n');
      return;
    }
    const resolved = this._resolvePath(fileArg);
    const entry = this._findEntry(resolved);
    if (!entry) {
      this._write(SimulatedShell._color.red(`tail: ${fileArg}: No such file or directory`) + '\r\n');
      return;
    }
    if (entry.type === 'dir') {
      this._write(SimulatedShell._color.red(`tail: ${fileArg}: Is a directory`) + '\r\n');
      return;
    }
    const contentLines = entry.content.split('\n');
    // Remove trailing empty element if content ends with newline
    if (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
      contentLines.pop();
    }
    const showLines = contentLines.slice(Math.max(0, contentLines.length - lines));
    for (const line of showLines) {
      this._write(line + '\r\n');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 22. wc
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_wc(args) {
    let countLines = true;
    let countWords = true;
    let countChars = true;
    let fileArg = null;

    // If no flags specified, all are true
    let hasFlags = false;
    for (const arg of args) {
      if (arg.startsWith('-') && arg.length > 1 && arg[1] !== 'l' && arg[1] !== 'w' && arg[1] !== 'c') {
        // not a wc flag, might be something else
      }
      if (arg.startsWith('-') && arg.length > 1) {
        hasFlags = true;
        break;
      }
    }
    if (hasFlags) {
      countLines = false;
      countWords = false;
      countChars = false;
    }

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-l') countLines = true;
      else if (args[i] === '-w') countWords = true;
      else if (args[i] === '-c') countChars = true;
      else if (args[i] === '-m') countChars = true; // -m for characters
      else if (args[i].startsWith('-')) {
        for (const f of args[i].slice(1)) {
          if (f === 'l') countLines = true;
          else if (f === 'w') countWords = true;
          else if (f === 'c' || f === 'm') countChars = true;
        }
      } else {
        fileArg = args[i];
      }
    }

    if (!fileArg) {
      // Read from stdin (not available in simulation)
      this._write(SimulatedShell._color.red('wc: stdin: not available in demo mode') + '\r\n');
      return;
    }

    const resolved = this._resolvePath(fileArg);
    const entry = this._findEntry(resolved);
    if (!entry) {
      this._write(SimulatedShell._color.red(`wc: ${fileArg}: No such file or directory`) + '\r\n');
      return;
    }
    const text = entry.content || '';
    const lineCount = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
    const wordCount = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    const charCount = text.length;

    const parts = [];
    if (countLines) parts.push(String(lineCount).padStart(7));
    if (countWords) parts.push(String(wordCount).padStart(7));
    if (countChars) parts.push(String(charCount).padStart(7));
    this._write(parts.join('') + ' ' + fileArg + '\r\n');
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 23. grep
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_grep(args) {
    let ignoreCase = false;
    let pattern = null;
    let fileArg = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-i') {
        ignoreCase = true;
      } else if (args[i].startsWith('-')) {
        for (const f of args[i].slice(1)) {
          if (f === 'i') ignoreCase = true;
        }
      } else if (pattern === null) {
        pattern = args[i];
      } else {
        fileArg = args[i];
      }
    }

    if (!pattern) {
      this._write(SimulatedShell._color.red('grep: missing pattern') + '\r\n');
      return;
    }
    if (!fileArg) {
      this._write(SimulatedShell._color.red('grep: missing file operand') + '\r\n');
      return;
    }

    const resolved = this._resolvePath(fileArg);
    const entry = this._findEntry(resolved);
    if (!entry) {
      this._write(SimulatedShell._color.red(`grep: ${fileArg}: No such file or directory`) + '\r\n');
      return;
    }
    if (entry.type === 'dir') {
      this._write(SimulatedShell._color.red(`grep: ${fileArg}: Is a directory`) + '\r\n');
      return;
    }

    const lines = entry.content.split('\n');
    // Remove trailing empty element if content ends with newline
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;

    for (const line of lines) {
      const matchLine = ignoreCase ? line.toLowerCase() : line;
      const idx = matchLine.indexOf(searchPattern);
      if (idx !== -1) {
        // Highlight the match in red
        const before = line.slice(0, idx);
        const match = line.slice(idx, idx + pattern.length);
        const after = line.slice(idx + pattern.length);
        this._write(before + SimulatedShell._color.red(match) + after + '\r\n');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 24. which
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_which(args) {
    if (args.length === 0) return;
    const knownCommands = this._getCommandList();
    for (const cmd of args) {
      if (knownCommands.includes(cmd)) {
        this._write(`/usr/bin/${cmd}\r\n`);
      } else {
        this._write(SimulatedShell._color.red(`which: no ${cmd} in (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin)`) + '\r\n');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 25. man
  // ──────────────────────────────────────────────────────────────────────────────
  _cmd_man(args) {
    if (args.length === 0) {
      this._write(SimulatedShell._color.red('What manual page do you want?') + '\r\n');
      return;
    }
    const cmd = args[0];
    const pages = this._getManPages();
    if (pages[cmd]) {
      this._write(pages[cmd] + '\r\n');
    } else {
      this._write(SimulatedShell._color.red(`No manual entry for ${cmd}`) + '\r\n');
    }
  }

  _getManPages() {
    return {
      ls: SimulatedShell._color.bold('LS(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('LS(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       ls - list directory contents\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       ls [OPTION]... [FILE]...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       List information about the FILEs (the current directory by default).\r\n' +
        '       Sort entries alphabetically.\r\n\r\n' +
        '       -a, --all                  do not hide entries starting with .\r\n' +
        '       -l                         use a long listing format\r\n',

      cd: SimulatedShell._color.bold('CD(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('CD(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       cd - change the current working directory\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       cd [DIRECTORY]\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Change the current working directory to DIRECTORY.\r\n' +
        '       The default DIRECTORY is the value of the HOME environment variable.\r\n\r\n' +
        '       Use ".." for parent directory, "." for current directory.\r\n',

      cat: SimulatedShell._color.bold('CAT(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('CAT(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       cat - concatenate files and print on the standard output\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       cat [FILE]...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Concatenate FILE(s) to standard output.\r\n' +
        '       With no FILE, or when FILE is -, read standard input.\r\n',

      echo: SimulatedShell._color.bold('ECHO(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('ECHO(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       echo - display a line of text\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       echo [STRING]...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Echo the STRING(s) to standard output.\r\n' +
        '       Supports $HOME, $USER, $SHELL, $PATH variable expansion.\r\n',

      grep: SimulatedShell._color.bold('GREP(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('GREP(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       grep - print lines that match patterns\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       grep [OPTION]... PATTERN [FILE]...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       grep searches for PATTERN in each FILE.\r\n' +
        '       -i, --ignore-case         ignore case distinctions\r\n',

      ps: SimulatedShell._color.bold('PS(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('PS(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       ps - report a snapshot of the current processes\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       ps [options]\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Displays information about a selection of running processes.\r\n' +
        '       aux     show full process list with user, CPU, memory info\r\n',

      mkdir: SimulatedShell._color.bold('MKDIR(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('MKDIR(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       mkdir - create directories\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       mkdir [OPTION]... DIRECTORY...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Create the DIRECTORY(ies), if they do not already exist.\r\n' +
        '       -p, --parents     no error if existing, make parent directories as needed\r\n',

      rm: SimulatedShell._color.bold('RM(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('RM(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       rm - remove files or directories\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       rm [OPTION]... FILE...\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Remove the FILE(s).\r\n' +
        '       -f, --force           ignore nonexistent files and arguments, never prompt\r\n' +
        '       -r, --recursive       remove directories and their contents recursively\r\n',

      cp: SimulatedShell._color.bold('CP(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('CP(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       cp - copy files and directories\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       cp SOURCE DEST\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Copy SOURCE to DEST.\r\n',

      mv: SimulatedShell._color.bold('MV(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('MV(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       mv - move (rename) files\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       mv SOURCE DEST\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       Rename SOURCE to DEST, or move SOURCE to DIRECTORY.\r\n',

      man: SimulatedShell._color.bold('MAN(1)') + '                    User Commands                    ' + SimulatedShell._color.bold('MAN(1)') + '\r\n\r\n' +
        SimulatedShell._color.bold('NAME') + '\r\n' +
        '       man - an interface to the system reference manuals\r\n\r\n' +
        SimulatedShell._color.bold('SYNOPSIS') + '\r\n' +
        '       man [COMMAND]\r\n\r\n' +
        SimulatedShell._color.bold('DESCRIPTION') + '\r\n' +
        '       man is the system\'s manual pager. Each page argument given to man\r\n' +
        '       is normally the name of a program.\r\n',
    };
  }
}

// Expose globally for browser script-tag use
window.SimulatedShell = SimulatedShell;
