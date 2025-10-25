from core.logger import get_logger

logger = get_logger(__name__)


def transcribe_agent(video_path: str):
    logger.info("🎙️ Transcribing mock video: %s", video_path)
    return "This is a mock transcription of the video content."

def generation_agent(summary_input: str):
    logger.info("📝 Generating report from summary input...")
    return f"Generated Summary Report:\n\n{summary_input}"
