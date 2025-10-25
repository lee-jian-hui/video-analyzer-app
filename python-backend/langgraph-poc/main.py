import random

from langgraph.graph import StateGraph

from core.logger import get_logger
from llm_manager import LLMManager
from mock_agents import transcribe_agent, generation_agent

logger = get_logger(__name__)

# --- Graph node functions ---

def node_transcribe(state):
    state["transcript"] = transcribe_agent("mock_video.mp4")
    return state

def node_calculate(state):
    # Simulate calling MCP addition tool
    a, b = random.randint(1,10), random.randint(1,10)
    state["calculation"] = {"a": a, "b": b, "sum": a + b}
    return state

def node_generate_summary(state):
    llm = LLMManager()
    transcript = state.get("transcript", "")
    calc = state.get("calculation", {})
    prompt = f"""
You are a report generator.
Transcript: {transcript}
Math Result: {calc}
Summarize findings in one paragraph.
"""
    state["final_summary"] = llm.generate(prompt)
    return state

# --- LangGraph orchestration ---

graph = StateGraph(dict)
graph.add_node("transcribe", node_transcribe)
graph.add_node("calculate", node_calculate)
graph.add_node("generate", node_generate_summary)

graph.add_edge("transcribe", "calculate")
graph.add_edge("calculate", "generate")

graph.set_entry_point("transcribe")
app = graph.compile()

if __name__ == "__main__":
    logger.info("🚀 Running LangGraph workflow...")
    result = app.invoke({})
    logger.info("✅ Final Summary:\n%s", result["final_summary"])
