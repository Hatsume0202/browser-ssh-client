#!/usr/bin/env python3
"""
WebSocket ↔ SSH 代理服务器
将浏览器端的 WebSocket 连接桥接到 SSH 服务器

用法:
    python proxy/ws-ssh-proxy.py              # 默认监听 0.0.0.0:8765
    python proxy/ws-ssh-proxy.py --port 3000   # 自定义端口
    python proxy/ws-ssh-proxy.py --verbose     # 详细日志

依赖:
    pip install websockets asyncssh
"""

import asyncio
import json
import argparse
import sys
import logging

try:
    import websockets
except ImportError:
    print("错误: 需要安装 websockets 库")
    print("  pip install websockets")
    sys.exit(1)

try:
    import asyncssh
except ImportError:
    print("错误: 需要安装 asyncssh 库")
    print("  pip install asyncssh")
    sys.exit(1)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('ws-ssh-proxy')


class SshSession:
    """
    管理单个 SSH 会话
    每个 WebSocket 连接对应一个 SshSession 实例
    """
    
    def __init__(self, websocket):
        self.websocket = websocket
        self.ssh_connection = None
        self.ssh_channel = None
        self._closed = False
    
    async def connect(self, config):
        """
        建立 SSH 连接
        
        Args:
            config: 包含 host, port, username, password/privateKey 的字典
        """
        try:
            # 构建 SSH 连接参数
            ssh_config = {
                'host': config['host'],
                'port': int(config.get('port', 22)),
                'username': config['username'],
                'known_hosts': None,  # 禁用 host key 检查（简化使用）
            }
            
            # 认证方式：密码或私钥
            if 'password' in config and config['password']:
                ssh_config['password'] = config['password']
            elif 'privateKey' in config and config['privateKey']:
                ssh_config['client_keys'] = [config['privateKey']]
            
            logger.info(f"正在连接 SSH {config['username']}@{config['host']}:{config.get('port', 22)}...")
            
            # 建立 SSH 连接
            self.ssh_connection = await asyncio.wait_for(
                asyncssh.connect(**ssh_config),
                timeout=15
            )
            
            logger.info(f"SSH 连接成功: {config['host']}")
            
            # 打开交互式 Shell 会话
            self.ssh_channel = await self.ssh_connection.open_session(
                term_type='xterm-256color',
                term_size=(80, 24)
            )
            
            # 发送连接成功消息
            await self.websocket.send(json.dumps({
                'type': 'connected',
                'message': f'SSH 会话已建立: {config["username"]}@{config["host"]}'
            }))
            
            # 开始转发 SSH 输出到 WebSocket
            asyncio.create_task(self._forward_output())
            
        except asyncio.TimeoutError:
            logger.error(f"SSH 连接超时: {config['host']}")
            await self._send_error(f"连接超时: {config['host']}:{config.get('port', 22)}")
            raise
        except asyncssh.Error as e:
            logger.error(f"SSH 连接失败: {e}")
            await self._send_error(f"SSH 连接失败: {e}")
            raise
        except Exception as e:
            logger.error(f"未知错误: {e}")
            await self._send_error(f"错误: {e}")
            raise
    
    async def _forward_output(self):
        """将 SSH 会话输出转发到 WebSocket"""
        try:
            async for data in self.ssh_channel:
                if self._closed:
                    break
                if isinstance(data, str):
                    await self.websocket.send(data)
                else:
                    await self.websocket.send(data.decode('utf-8', errors='replace'))
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"转发输出时出错: {e}")
        finally:
            await self._cleanup()
    
    async def write_input(self, data):
        """将 WebSocket 收到的用户输入发送到 SSH 会话"""
        if self.ssh_channel and not self._closed:
            try:
                self.ssh_channel.write(data)
            except Exception as e:
                logger.error(f"写入输入时出错: {e}")
    
    async def resize(self, cols, rows):
        """调整终端大小"""
        if self.ssh_channel and not self._closed:
            try:
                self.ssh_channel.change_terminal_size(columns=cols, rows=rows)
                logger.debug(f"终端大小调整: {cols}x{rows}")
            except Exception as e:
                logger.error(f"调整终端大小时出错: {e}")
    
    async def _send_error(self, message):
        """发送错误消息到 WebSocket"""
        try:
            await self.websocket.send(json.dumps({
                'type': 'error',
                'message': message
            }))
        except:
            pass
    
    async def _cleanup(self):
        """清理 SSH 会话资源"""
        self._closed = True
        if self.ssh_channel:
            try:
                self.ssh_channel.close()
            except:
                pass
            self.ssh_channel = None
        if self.ssh_connection:
            try:
                self.ssh_connection.close()
            except:
                pass
            self.ssh_connection = None
        logger.info("SSH 会话已清理")
    
    async def close(self):
        """关闭整个会话"""
        self._closed = True
        await self._cleanup()


async def handle_websocket(websocket):
    """
    处理单个 WebSocket 连接
    
    消息协议:
    - 客户端 → 服务端 (JSON):
        {"type": "connect", "host": "...", "port": 22, "username": "...", "password": "..."}
        {"type": "resize", "cols": 80, "rows": 24}
        {"type": "disconnect"}
    - 客户端 → 服务端 (二进制/文本): 发送到 SSH stdin
    - 服务端 → 客户端 (文本): SSH stdout/stderr 输出
    - 服务端 → 客户端 (JSON):
        {"type": "connected", "message": "..."}
        {"type": "error", "message": "..."}
    """
    session = SshSession(websocket)
    logger.info("新的 WebSocket 客户端已连接")
    
    try:
        async for message in websocket:
            # 尝试解析 JSON 消息
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                # 如果不是 JSON，作为终端输入转发
                if session.ssh_channel:
                    await session.write_input(message)
                continue
            
            # 处理 JSON 消息
            msg_type = data.get('type', '')
            
            if msg_type == 'connect':
                try:
                    await session.connect(data)
                except Exception as e:
                    logger.error(f"连接失败: {e}")
                    # 连接失败后关闭 WebSocket
                    break
            
            elif msg_type == 'resize':
                cols = data.get('cols', 80)
                rows = data.get('rows', 24)
                await session.resize(cols, rows)
            
            elif msg_type == 'disconnect':
                logger.info("客户端请求断开")
                break
    
    except websockets.exceptions.ConnectionClosed:
        logger.info("WebSocket 连接已关闭")
    except Exception as e:
        logger.error(f"WebSocket 处理错误: {e}")
    finally:
        await session.close()


async def main():
    """主函数：启动 WebSocket 服务器"""
    parser = argparse.ArgumentParser(description='WebSocket ↔ SSH 代理服务器')
    parser.add_argument('--port', type=int, default=8765,
                       help='WebSocket 服务器端口 (默认: 8765)')
    parser.add_argument('--host', type=str, default='0.0.0.0',
                       help='监听地址 (默认: 0.0.0.0)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='详细日志输出')
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info(f"WebSocket SSH 代理服务器启动...")
    logger.info(f"监听地址: {args.host}:{args.port}")
    logger.info(f"前端连接地址: ws://localhost:{args.port}")
    logger.info("等待客户端连接...")
    
    async with websockets.serve(handle_websocket, args.host, args.port):
        await asyncio.Future()  # 永久运行


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except Exception as e:
        print(f"启动失败: {e}")
        sys.exit(1)
