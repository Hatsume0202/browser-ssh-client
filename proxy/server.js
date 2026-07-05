const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const SshBridge = require('./ssh-bridge');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? 'index.html' : req.url;
  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const indexPath = path.join(ROOT, 'index.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Client connected');
  let bridge = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      if (bridge) {
        bridge.write(raw);
      }
      return;
    }

    switch (data.type) {
      case 'connect':
        bridge = new SshBridge(ws);
        bridge.connect(data, (err) => {
          if (err) {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: err.message }));
            }
            return;
          }
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'connected', message: 'SSH session established' }));
          }
        });
        break;

      case 'resize':
        if (bridge) {
          bridge.resize(data.cols, data.rows);
        }
        break;

      case 'disconnect':
        if (bridge) {
          bridge.close();
          bridge = null;
        }
        break;
    }
  });

  ws.on('close', () => {
    if (bridge) {
      bridge.close();
      bridge = null;
    }
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    if (bridge) {
      bridge.close();
      bridge = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint at ws://localhost:${PORT}/ws`);
});
