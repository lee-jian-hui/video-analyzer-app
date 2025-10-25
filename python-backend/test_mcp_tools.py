# test_mcp_tools.py
from mcp_manager import mcp_manager_singleton
# from llm_manager import llm_manager

mcp_manager_singleton._auto_discover_and_start()

print("🧩 Available tools:")
for t in mcp_manager_singleton.list_all_tools():
    print(f" - {t['name']} ({t['server']})")

# response = llm_manager.generate("Add 2 and 3 using available tools.")
# print("\n🧠 LLM output:")
# print(response)
