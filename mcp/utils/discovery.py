"""
Extension discovery utilities.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import PORT_FILE_DIR


def discover_ext_ports() -> list[int]:
    """Discover running extension ports from port files."""
    import json
    
    ports: list[int] = []
    
    if not os.path.exists(PORT_FILE_DIR):
        return ports
    
    for fname in os.listdir(PORT_FILE_DIR):
        if fname.endswith(".port"):
            try:
                fpath = os.path.join(PORT_FILE_DIR, fname)
                with open(fpath, "r") as f:
                    data = json.load(f)
                    port = data.get("port") if isinstance(data, dict) else int(data)
                    if port is not None:
                        ports.append(int(port))
            except (ValueError, IOError, json.JSONDecodeError):
                pass
    
    return ports
