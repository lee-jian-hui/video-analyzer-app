"""
Report Agent

Generates a structured report (PDF when possible) for a video session using
chat history summaries and recent messages. Falls back to Markdown if PDF
libraries are unavailable.
"""
from typing import Any, Dict, List, Optional
from langchain.tools import tool
from langchain.messages import HumanMessage
from agents.base_agent import BaseAgent
from llm import get_chat_llm
from utils.logger import get_logger
from models.agent_capabilities import AgentCapability, CapabilityCategory, AgentCapabilityRegistry
from services.chat_history_service import ChatHistoryService
from services.output_storage import OutputStorage
from services.chat_history_storage import get_chat_history_storage
from context.video_context import get_video_context


REPORT_AGENT_CAPABILITIES = AgentCapability(
    capabilities=[
        "PDF report generation",
        "Session summary documents",
        "Structured narrative reports",
    ],
    intent_keywords=[
        "report", "pdf", "summary report", "document",
        "export report", "generate report", "create report",
    ],
    categories=[CapabilityCategory.GENERATION, CapabilityCategory.TEXT],
    example_tasks=[
        "Generate a PDF report of this analysis",
        "Create a summary document for the video",
        "Export a report with detected entities and themes",
    ],
    routing_priority=7,
)


logger = get_logger(__name__)


from templates.report_prompts import format_video_report_prompt


@tool
def generate_report_save_pdf() -> str:
    """Generate a structured report for the active/last video session. Returns saved file path.

    Automatically identifies the target session:
    - Prefers last_video_id from app state
    - Falls back to most-recent history
    - As a final fallback, attempts to match current VideoContext path
    Output directory can be overridden via REPORTS_OUTPUT_DIR in configs/env.
    """
    storage = get_chat_history_storage()
    chs = ChatHistoryService(storage=storage)

    chosen_id: Optional[str] = None

    # 1) Prefer last session from app state
    try:
        if not chosen_id:
            app_state = storage.load_app_state()
            if app_state and app_state.get("last_video_id"):
                chosen_id = app_state.get("last_video_id")
    except Exception:
        chosen_id = None

    # 2) Fallback to most recently updated history
    if not chosen_id:
        try:
            histories = storage.list_all_histories()
            if histories:
                chosen_id = histories[0].get("video_id")
        except Exception:
            chosen_id = None

    # 3) Try to match by current VideoContext path if still missing
    if not chosen_id:
        try:
            vc = get_video_context()
            current_path = vc.get_current_video_path() or ""
            if current_path:
                histories = storage.list_all_histories()
                for h in histories:
                    if (h.get("video_path") or "") == current_path:
                        chosen_id = h.get("video_id")
                        break
        except Exception:
            chosen_id = None

    if not chosen_id:
        return "No session found. Please upload or register a video before generating a report."

    history = chs.load(chosen_id)
    if not history:
        return "No chat history found for this video. Start a session first."

    # Get chat summary (use existing or derive on-demand)
    summary = history.conversation_summary
    if not summary:
        summary = chs.generate_summary(history, persist=False) or "No conversation summary available."

    # Try to include transcript summary via the transcription agent tool
    transcript_summary = ""
    try:
        from agents.transcription_agent import summarised_video_transcript as _summ
        # Invoke tool without args; returns summary string
        transcript_summary = _summ.invoke({})
    except Exception:
        transcript_summary = ""

    recent = [{"role": m.role, "content": m.content, "timestamp": m.timestamp} for m in history.recent_messages]
    if transcript_summary:
        recent.append({"role": "system", "content": f"Transcript summary: {transcript_summary}", "timestamp": ""})

    prompt = format_video_report_prompt(history.video_id, history.display_name, summary, recent)
    llm = get_chat_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    report_md = resp.content or "Report generation failed."

    output_store = OutputStorage()
    base = output_store.default_report_basename(history.video_id, history.display_name)
    try:
        saved_path = output_store.write_pdf(report_md, base)
        return f"Saved PDF report to: {saved_path}"
    except Exception as e:
        return f"Error: PDF backend unavailable or failed ({e}). Install 'reportlab' to enable PDF export."




class ReportAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="report_agent",
            capabilities=REPORT_AGENT_CAPABILITIES.capabilities,
        )
        self.capability_definition = REPORT_AGENT_CAPABILITIES
        # Not used directly; tools call chat llm
        self.model = get_chat_llm()
        self.tools = [generate_report_save_pdf]

        AgentCapabilityRegistry.register(self.name, self.capability_definition)

    def can_handle(self, task: Dict[str, Any]) -> bool:
        desc = (task.get("description", "") or "").lower()
        return any(k in desc for k in ["report", "pdf", "summary report", "document"]) or task.get("task_type", "") == "generation"

    def get_model(self):
        return self.model

    def get_tools(self) -> List[Any]:
        return self.tools
