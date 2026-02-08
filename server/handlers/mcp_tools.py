"""
MCP Tool definitions and handlers.
"""

from typing import Any, Callable, Awaitable
from mcp.types import Tool, TextContent


# Import will be done lazily in handle_tool_call to avoid circular imports


def get_tool_definitions() -> list[Tool]:
    """Return list of available MCP tools."""
    return [
        Tool(
            name="io",
            description=(
                "Send a checkpoint notification to the user. "
                "This triggers a popup that pauses the workflow until user responds. "
                "Returns the user's input text or button choice."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Message to display to the user",
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional button labels for quick response",
                    },
                },
                "required": ["reason"],
            },
        ),
        Tool(
            name="pause",
            description=(
                "Pause the session indefinitely until user manually resumes. "
                "Use this when you need to wait indefinitely for user action. "
                "The session will remain active until user clicks Continue or End."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Why the session is being paused",
                    },
                },
                "required": ["reason"],
            },
        ),
        Tool(
            name="join",
            description=(
                "Create a new agent identity with a friendly name. "
                "Call this at the start of a new task to get a unique agent ID. "
                "You can later recall this agent using the context hint."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "context": {
                        "type": "string",
                        "description": "Brief description of what this agent is doing",
                    },
                    "model": {
                        "type": "string",
                        "description": "The AI model being used",
                    },
                    "credits_spent": {
                        "type": "integer",
                        "description": "Credits/tokens spent so far",
                    },
                    "tool_calls": {
                        "type": "integer",
                        "description": "Number of tool calls made",
                    },
                    "files_changed": {
                        "type": "integer",
                        "description": "Number of files modified",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="recall",
            description=(
                "Find previous agent sessions by context hint. "
                "Use this to find and continue work from a previous session."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "hints": {
                        "type": "string",
                        "description": "Keywords to search in agent contexts",
                    },
                },
                "required": [],
            },
        ),
    ]


async def handle_tool_call(
    name: str, 
    arguments: dict[str, Any],
    request_input: Callable[..., Awaitable[str]],
    db_enabled: bool = True
) -> list[TextContent]:
    """Handle MCP tool calls."""
    
    if name == "io":
        reason = arguments.get("reason", "Checkpoint")
        options = arguments.get("options")
        
        try:
            user_input = await request_input(reason, options=options)
            return [TextContent(type="text", text=user_input)]
        except Exception as e:
            return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    elif name == "pause":
        reason = arguments.get("reason", "Paused")
        
        try:
            user_input = await request_input(
                f"⏸️ PAUSED: {reason}\n\nClick Continue when ready to resume.",
                options=["Continue"],
                is_pause=True
            )
            return [TextContent(
                type="text",
                text=f"Session resumed. User response: {user_input}\n\nContinue with your task.",
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"Session ended: {str(e)}")]
    
    elif name == "join":
        if not db_enabled:
            return [TextContent(type="text", text="Error: Database not enabled")]
        
        # Lazy import to avoid circular dependency
        from models import create_agent
        
        context = arguments.get("context")
        model = arguments.get("model")
        credits_spent = arguments.get("credits_spent", 0)
        tool_calls = arguments.get("tool_calls", 0)
        files_changed = arguments.get("files_changed", 0)
        
        try:
            agent = create_agent(
                context=context,
                model=model,
                credits_spent=credits_spent,
                tool_calls=tool_calls,
                files_changed=files_changed
            )
            return [TextContent(
                type="text",
                text=(
                    f"Agent identity created!\n\n"
                    f"**Agent ID**: `{agent.agent_id}`\n"
                    f"**Context**: {context or 'None'}\n"
                    f"**Model**: {model or 'Not specified'}\n\n"
                    f"Use this ID to recall this session later."
                ),
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"Error creating agent: {str(e)}")]
    
    elif name == "recall":
        if not db_enabled:
            return [TextContent(type="text", text="Error: Database not enabled")]
        
        # Lazy import to avoid circular dependency
        from models import find_agents_by_context, get_all_agents
        
        hints = arguments.get("hints", "")
        
        try:
            if hints:
                agents = find_agents_by_context(hints)
            else:
                agents = get_all_agents(limit=10)
            
            if not agents:
                return [TextContent(
                    type="text",
                    text="No matching agents found.",
                )]
            
            lines = ["**Found agents:**\n"]
            for a in agents:
                model_info = f" | Model: {a.model}" if a.model else ""
                credits_info = f" | Credits: {a.credits_spent}" if a.credits_spent else ""
                lines.append(
                    f"- `{a.agent_id}`: {a.context or 'No context'}"
                    f"{model_info}{credits_info}"
                    f" (Last active: {a.last_activity.strftime('%Y-%m-%d %H:%M')})"
                )
            
            return [TextContent(type="text", text="\n".join(lines))]
        except Exception as e:
            return [TextContent(type="text", text=f"Error recalling agents: {str(e)}")]
    
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]
