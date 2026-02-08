"""
HTTP callback handler for extension communication.
"""

import json
import sys
from http.server import BaseHTTPRequestHandler


class CallbackHandler(BaseHTTPRequestHandler):
    """Handles callback responses from VS Code extension."""
    
    # These will be set by the main module
    pending_requests: dict = {}
    event_loop = None
    db_enabled: bool = False
    
    # DB functions (injected)
    get_recent_sessions = None
    get_pending_requests = None
    get_all_agents = None
    delete_request = None

    def log_message(self, *args):
        """Suppress default logging."""
        pass

    def _send_json(self, status: int, data: dict):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        """Handle GET requests for history API."""
        if self.path == "/history":
            if self.db_enabled and CallbackHandler.get_recent_sessions:
                try:
                    sessions = CallbackHandler.get_recent_sessions(limit=20)
                    data = [
                        {
                            "request_id": r.request_id,
                            "prompt": r.prompt[:100],
                            "status": r.status.value,
                            "created_at": r.created_at.isoformat(),
                        }
                        for r in sessions
                    ]
                    self._send_json(200, {"history": data})
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
            else:
                self._send_json(501, {"error": "Database not enabled"})
        
        elif self.path == "/pending":
            if self.db_enabled and CallbackHandler.get_pending_requests:
                try:
                    pending = CallbackHandler.get_pending_requests()
                    data = [
                        {
                            "request_id": r.request_id,
                            "prompt": r.prompt[:100],
                            "is_pause": r.is_pause,
                            "created_at": r.created_at.isoformat(),
                        }
                        for r in pending
                    ]
                    self._send_json(200, {"pending": data})
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
            else:
                self._send_json(501, {"error": "Database not enabled"})
        
        elif self.path == "/agents":
            if self.db_enabled and CallbackHandler.get_all_agents:
                try:
                    agents = CallbackHandler.get_all_agents(limit=50)
                    data = [
                        {
                            "agent_id": a.agent_id,
                            "context": a.context,
                            "model": a.model,
                            "credits_spent": a.credits_spent,
                            "tool_calls": a.tool_calls,
                            "files_changed": a.files_changed,
                            "created_at": a.created_at.isoformat(),
                            "last_activity": a.last_activity.isoformat(),
                        }
                        for a in agents
                    ]
                    self._send_json(200, {"agents": data})
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
            else:
                self._send_json(501, {"error": "Database not enabled"})
        
        else:
            self._send_json(404, {"error": "Not found"})

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_DELETE(self):
        """Handle DELETE requests for session deletion."""
        # 解析路径: /session/{request_id}
        if self.path.startswith("/session/"):
            request_id = self.path[len("/session/"):]
            
            if not request_id:
                self._send_json(400, {"error": "Missing request_id"})
                return
            
            if self.db_enabled and CallbackHandler.delete_request:
                try:
                    deleted = CallbackHandler.delete_request(request_id)
                    if deleted:
                        # 同时从 pending_requests 中移除
                        if request_id in self.pending_requests:
                            del self.pending_requests[request_id]
                        self._send_json(200, {"status": "deleted", "request_id": request_id})
                    else:
                        self._send_json(404, {"error": "Request not found"})
                except Exception as e:
                    self._send_json(500, {"error": str(e)})
            else:
                self._send_json(501, {"error": "Database not enabled"})
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
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

            if req_id not in self.pending_requests or not self.event_loop:
                self._send_json(404, {"error": "Request not found"})
                return

            # Resolve the future
            future = self.pending_requests.pop(req_id)
            if cancelled:
                self.event_loop.call_soon_threadsafe(
                    future.set_exception, Exception("User cancelled")
                )
            else:
                self.event_loop.call_soon_threadsafe(
                    future.set_result, user_input
                )

            # Save to DB (injected save_response function)
            if self.db_enabled and hasattr(self, 'save_response') and self.save_response:
                try:
                    self.save_response(req_id, user_input, cancelled)
                except Exception as db_err:
                    print(f"[--] DB save error: {db_err}", file=sys.stderr)

            self._send_json(200, {"status": "ok"})

        except Exception as e:
            self._send_json(500, {"error": str(e)})
