# 🖥️ 浏览器 SSH 客户端 (Browser SSH Client)

> **纯前端 SSH 客户端** — 在浏览器中通过 xterm.js 终端模拟器连接 SSH 服务器

![架构图](https://img.shields.io/badge/架构-前端_+_WebSocket_代理-blue)
![纯静态](https://img.shields.io/badge/前端-纯静态_HTML/CSS/JS-brightgreen)
![xterm.js](https://img.shields.io/badge/终端-xterm.js-orange)

## 📋 项目简介

本项目实现了一个**在浏览器中运行的 SSH 客户端**。由于浏览器安全沙箱限制（无法直接建立原始 TCP 连接），采用 **前端终端 + 轻量级代理桥接** 的架构：

```
┌─────────────┐     WebSocket      ┌──────────────┐     SSH 协议     ┌─────────────┐
│  浏览器      │ ◄──────────────►  │  代理服务器    │ ◄──────────────► │  SSH 服务器  │
│  (xterm.js)  │                   │ (Python/Node)  │                  │ (sshd)      │
└─────────────┘                    └──────────────┘                  └─────────────┘
```

**前端部分完全静态**（HTML + CSS + JavaScript），可直接通过浏览器打开或托管在 GitHub Pages。

## ✨ 功能特性

- ✅ **终端模拟器** — 使用 xterm.js，支持 256 色、中文显示、复制粘贴
- ✅ **密码认证** — 输入 SSH 密码登录
- ✅ **私钥认证** — 支持 RSA/Ed25519 私钥认证
- ✅ **自适应大小** — 终端自动适应窗口大小
- ✅ **响应式布局** — 桌面和移动设备均适用
- ✅ **深色主题** — 护眼暗色设计，类 VS Code 风格
- ✅ **无需构建工具** — 直接打开 HTML 文件即可运行
- ✅ **双代理选项** — 提供 Python 和 Node.js 两种代理实现

## 🚀 快速开始

### 方法一：使用 Python 代理（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/browser-ssh-client.git
cd browser-ssh-client

# 2. 安装 Python 依赖
pip install websockets asyncssh

# 3. 启动代理服务器
python proxy/ws-ssh-proxy.py

# 4. 在浏览器中打开前端
#    直接用浏览器打开 index.html 文件
#    或使用 Python 自带的 HTTP 服务器：
#    python -m http.server 8080
#    然后访问 http://localhost:8080
```

### 方法二：使用 Node.js 代理

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/browser-ssh-client.git
cd browser-ssh-client

# 2. 安装依赖
npm install

# 3. 启动（同时提供前端页面和 WebSocket 代理）
npm start
# 访问 http://localhost:3000

# 或分别启动：
#   node proxy/server.js     # 前端 + WebSocket 代理（端口 3000）
#   python proxy/ws-ssh-proxy.py  # 仅 Python WebSocket 代理（端口 8765）
```

## 📖 使用说明

### 连接 SSH 服务器

1. 打开浏览器访问前端页面
2. 填写连接信息：
   - **主机地址**：SSH 服务器 IP 或域名
   - **端口**：SSH 端口（默认 22）
   - **用户名**：登录用户名
   - **认证方式**：选择密码或私钥
   - **密码/私钥**：填写对应的认证凭据
   - **代理地址**：WebSocket 代理地址（默认自动识别，通常无需修改）
3. 点击 **连接** 按钮
4. 连接成功后将自动显示终端界面

### 断开连接

- 点击左侧面板的 **断开** 按钮
- 或直接关闭浏览器标签页（自动清理会话）

### 使用私钥认证

1. 在认证方式中选择「私钥认证」
2. 将私钥内容（包括 `-----BEGIN...` 和 `-----END...` 标记）粘贴到文本框中
3. 支持 OpenSSH 格式的私钥（`id_rsa`、`id_ed25519` 等）

> ⚠️ **安全提示**：私钥仅在浏览器内存中传输到代理服务器，不会持久化存储。

## 🔧 代理服务器配置

### Python 代理

```bash
python proxy/ws-ssh-proxy.py --port 8765 --verbose
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | 8765 | WebSocket 监听端口 |
| `--host` | 0.0.0.0 | 监听地址 |
| `--verbose` / `-v` | 关闭 | 输出详细日志 |

### Node.js 代理

```bash
PORT=3000 node proxy/server.js
```

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PORT` | 3000 | HTTP + WebSocket 监听端口 |

## 🏗️ 技术架构

### 前端 (`js/`)

| 文件 | 功能 |
|------|------|
| `app.js` | 主应用逻辑，协调各模块 |
| `connection-form.js` | 连接表单管理 |
| `terminal-ui.js` | xterm.js 终端封装 |
| `websocket-client.js` | WebSocket 通信层 |

### 代理 (`proxy/`)

| 文件 | 功能 |
|------|------|
| `ws-ssh-proxy.py` | Python 代理（推荐） |
| `server.js` | Node.js 代理（含静态文件服务） |
| `ssh-bridge.js` | Node.js SSH 桥接核心 |

### 样式 (`css/`)

| 文件 | 功能 |
|------|------|
| `style.css` | 主样式，响应式布局 |
| `terminal-theme.css` | xterm.js 主题覆写 |

## 📦 项目结构

```
browser-ssh-client/
├── index.html              # 主页面
├── css/
│   ├── style.css           # 主样式
│   └── terminal-theme.css  # 终端主题
├── js/
│   ├── app.js              # 主应用逻辑
│   ├── connection-form.js  # 连接表单
│   ├── terminal-ui.js      # 终端管理
│   └── websocket-client.js # WebSocket 客户端
├── proxy/
│   ├── ws-ssh-proxy.py     # Python 代理
│   ├── server.js           # Node.js 代理
│   ├── ssh-bridge.js       # SSH 桥接
│   ├── test/               # 单元测试
│   └── requirements.txt    # Python 依赖
├── package.json            # Node.js 依赖
├── README.md               # 本文件
└── LICENSE                 # MIT 许可证
```

## ⚠️ 常见问题 (FAQ)

### 为什么需要代理服务器？

浏览器安全模型**禁止**网页直接发起原始 TCP 连接（这是 SSH 协议所需的）。代理服务器作为一个轻量级的桥接层，将浏览器的 WebSocket 连接转发到 SSH 服务器的 TCP 连接。**代理不会解密 SSH 流量** — SSH 加密是端到端的。

### 可以在没有服务器的环境下使用吗？

不能。由于浏览器无法直接建立 TCP 连接，必须有至少一个 WebSocket 到 TCP 的桥接组件。但你可以：
- 在前端使用 **GitHub Pages** 托管（纯静态）
- 在本地或内网服务器上运行代理
- 代理可以运行在 SSH 服务器本机上

### 如何自定义 WebSocket 地址？

前端默认自动连接到当前页面的地址。如果你使用独立的代理服务器：
1. 在连接面板的「代理地址」字段中填入 `ws://代理IP:端口/ws`
2. Python 代理默认地址：`ws://localhost:8765`
3. Node.js 代理默认地址：`ws://localhost:3000/ws`

### 支持 SSH 密钥文件上传吗？

当前版本支持将私钥内容粘贴到文本框。从文件选择器上传的功能正在开发中。

### 连接后显示乱码？

xterm.js 默认支持 UTF-8 编码。如果遇到乱码，请确保 SSH 服务器的 locale 设置正确（如 `LANG=en_US.UTF-8`）。

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [xterm.js](https://xtermjs.org/) — 浏览器终端模拟器
- [ssh2](https://github.com/mscdex/ssh2) — Node.js SSH2 客户端
- [asyncssh](https://github.com/ronf/asyncssh) — Python SSH 客户端
- [websockets](https://github.com/aaugustin/websockets) — Python WebSocket 库
