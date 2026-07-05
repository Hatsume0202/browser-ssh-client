/**
 * TerminalUI - manages an xterm.js terminal instance in a given DOM container.
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

    this._terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'Courier New', Courier, monospace",
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
      },
    });

    this._fitAddon = new FitAddon();
    this._terminal.loadAddon(this._fitAddon);
    this._terminal.open(container);
    this._fitAddon.fit();
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
    this._handler = this._terminal.onData(callback);
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
   * Cleans up the terminal: disposes the input handler and destroys the terminal instance.
   */
  dispose() {
    if (this._handler) {
      this._handler.dispose();
      this._handler = null;
    }
    this._terminal.dispose();
  }
}

