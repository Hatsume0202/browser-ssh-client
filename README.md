# BrowserSSH — 浏览器 SSH 客户端

基于 WebSocket 的浏览器端 SSH 客户端，无需任何浏览器扩展或插件。

## 架构

```
浏览器 (xterm.js) ←→ WebSocket ←→ ws-ssh-proxy ←→ SSH 服务器
```

- **前端**: 纯 HTML/CSS/JavaScript，使用 xterm.js 实现终端模拟
- **代理**: Rust 编写的 WebSocket-to-SSH 代理服务器 (ws-ssh-proxy)

## 功能特性

- 密码认证和私钥认证 (支持 OpenSSH 和 PEM 格式)
- xterm.js 终端模拟，支持全色彩和 Unicode
- WebSocket 心跳保活，自动重连
- 终端尺寸自适应
- 无代理时的演示模式 (模拟 Linux shell)

## 快速开始

### 1. 启动 ws-ssh-proxy (Rust WebSocket SSH 代理)

#### 使用 Docker (推荐)

```bash
cd ws-ssh-proxy
docker build -t ws-ssh-proxy .
docker run -d -p 3000:3000 ws-ssh-proxy
```

#### 从源码构建

```bash
cd ws-ssh-proxy
cargo build --release
./target/release/ws-ssh-proxy --bind 0.0.0.0 --port 3000
```

### 2. 打开前端

直接用浏览器打开 `index.html`，或使用任意静态文件服务器:

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 配置选项

### ws-ssh-proxy

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--bind` | `0.0.0.0` | 监听地址 |
| `--port` / `-p` | `3000` | 监听端口 |
| `$PORT` | — | 环境变量，覆盖端口 (Docker 部署) |

## 连接方式

1. 在浏览器中打开前端页面
2. 填写 SSH 连接信息 (主机、端口、用户名)
3. 选择认证方式：密码 或 私钥
4. 填写 WebSocket 代理地址: `ws://localhost:3000/ws` (留空进入演示模式)
5. 点击「连接」

## WebSocket 协议

### 认证请求 (客户端 → 代理)
```json
{
  "type": "connect",
  "host": "example.com",
  "port": 22,
  "username": "root",
  "password": "your-password"
}
```

### 心跳
- 客户端每 30s 发送 `{"type":"ping"}`
- 代理回复 `{"type":"pong"}`

### 终端尺寸变更
```json
{"type": "resize", "cols": 120, "rows": 40}
```

### 数据传输
- 建立连接后，终端输入/输出通过 WebSocket 二进制帧或文本帧直接透传

## 项目结构

```
browser-ssh-client/
├── index.html              # 主页面
├── css/
│   ├── style.css           # 主样式
│   └── terminal-theme.css  # 终端主题
├── js/
│   ├── app.js              # 主应用入口
│   ├── ssh-client.js       # SSH 客户端 (WebSocket)
│   ├── websocket-client.js # WebSocket 客户端封装
│   ├── terminal-ui.js      # 终端 UI (xterm.js)
│   ├── connection-form.js  # 连接表单
│   └── simulated-shell.js  # 演示模式模拟终端
└── ws-ssh-proxy/           # Rust WebSocket SSH 代理
    ├── Cargo.toml
    ├── Dockerfile
    └── src/
        ├── main.rs
        └── handler.rs
```

## 开发

### 前端
纯静态页面，无需构建工具。直接在浏览器中打开 `index.html` 即可。

### ws-ssh-proxy
```bash
cd ws-ssh-proxy
cargo run -- --port 3000
```

## 许可证

MIT
