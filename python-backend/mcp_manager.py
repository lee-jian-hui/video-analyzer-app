import asyncio
import json
import subprocess
import threading
import time
from typing import Dict, List
from core.singleton import SingletonMeta
from core.logger import get_logger
import os

from fastmcp import Client  # ✅ Official client


class MCPManager(metaclass=SingletonMeta):
    def __init__(self):
        self.logger = get_logger("MCPManager")
        self.logger.info("🧠 Initializing MCPManager singleton instance")

        self.processes: Dict[str, subprocess.Popen] = {}
        self.registry: Dict[str, List[dict]] = {}
        self.tools_dir = os.path.join(os.path.dirname(__file__), "tools")

    # -------------------------------------------------------------------------
    # 🧩 Server Management
    # -------------------------------------------------------------------------
    def add_mcp_server(self, name: str, script_path: str):
        """Spawn a new MCP server subprocess if not already running."""
        if name in self.processes:
            self.logger.warning(f"⚠️ MCP server '{name}' already running")
            return

        self.logger.info(f"🧩 Spawning MCP server: {name}")
        proc = subprocess.Popen(
            ["python", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.processes[name] = proc
        threading.Thread(
            target=self._log_output,
            args=(name, proc),
            daemon=True,
        ).start()

    def _log_output(self, name: str, proc: subprocess.Popen):
        """Pipe server output into logger for debugging."""
        for line in proc.stdout:
            self.logger.info(f"[{name}] {line.strip()}")

    # -------------------------------------------------------------------------
    # 🔍 Auto-Discovery & Registration
    # -------------------------------------------------------------------------
    def _auto_discover_and_start(self):
        """Discover all *_mcp.py tools and spawn them."""
        if not os.path.exists(self.tools_dir):
            self.logger.warning(f"⚠️ Tools directory not found at {self.tools_dir}")
            return

        for file in os.listdir(self.tools_dir):
            if file.endswith("_mcp.py"):
                name = file.replace(".py", "")
                script_path = os.path.join(self.tools_dir, file)
                self.add_mcp_server(name, script_path)

        # Wait for MCP servers to boot up, then fetch their tool lists
        asyncio.run(self._await_and_register_tools())

    async def _await_and_register_tools(self):
        """Wait for servers to initialize, then list their tools."""
        await asyncio.sleep(3)  # Give servers time to start
        for name in list(self.processes.keys()):
            try:
                tools = await self._fetch_tools_via_client(name)
                self.registry[name] = tools
                self.logger.info(f"✅ Registered {len(tools)} tools from {name}")
            except Exception as e:
                self.logger.error(f"❌ Failed to fetch tools from {name}: {e}")

    async def _fetch_tools_via_client(self, name: str, host="127.0.0.1", port=6277):
        """Use FastMCP client to list tools from a running MCP server."""
        self.logger.info(f"🔗 Connecting to {name} at ws://{host}:{port}")
        client = Client(f"ws://{host}:{port}")
        await client.connect()

        tools = await client.list_tools()
        formatted = [
            {"name": t.name, "description": t.description, "parameters": t.input_schema}
            for t in tools
        ]

        await client.disconnect()
        return formatted

    # -------------------------------------------------------------------------
    # 📋 Public API
    # -------------------------------------------------------------------------
    def list_all_tools(self) -> List[Dict[str, any]]:
        """Return all registered tools across all MCP servers."""
        all_tools = []
        for srv, tools in self.registry.items():
            for t in tools:
                t["server"] = srv
                all_tools.append(t)
        return all_tools

    def shutdown_all(self):
        """Terminate all MCP subprocesses cleanly."""
        for name, proc in list(self.processes.items()):
            self.logger.info(f"🛑 Stopping {name} (PID: {proc.pid})")
            proc.terminate()
        self.processes.clear()
        self.registry.clear()


# -------------------------------------------------------------------------
# 🚀 Singleton Instance
# -------------------------------------------------------------------------
mcp_manager_singleton = MCPManager()

if __name__ == "__main__":
    # For manual test
    mcp_manager_singleton._auto_discover_and_start()
    tools = mcp_manager_singleton.list_all_tools()
    print(json.dumps(tools, indent=2))
