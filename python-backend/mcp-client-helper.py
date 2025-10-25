import asyncio
from fastmcp import Client

async def list_tools_from_server(host="127.0.0.1", port=6277):
    """
    Connects to a running FastMCP server and retrieves its tools list.
    """
    client = Client(f"ws://{host}:{port}")
    await client.connect()

    tools = await client.list_tools()
    print(f"🧩 Discovered {len(tools)} tools:")
    for t in tools:
        print(f" - {t.name}: {t.description}")

    await client.disconnect()
    return tools


if __name__ == "__main__":
    asyncio.run(list_tools_from_server())
