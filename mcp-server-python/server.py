#!/usr/bin/env python3
"""
Session Helper MCP Server
Provides session checkpoint capabilities
"""

import asyncio
import json
import os
import sys
import tempfile
import time
import uuid
from typing import Any
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread, Event

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, ImageContent

# 配置
DEFAULT_EXTENSION_PORT = 23983  # VS Code 扩展默认监听的端口
CALLBACK_PORT_START = 23984   # 回调端口起始值
PORT_FILE_DIR = os.path.join(tempfile.gettempdir(), "sh-ports")

# 当前回调端口（动态分配）
current_callback_port = CALLBACK_PORT_START
# 回调服务器就绪事件
callback_server_ready = Event()

# 存储待处理的请求
pending_requests: dict[str, asyncio.Future] = {}
# 存储事件循环引用（用于跨线程通信）
main_loop: asyncio.AbstractEventLoop | None = None


class CallbackHandler(BaseHTTPRequestHandler):
    """处理来自 VS Code 扩展的回调"""
    
    def log_message(self, format, *args):
        """静默日志"""
        pass
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_POST(self):
        if self.path == "/response":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            
            try:
                data = json.loads(body)
                request_id = data.get("requestId")
                user_input = data.get("userInput", "")
                cancelled = data.get("cancelled", False)
                
                if request_id in pending_requests and main_loop:
                    future = pending_requests.pop(request_id)
                    # 使用 call_soon_threadsafe 跨线程安全地设置 future 结果
                    if cancelled:
                        main_loop.call_soon_threadsafe(future.set_exception, Exception("用户取消了对话"))
                    else:
                        main_loop.call_soon_threadsafe(future.set_result, user_input)
                    
                    print(f"[SH] Received response: {request_id}", file=sys.stderr)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": True}).encode())
                else:
                    self.send_response(404)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Request not found"}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()


def start_callback_server():
    """启动回调服务器"""
    global current_callback_port
    port = CALLBACK_PORT_START
    max_retries = 50  # 增加重试次数支持更多并发窗口
    
    for i in range(max_retries):
        try:
            server = HTTPServer(("127.0.0.1", port), CallbackHandler)
            current_callback_port = port  # 保存成功的端口
            print(f"[SH] Callback server started on port {port}", file=sys.stderr)
            callback_server_ready.set()  # 通知主线程服务器已就绪
            server.serve_forever()
            break
        except OSError as e:
            if e.errno == 10048:  # Windows: 端口被占用
                print(f"[SH] Port {port} in use, trying {port + 1}", file=sys.stderr)
                port += 1
            else:
                print(f"[SH] Callback server error: {e}", file=sys.stderr)
                callback_server_ready.set()  # 即使失败也要通知
                break
        except Exception as e:
            print(f"[SH] Callback server failed to start: {e}", file=sys.stderr)
            callback_server_ready.set()  # 即使失败也要通知
            break


def discover_extension_ports() -> list[int]:
    """
    发现所有正在运行的扩展端口
    """
    ports = []
    if os.path.exists(PORT_FILE_DIR):
        for filename in os.listdir(PORT_FILE_DIR):
            if filename.endswith(".port"):
                try:
                    filepath = os.path.join(PORT_FILE_DIR, filename)
                    with open(filepath, "r") as f:
                        data = json.load(f)
                        port = data.get("port")
                        if port:
                            ports.append(port)
                except Exception:
                    pass
    # 如果没有发现端口文件，返回默认端口
    if not ports:
        ports = [DEFAULT_EXTENSION_PORT]
    return ports


async def request_user_input(reason: str) -> str:
    """
    向 VS Code 扩展发送请求，等待用户输入
    """
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    
    # 创建 Future 来等待响应
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_requests[request_id] = future
    
    # 发现可用的扩展端口
    extension_ports = discover_extension_ports()
    print(f"[SH] Discovered extension ports: {extension_ports}", file=sys.stderr)
    
    # 尝试连接所有发现的端口
    connected = False
    last_error = None
    
    for port in extension_ports:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://127.0.0.1:{port}/ask",
                    json={
                        "type": "session_checkpoint",
                        "requestId": request_id,
                        "reason": reason,
                        "callbackPort": current_callback_port,  # 告诉扩展回调端口
                    },
                    timeout=5.0,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success"):
                        connected = True
                        print(f"[SH] Connected to extension port {port}", file=sys.stderr)
                        break
                elif response.status_code == 500:
                    # 扩展返回错误，可能是 webview 创建失败
                    result = response.json()
                    last_error = f"Extension returned error: {result.get('error', 'unknown')} - {result.get('details', '')}"
                    print(f"[SH] Port {port} returned error: {last_error}", file=sys.stderr)
                    continue
        except httpx.ConnectError:
            last_error = f"Cannot connect to port {port}"
            continue
        except httpx.TimeoutException:
            last_error = f"Connection to port {port} timed out"
            continue
        except Exception as e:
            last_error = str(e)
            continue
    
    if not connected:
        pending_requests.pop(request_id, None)
        raise Exception(f"Cannot connect to any extension. {last_error or ''}")
    
    print(f"[SH] Request {request_id} sent, waiting for input...", file=sys.stderr)
    
    # 等待用户响应（无超时限制）
    user_input = await future
    return user_input


async def main():
    """主函数"""
    global main_loop
    print("[SH] Session Helper MCP Server initializing...", file=sys.stderr)
    
    # 保存事件循环引用，用于跨线程通信
    main_loop = asyncio.get_running_loop()
    
    # 启动回调服务器（在后台线程）
    callback_thread = Thread(target=start_callback_server, daemon=True)
    callback_thread.start()
    
    # 等待回调服务器就绪（最多等待 5 秒）
    if not callback_server_ready.wait(timeout=5.0):
        print("[SH] Warning: Callback server startup timed out", file=sys.stderr)
    
    print(f"[SH] Current callback port: {current_callback_port}", file=sys.stderr)
    
    # 创建 MCP 服务器
    server = Server("session-helper-mcp")
    
    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """列出可用工具"""
        return [
            Tool(
                name="session_checkpoint",
                description="""Create a checkpoint in the current development session.

This tool pauses execution to allow for session state review and additional input.
Use when reaching a logical stopping point or requiring additional context.

Usage: Invoke after completing a task unit or when additional guidance is needed.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Brief description of the current checkpoint status",
                        },
                    },
                    "required": ["reason"],
                },
            )
        ]
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list:
        """处理工具调用"""
        if name == "session_checkpoint":
            reason = arguments.get("reason", "Task completed")
            
            try:
                print(f"[SH] session_checkpoint called, reason: {reason}", file=sys.stderr)
                user_input = await request_user_input(reason)
                
                if not user_input.strip():
                    return [
                        TextContent(
                            type="text",
                            text="User chose to end session. Session ended.",
                        )
                    ]
                
                # 解析用户输入，分离文本和图片
                result = []
                text_parts = []
                
                # 检查是否包含图片数据
                if "[图片已附加]" in user_input:
                    parts = user_input.split("[图片已附加]")
                    if parts[0].strip():
                        text_parts.append(parts[0].strip())
                    
                    # 处理图片部分
                    image_data = parts[1].strip() if len(parts) > 1 else ""
                    
                    # 分割多个图片（以 data:image 开头）
                    import re
                    images = re.findall(r'data:image/([^;]+);base64,([^\s]+)', image_data)
                    
                    # Add text content
                    if text_parts:
                        result.append(TextContent(
                            type="text",
                            text="User wants to continue and provided instructions:\n\n" + ' '.join(text_parts),
                        ))
                    else:
                        result.append(TextContent(
                            type="text",
                            text="User wants to continue and attached an image:",
                        ))
                    
                    # 添加图片内容
                    for mime_subtype, base64_data in images:
                        result.append(ImageContent(
                            type="image",
                            data=base64_data,
                            mimeType=f"image/{mime_subtype}",
                        ))
                    
                    result.append(TextContent(
                        type="text",
                        text="\n\nPlease execute the user's instructions. Invoke session_checkpoint again when done.",
                    ))
                else:
                    result.append(TextContent(
                        type="text",
                        text=f"User provided the following instructions:\n\n{user_input}\n\nPlease execute the instructions above. Invoke session_checkpoint again when done.",
                    ))
                
                return result
                
            except Exception as e:
                return [
                    TextContent(
                        type="text",
                        text=f"Communication error with extension: {str(e)}\n\nPlease ensure the extension is installed and running.",
                    )
                ]
        
        return [
            TextContent(
                type="text",
                text=f"未知工具: {name}",
            )
        ]
    
    # 启动服务器
    print("[SH] Session Helper MCP Server started", file=sys.stderr)
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
