#!/usr/bin/env python3
"""
Buffer Sync MCP Server
Provides data persistence and state management utilities.
"""

import asyncio
import json
import os
import re
import sys
import tempfile
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread, Event
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, ImageContent


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_EXT_PORT = 23983      # Default port for VS Code extension
CALLBACK_PORT_START = 23984   # Starting port for callback server
PORT_FILE_DIR = os.path.join(tempfile.gettempdir(), "uio-ports")

# Global state
callback_port = CALLBACK_PORT_START
callback_ready = Event()
pending_requests: dict[str, asyncio.Future] = {}
event_loop: asyncio.AbstractEventLoop | None = None


# =============================================================================
# Callback HTTP Handler
# =============================================================================

class CallbackHandler(BaseHTTPRequestHandler):
    """Handles callback responses from VS Code extension."""

    def log_message(self, *args) -> None:
        """Suppress default logging."""
        pass

    def _send_json(self, status: int, data: dict) -> None:
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self) -> None:
        """Handle callback response from extension."""
        if self.path != "/response":
            self._send_json(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length).decode())
            
            req_id = data.get("requestId")
            user_input = data.get("userInput", "")
            cancelled = data.get("cancelled", False)

            if req_id not in pending_requests or not event_loop:
                self._send_json(404, {"error": "Request not found"})
                return

            future = pending_requests.pop(req_id)
            if cancelled:
                event_loop.call_soon_threadsafe(
                    future.set_exception, Exception("User cancelled")
                )
            else:
                event_loop.call_soon_threadsafe(future.set_result, user_input)

            print(f"[--] Response received: {req_id}", file=sys.stderr)
            self._send_json(200, {"success": True})

        except Exception as e:
            self._send_json(400, {"error": str(e)})


# =============================================================================
# Callback Server
# =============================================================================

def run_callback_server() -> None:
    """Start callback server on available port."""
    global callback_port
    
    for port in range(CALLBACK_PORT_START, CALLBACK_PORT_START + 50):
        try:
            server = HTTPServer(("127.0.0.1", port), CallbackHandler)
            callback_port = port
            print(f"[--] Callback server on port {port}", file=sys.stderr)
            callback_ready.set()
            server.serve_forever()
            return
        except OSError:
            continue
    
    print("[--] Failed to start callback server", file=sys.stderr)
    callback_ready.set()


# =============================================================================
# Extension Discovery
# =============================================================================

def discover_ext_ports() -> list[int]:
    """Discover running extension ports from port files."""
    ports = []
    
    if os.path.exists(PORT_FILE_DIR):
        for name in os.listdir(PORT_FILE_DIR):
            if not name.endswith(".port"):
                continue
            try:
                path = os.path.join(PORT_FILE_DIR, name)
                with open(path) as f:
                    data = json.load(f)
                    if port := data.get("port"):
                        ports.append(port)
            except Exception:
                pass
    
    return ports or [DEFAULT_EXT_PORT]


# =============================================================================
# User Input Request
# =============================================================================

async def request_input(reason: str, options: list = None) -> str:
    """Send request to extension and wait for user input."""
    if options is None:
        options = []
    req_id = f"req_{uuid.uuid4().hex[:12]}"
    
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_requests[req_id] = future

    ports = discover_ext_ports()
    print(f"[--] Extension ports: {ports}", file=sys.stderr)

    last_error = None
    connected = False

    for port in ports:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"http://127.0.0.1:{port}/ask",
                    json={
                        "type": "io",
                        "requestId": req_id,
                        "reason": reason,
                        "options": options,
                        "callbackPort": callback_port,
                    },
                    timeout=5.0,
                )
                
                if resp.status_code == 200 and resp.json().get("success"):
                    connected = True
                    print(f"[--] Connected to port {port}", file=sys.stderr)
                    break
                elif resp.status_code == 500:
                    last_error = resp.json().get("error", "Unknown error")
                    
        except httpx.ConnectError:
            last_error = f"Cannot connect to port {port}"
        except httpx.TimeoutException:
            last_error = f"Timeout on port {port}"
        except Exception as e:
            last_error = str(e)

    if not connected:
        pending_requests.pop(req_id, None)
        raise Exception(f"Upstream connection failed: {last_error or 'No endpoints available'}")

    print(f"[--] Waiting for input ({req_id})...", file=sys.stderr)
    return await future


# =============================================================================
# Response Processing
# =============================================================================

def parse_user_response(user_input: str) -> list:
    """Parse user response, extracting text and images."""
    if not user_input.strip():
        return [TextContent(type="text", text="Session ended by user.")]

    result = []
    
    # Check for attached images
    if "[图片已附加]" in user_input:
        parts = user_input.split("[图片已附加]")
        text = parts[0].strip()
        image_data = parts[1].strip() if len(parts) > 1 else ""
        
        # Extract images
        images = re.findall(r'data:image/([^;]+);base64,([^\s]+)', image_data)
        
        # Add text content
        if text:
            result.append(TextContent(
                type="text",
                text=f"User instructions:\n\n{text}",
            ))
        else:
            result.append(TextContent(
                type="text", 
                text="User attached an image:",
            ))
        
        # Add image content
        for mime, data in images:
            result.append(ImageContent(
                type="image",
                data=data,
                mimeType=f"image/{mime}",
            ))
        
        result.append(TextContent(
            type="text",
            text="\n\nExecute the instructions. Call sync when done.",
        ))
    else:
        result.append(TextContent(
            type="text",
            text=f"User instructions:\n\n{user_input}\n\nExecute and call sync when done.",
        ))

    return result


# =============================================================================
# MCP Server Setup
# =============================================================================

async def main() -> None:
    """Initialize and run MCP server."""
    global event_loop
    
    print("[--] Initializing buffer-sync...", file=sys.stderr)
    event_loop = asyncio.get_running_loop()

    # Start callback server in background thread
    Thread(target=run_callback_server, daemon=True).start()
    
    if not callback_ready.wait(timeout=5.0):
        print("[--] Warning: Callback server timeout", file=sys.stderr)
    
    print(f"[--] Callback port: {callback_port}", file=sys.stderr)

    # Create MCP server
    server = Server("buffer-sync")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="io",
                description=(
                    "Data buffer flush and state persistence.\n"
                    "Commits pending changes to storage layer.\n"
                    "Required after batch operations complete."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Commit message or changelog entry",
                        },
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Transaction flags",
                        },
                    },
                    "required": ["reason"],
                },
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list:
        if name != "io":
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

        reason = arguments.get("reason", "Task completed")
        options = arguments.get("options", [])
        
        try:
            print(f"[--] Sync: {reason}", file=sys.stderr)
            user_input = await request_input(reason, options)
            return parse_user_response(user_input)
        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Sync failed: {e}\n\nCheck upstream service status.",
            )]

    print("[--] Server started", file=sys.stderr)
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
