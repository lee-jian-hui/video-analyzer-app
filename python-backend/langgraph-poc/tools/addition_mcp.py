from mcp.server.fastmcp import FastMCP

from core.logger import get_logger

logger = get_logger(__name__)

server = FastMCP("AdditionAgent")

@server.tool()
def add_numbers(a: float, b: float) -> dict:
    """Add two numbers and return the sum."""
    return {"result": a + b}

if __name__ == "__main__":
    logger.info("🧮 Addition MCP Server started")
    server.run()
