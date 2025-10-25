import json
from mcp.server.fastmcp import FastMCP

server = FastMCP("Mock Addition Server")

@server.tool()
def add_numbers(a: float, b: float) -> dict:
    """Adds two numbers together."""
    return {"result": a + b}

# if __name__ == "__main__":
#     print("🧮 Starting Mock MCP Server...")
#     server.run()

if __name__ == "__main__":
    print("🧮 Starting Mock MCP Server...")
    # Print tool metadata so the manager can capture it
    tool_registry = getattr(server, "_FastMCP__tools", {})  # fallback for name-mangled attr
    tool_list = [
        {"name": t.name, "description": t.description}
        for t in tool_registry.values()
    ]


    print(json.dumps({"tools": tool_list}), flush=True)  # 👈 flush=True
    server.run()
