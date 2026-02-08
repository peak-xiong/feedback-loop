#!/usr/bin/env python3
"""
Session Helper MCP Server - Entry Point
Provides io/pause/join/recall tools for AI session management.
"""

import asyncio
import sys
import uuid
from http.server import HTTPServer
from threading import Thread, Event
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server

from config import CALLBACK_PORT_START, DEFAULT_EXT_PORT
from handlers.http_handler import CallbackHandler
from handlers.mcp_tools import get_tool_definitions, handle_tool_call
from utils.discovery import discover_ext_ports
from utils.response import parse_user_response


# =============================================================================
# Database Setup (Optional)
# =============================================================================

DB_ENABLED = False
try:
    from models import (
        init_db, save_request, save_response,
        get_recent_sessions, get_pending_requests, get_all_agents
    )
    DB_ENABLED = True
    init_db()
except ImportError as e:
    print(f"[--] Database not available: {e}", file=sys.stderr)


# =============================================================================
# Global State
# =============================================================================

callback_port = CALLBACK_PORT_START
callback_ready = Event()
pending_requests: dict[str, asyncio.Future] = {}
event_loop: asyncio.AbstractEventLoop | None = None


# =============================================================================
# Callback Server
# =============================================================================

def run_callback_server():
    """Start callback server on available port."""
    global callback_port
    
    # Inject dependencies into handler
    CallbackHandler.pending_requests = pending_requests
    CallbackHandler.event_loop = event_loop
    CallbackHandler.db_enabled = DB_ENABLED
    if DB_ENABLED:
        CallbackHandler.get_recent_sessions = get_recent_sessions
        CallbackHandler.get_pending_requests = get_pending_requests
        CallbackHandler.get_all_agents = get_all_agents
        CallbackHandler.save_response = save_response
    
    for port in range(CALLBACK_PORT_START, CALLBACK_PORT_START + 20):
        try:
            server = HTTPServer(("127.0.0.1", port), CallbackHandler)
            callback_port = port
            callback_ready.set()
            print(f"[✓] Callback server on port {port}", file=sys.stderr)
            server.serve_forever()
            break
        except OSError:
            continue


# =============================================================================
# User Input Request
# =============================================================================

async def request_input(
    reason: str, 
    options: list = None, 
    is_pause: bool = False
) -> str:
    """Send request to extension and wait for user input."""
    callback_ready.wait(timeout=10)
    
    request_id = str(uuid.uuid4())
    future: asyncio.Future = asyncio.get_event_loop().create_future()
    pending_requests[request_id] = future
    
    # Discover extension ports
    ext_ports = discover_ext_ports()
    if not ext_ports:
        ext_ports = [DEFAULT_EXT_PORT]
    
    # Prepare payload
    payload = {
        "requestId": request_id,
        "reason": reason,
        "callbackPort": callback_port,
    }
    if options:
        payload["options"] = options
    
    # Save to DB
    if DB_ENABLED:
        try:
            save_request(request_id, reason, options, is_pause=is_pause)
        except Exception as e:
            print(f"[--] DB save error: {e}", file=sys.stderr)
    
    # Send to extension
    sent = False
    async with httpx.AsyncClient(timeout=5) as client:
        for port in ext_ports:
            try:
                resp = await client.post(
                    f"http://127.0.0.1:{port}/notify",
                    json=payload
                )
                if resp.status_code == 200:
                    sent = True
                    break
            except Exception:
                continue
    
    if not sent:
        pending_requests.pop(request_id, None)
        raise Exception("No extension available")
    
    # Wait for response
    return await future


# =============================================================================
# Main Entry Point
# =============================================================================

async def main():
    """Initialize and run MCP server."""
    global event_loop
    event_loop = asyncio.get_event_loop()
    
    # Start callback server in background
    server_thread = Thread(target=run_callback_server, daemon=True)
    server_thread.start()
    
    # Create MCP server
    server = Server("io-util")
    
    @server.list_tools()
    async def list_tools():
        return get_tool_definitions()
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]):
        results = await handle_tool_call(
            name, arguments, request_input, DB_ENABLED
        )
        
        # Parse response for io tool (may contain images)
        if name == "io" and results:
            first_result = results[0]
            if hasattr(first_result, 'text'):
                return parse_user_response(first_result.text)
        
        return results
    
    # Run server
    options = server.create_initialization_options()
    async with stdio_server() as (read, write):
        await server.run(read, write, options)


if __name__ == "__main__":
    asyncio.run(main())
