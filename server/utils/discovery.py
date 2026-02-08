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
    ports = []
    
    if not os.path.exists(PORT_FILE_DIR):
        return ports
    
    for fname in os.listdir(PORT_FILE_DIR):
        if fname.startswith("ext-"):
            try:
                fpath = os.path.join(PORT_FILE_DIR, fname)
                with open(fpath, "r") as f:
                    port = int(f.read().strip())
                    ports.append(port)
            except (ValueError, IOError):
                pass
    
    return ports
