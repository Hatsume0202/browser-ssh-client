const { Client } = require('ssh2');

class SshBridge {
  constructor(ws) {
    this.ws = ws;
    this.sshClient = new Client();
    this.stream = null;
    this._closed = false;
  }

  connect(config, callback) {
    this.sshClient.on('ready', () => {
      this.sshClient.shell(
        { term: 'xterm-256color', cols: 80, rows: 24 },
        (err, stream) => {
          if (err) {
            if (callback) callback(err);
            return;
          }
          this.stream = stream;

          stream.on('data', (data) => {
            if (this.ws.readyState === this.ws.OPEN) {
              this.ws.send(data.toString('utf-8'));
            }
          });

          stream.stderr.on('data', (data) => {
            if (this.ws.readyState === this.ws.OPEN) {
              this.ws.send(data.toString('utf-8'));
            }
          });

          stream.on('close', () => {
            this._cleanup();
            if (this.ws.readyState === this.ws.OPEN) {
              this.ws.close(1000);
            }
          });

          if (callback) callback();
        }
      );
    });

    this.sshClient.on('error', (err) => {
      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.close(1011, err.message);
      }
      if (callback) callback(err);
    });

    this.sshClient.on('close', () => {
      this._cleanup();
    });

    const sshConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: config.readyTimeout || 10000,
    };

    if (config.privateKey) {
      sshConfig.privateKey = config.privateKey;
    } else {
      sshConfig.password = config.password;
    }

    this.sshClient.connect(sshConfig);
  }

  write(data) {
    if (this.stream && this.stream.writable) {
      this.stream.write(data);
    }
  }

  resize(cols, rows) {
    if (this.stream && this.stream.setWindow) {
      this.stream.setWindow(rows, cols, 0, 0);
    }
  }

  close() {
    this._cleanup();
    this.sshClient.end();
  }

  _cleanup() {
    this.stream = null;
  }
}

module.exports = SshBridge;
