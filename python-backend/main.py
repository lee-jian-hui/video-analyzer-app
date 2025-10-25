import logging
import time
from mcp_manager import mcp_manager_singleton
from llm_manager import LLMManager
from grpc_server import start_grpc_server

from mcp_manager import mcp_manager_singleton
from llm_manager import LLMManager
from grpc_server import start_grpc_server

def main():
    print("🚀 Initializing system...")
    llm_manager = LLMManager()

    # Discover and launch MCP servers
    mcp_manager_singleton.auto_discover_and_start()

    time.sleep(3)  # small delay for registration handshake

    print("✅ Registered tools:")
    for tool in mcp_manager_singleton.list_all_tools():
        print(f" - {tool['name']} from {tool['server']}")

    start_grpc_server()

if __name__ == "__main__":
    main()
