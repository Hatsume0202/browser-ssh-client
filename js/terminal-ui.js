/**
 * TerminalUI - manages an xterm.js terminal instance in a given DOM container.
 * Runs entirely in the browser using xterm.js and xterm-addon-fit loaded from CDN.
 */
class TerminalUI {
  /**
   * @param {string} containerId - The id of the DOM element to mount the terminal into.
   * @throws {Error} If no element with the given id is found.
   */
  constructor(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`TerminalUI: container element "#${containerId}" not found`);
    }

    this._handler = null;
    this._dataCallback = null;
    this._resizeHandler = null;
    this._containerId = containerId;
    this._container = container;
    this._contextMenu = null;

    this._terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'Courier New', Courier, monospace",
      allowTransparency: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
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
        brightWhite: '#e5e5e5',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff',
        cursorAccent: '#1e1e1e',
      },
    });

    this._fitAddon = new FitAddon();
    this._terminal.loadAddon(this._fitAddon);
    this._terminal.open(container);
    this._fitAddon.fit();

    // ResizeObserver for auto-fitting
    this._resizeObserver = new ResizeObserver(() => {
      this.fit();
      if (this._resizeHandler) {
        try {
          const cols = this._terminal.cols;
          const rows = this._terminal.rows;
          this._resizeHandler(cols, rows);
        } catch (e) {
          console.warn('TerminalUI resize callback error:', e);
        }
      }
    });
    this._resizeObserver.observe(container);

    // Set up keyboard shortcuts
    this._setupClipboardHandlers();
    // Set up right-click menu
    this._setupRightClickMenu();
  }

  /**
   * Writes a string of data to the terminal.
   * @param {string} data
   */
  write(data) {
    this._terminal.write(data);
  }

  /**
   * Registers a callback for user input from the terminal.
   * The previous handler (if any) is automatically disposed before registering a new one.
   * @param {function(string): void} callback - Called with each chunk of user input.
   */
  onData(callback) {
    if (this._handler) {
      this._handler.dispose();
    }
    this._dataCallback = callback;
    this._handler = this._terminal.onData(callback);
  }

  /**
   * Registers a callback for terminal resize events.
   * The callback is invoked with (cols, rows) when the terminal size changes via fit().
   * @param {function(number, number): void} callback - Called with cols and rows.
   */
  onResize(callback) {
    this._resizeHandler = callback;
  }

  /**
   * Adjusts the terminal dimensions to fill its container.
   * Catches and logs any errors silently.
   */
  fit() {
    try {
      this._fitAddon.fit();
    } catch (err) {
      console.warn('TerminalUI.fit() failed:', err);
    }
  }

  /**
   * Resets the terminal to its initial state.
   */
  reset() {
    this._terminal.reset();
  }

  /**
   * Focuses the terminal.
   */
  focus() {
    this._terminal.focus();
  }

  /**
   * Selects all content in the terminal.
   */
  selectAll() {
    this._terminal.selectAll();
  }

  /**
   * Returns the currently selected text in the terminal.
   * @returns {string}
   */
  getSelection() {
    return this._terminal.getSelection();
  }

  /**
   * Cleans up the terminal: disposes the input handler, resize observer,
   * context menu elements, and destroys the terminal instance.
   */
  dispose() {
    if (this._handler) {
      this._handler.dispose();
      this._handler = null;
    }
    this._dataCallback = null;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this._removeContextMenu();

    if (this._terminal) {
      this._terminal.dispose();
      this._terminal = null;
    }

    this._container = null;
    this._resizeHandler = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sets up keyboard shortcuts for copy (Ctrl+Insert / Ctrl+C when selected)
   * and paste (Shift+Insert).
   */
  _setupClipboardHandlers() {
    const termElement = this._terminal.element;
    if (!termElement) return;

    termElement.addEventListener('keydown', (e) => {
      try {
        // Copy: Ctrl+Insert, or Ctrl+C when text is selected
        if ((e.ctrlKey && e.key === 'Insert') || (e.ctrlKey && e.key === 'c' && this._terminal.hasSelection())) {
          e.preventDefault();
          this._copyToClipboard(this._terminal.getSelection());
          return;
        }

        // Paste: Shift+Insert
        if (e.shiftKey && e.key === 'Insert') {
          e.preventDefault();
          this._pasteFromClipboard();
          return;
        }
      } catch (err) {
        console.warn('TerminalUI clipboard key handler error:', err);
      }
    });
  }

  /**
   * Creates and manages a custom right-click context menu with Copy, Paste, Reset,
   * and Select All options. The menu is styled with a dark theme.
   */
  _setupRightClickMenu() {
    const container = this._container;
    if (!container) return;

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._removeContextMenu();

      const menu = document.createElement('div');
      menu.className = 'terminal-context-menu';
      menu.style.cssText = [
        'position: fixed',
        'z-index: 1000',
        'background: #2d2d2d',
        'color: #ffffff',
        'border: 1px solid #444444',
        'border-radius: 4px',
        'padding: 4px 0',
        'min-width: 120px',
        'box-shadow: 0 4px 12px rgba(0,0,0,0.5)',
        'font-family: "Segoe UI", Arial, sans-serif',
        'font-size: 13px',
        'user-select: none',
      ].join(';');

      const items = [
        { label: '📋 Copy', action: () => {
          this._copyToClipboard(this._terminal.getSelection());
          this._removeContextMenu();
        }},
        { label: '📝 Paste', action: () => {
          this._pasteFromClipboard();
          this._removeContextMenu();
        }},
        { label: '🔄 Reset', action: () => {
          this.reset();
          this._removeContextMenu();
        }},
        { label: '🔍 Select All', action: () => {
          this.selectAll();
          this._removeContextMenu();
        }},
      ];

      items.forEach((item) => {
        const div = document.createElement('div');
        div.textContent = item.label;
        div.style.cssText = [
          'padding: 6px 16px',
          'cursor: pointer',
          'white-space: nowrap',
        ].join(';');
        div.addEventListener('mouseenter', () => {
          div.style.background = '#094771';
        });
        div.addEventListener('mouseleave', () => {
          div.style.background = 'transparent';
        });
        div.addEventListener('click', (ev) => {
          ev.stopPropagation();
          item.action();
        });
        menu.appendChild(div);
      });

      menu.style.left = Math.min(e.clientX, window.innerWidth - 130) + 'px';
      menu.style.top = Math.min(e.clientY, window.innerHeight - 160) + 'px';

      document.body.appendChild(menu);
      this._contextMenu = menu;

      // Hide menu on click anywhere else
      this._contextMenuOutsideHandler = (ev) => {
        if (this._contextMenu && !this._contextMenu.contains(ev.target)) {
          this._removeContextMenu();
        }
      };
      // Use setTimeout to avoid the same click that opened the menu from closing it
      setTimeout(() => {
        document.addEventListener('click', this._contextMenuOutsideHandler);
      }, 0);

      // Hide menu on ESC
      this._contextMenuEscHandler = (ev) => {
        if (ev.key === 'Escape') {
          this._removeContextMenu();
        }
      };
      document.addEventListener('keydown', this._contextMenuEscHandler);
    });
  }

  /**
   * Removes the custom context menu from the DOM and cleans up event listeners.
   */
  _removeContextMenu() {
    if (this._contextMenu) {
      if (this._contextMenu.parentNode) {
        this._contextMenu.parentNode.removeChild(this._contextMenu);
      }
      this._contextMenu = null;
    }
    if (this._contextMenuOutsideHandler) {
      document.removeEventListener('click', this._contextMenuOutsideHandler);
      this._contextMenuOutsideHandler = null;
    }
    if (this._contextMenuEscHandler) {
      document.removeEventListener('keydown', this._contextMenuEscHandler);
      this._contextMenuEscHandler = null;
    }
  }

  /**
   * Copies the provided text to the clipboard.
   * Uses navigator.clipboard.writeText() with a fallback to document.execCommand('copy').
   * @param {string} text
   */
  _copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        this._fallbackCopy(text);
      });
    } else {
      this._fallbackCopy(text);
    }
  }

  /**
   * Fallback copy method using a temporary textarea and document.execCommand('copy').
   * @param {string} text
   */
  _fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.warn('TerminalUI fallback copy failed:', err);
    }
  }

  /**
   * Reads text from the clipboard and sends it to the terminal's onData handler.
   */
  _pasteFromClipboard() {
    const doPaste = (text) => {
      if (text && this._dataCallback) {
        // Send pasted text character by character to match user input
        for (let i = 0; i < text.length; i++) {
          this._dataCallback(text.charAt(i));
        }
      }
    };

    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText()
        .then((text) => { doPaste(text); })
        .catch(() => {
          this._fallbackPaste(doPaste);
        });
    } else {
      this._fallbackPaste(doPaste);
    }
  }

  /**
   * Fallback paste method using a temporary textarea and document.execCommand('paste').
   * @param {function(string): void} callback
   */
  _fallbackPaste(callback) {
    try {
      const textarea = document.createElement('textarea');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      document.execCommand('paste');
      const text = textarea.value;
      document.body.removeChild(textarea);
      callback(text);
    } catch (err) {
      console.warn('TerminalUI fallback paste failed:', err);
    }
  }
}

window.TerminalUI = TerminalUI;
