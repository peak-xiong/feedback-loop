"""
Response parsing utilities.
"""

import base64
import re
from mcp.types import TextContent, ImageContent


def parse_user_response(user_input: str) -> list:
    """Parse user response, extracting text and images."""
    results = []
    
    # Image pattern: data:image/xxx;base64,xxx
    img_pattern = re.compile(r'data:image/([a-zA-Z]+);base64,([A-Za-z0-9+/=]+)')
    matches = list(img_pattern.finditer(user_input))
    
    if not matches:
        # Plain text response
        return [TextContent(type="text", text=user_input)]
    
    # Extract images and text
    last_end = 0
    for match in matches:
        # Text before image
        if match.start() > last_end:
            text_part = user_input[last_end:match.start()].strip()
            if text_part:
                results.append(TextContent(type="text", text=text_part))
        
        # Extract image
        mime_type = match.group(1)
        b64_data = match.group(2)
        
        try:
            # Validate base64
            base64.b64decode(b64_data)
            results.append(ImageContent(
                type="image",
                data=b64_data,
                mimeType=f"image/{mime_type}"
            ))
        except Exception:
            # Invalid base64, treat as text
            results.append(TextContent(type="text", text=match.group(0)))
        
        last_end = match.end()
    
    # Remaining text
    if last_end < len(user_input):
        text_part = user_input[last_end:].strip()
        if text_part:
            results.append(TextContent(type="text", text=text_part))
    
    return results if results else [TextContent(type="text", text=user_input)]
