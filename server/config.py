"""
Configuration constants for Session Helper MCP Server.
"""

import os
import tempfile

# Server ports
DEFAULT_EXT_PORT = 23983      # Default port for VS Code extension
CALLBACK_PORT_START = 23984   # Starting port for callback server

# Port file directory
PORT_FILE_DIR = os.path.join(tempfile.gettempdir(), "uio-ports")
