"""Vision agent definition."""

from typing import Any, Dict, List

from langchain.tools import tool

from agents.base_agent import BaseAgent
from context import get_video_context
from llm import get_llm_model
from storage_paths import get_outputs_dir
from ultralytics import YOLO
from collections import Counter
from configs import Config
import cv2
from utils.logger import get_logger
from utils.tool_discovery import ToolDiscovery
from models.agent_capabilities import AgentCapability, CapabilityCategory, AgentCapabilityRegistry


VISION_AGENT_CAPABILITIES = AgentCapability(
    capabilities=[
        "Object detection in videos",
        "Visual content analysis",
        "People and animal detection",
        "Vehicle and object tracking",
        "Scene understanding",
    ],
    intent_keywords=[
        "detect", "detection", "identify", "find",
        "locate", "search", "spot",
        "object", "objects", "person", "people",
        "car", "vehicle", "animal", "thing",
        "what see", "what's in", "show me",
        "track", "follow", "movement",
        "analyze video", "video analysis",
        "visual", "vision", "image", "frame",
        "appear", "visible", "scene",
        # Summarization/description phrasing
        "summarize video", "summarise video", "main themes", "what happens", "describe video", "explain video",
    ],
    categories=[CapabilityCategory.VISION, CapabilityCategory.ANALYSIS],
    example_tasks=[
        "Detect objects in the video",
        "Find all people in the video",
        "What cars appear in the video?",
        "Identify all animals in the video",
        "Analyze what's happening in the video",
        "Track movement of objects",
    ],
    routing_priority=9,
)


@tool
def detect_objects_in_video() -> str:
    """Detect objects in the current video using local YOLO model.

    Performance tweaks to reduce runtime and noise:
    - Samples frames using Config.VIDEO_SAMPLE_INTERVAL (default 30)
    - Raises confidence threshold a bit to cut low-probability boxes
    - Caps per-frame detections via YOLO's max_det
    - Returns top 5 most frequent classes
    """

    logger = get_logger(__name__)
    # Slightly stricter threshold to reduce low-confidence clutter
    confidence_threshold = 0.6
    model_size = "yolov8n"
    # Frame sampling interval (analyze every Nth frame)
    sample_interval = max(1, int(getattr(Config, "VIDEO_SAMPLE_INTERVAL", 30) or 30))
    # Cap per-frame detections to avoid excessive post-processing
    max_det = 50

    try:
        from ai_model_manager import get_model_manager

        model_manager = get_model_manager()
        model = model_manager.get_yolo_model(f"{model_size}.pt")

        video_context = get_video_context()
        video_path = video_context.get_current_video_path()

        if not video_path:
            return "No video file is currently loaded. Please load a video first."

        cap = cv2.VideoCapture(video_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps_val = cap.get(cv2.CAP_PROP_FPS)
        fps = float(fps_val) if fps_val and fps_val > 0 else 30.0

        detections: List[Dict[str, Any]] = []
        frame_num = 0
        frames_analyzed = 0

        project_dir = get_outputs_dir() / "yolo_runs"
        project_dir.mkdir(parents=True, exist_ok=True)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Only run inference on sampled frames
            if frame_num % sample_interval == 0:
                results = model(
                    frame,
                    conf=confidence_threshold,
                    iou=0.5,
                    max_det=max_det,
                    imgsz=640,
                    verbose=False,
                    save=False,
                    project=str(project_dir),
                    name="vision_agent",
                    exist_ok=True,
                )

                frames_analyzed += 1

                for r in results:
                    boxes = r.boxes
                    if boxes is None:
                        continue
                    for box in boxes:
                        class_id = int(box.cls[0])
                        class_name = model.names[class_id]
                        detections.append(
                            {
                                "frame": frame_num,
                                "timestamp": frame_num / fps,
                                "class": class_name,
                                "confidence": float(box.conf[0]),
                            }
                        )

            frame_num += 1

        cap.release()

        summary_classes = sorted({det["class"] for det in detections})
        # Compute top-5 most frequent detections
        counts = Counter(det["class"] for det in detections)
        top5 = counts.most_common(5)
        top5_str = ", ".join([f"{cls} ({cnt})" for cls, cnt in top5]) if top5 else "None"
        logger.info(
            "Vision agent detection complete: %d detections over %d analyzed/%d total frames; top5=%s",
            len(detections),
            frames_analyzed,
            frame_count,
            top5_str,
        )
        return (
            f"Video analysis complete. {len(detections)} detections over {frames_analyzed} analyzed of {frame_count} total frames. "
            f"Detected classes: {summary_classes}. Top 5: {top5_str}"
        )

    except ImportError:
        logger.exception("YOLO not installed")
        return "YOLO not installed. Run: pip install ultralytics"
    except Exception as exc:
        logger.exception("Error during detect_objects_in_video")
        return f"Error processing video: {exc}"


@tool
def dummy() -> str:
    """Placeholder tool for experimentation."""

    return "Dummy tool executed. No analysis performed."


class VisionAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="vision_agent",
            capabilities=VISION_AGENT_CAPABILITIES.capabilities,
        )
        self.capability_definition = VISION_AGENT_CAPABILITIES
        self.model = get_llm_model()
        self.tools = [detect_objects_in_video, dummy]

        if not self.tools:
            self.tools = ToolDiscovery.discover_tools_in_class(self)

        AgentCapabilityRegistry.register(self.name, self.capability_definition)

    def can_handle(self, task: Dict[str, Any]) -> bool:
        task_type = task.get("task_type", "").lower()
        if task_type in {"vision", "image", "ocr", "object_recognition", "captioning", "object_detection"}:
            return True

        description = task.get("description", "")
        return bool(description and self.capability_definition.matches_description(description))

    def get_model(self):
        return self.model

    def get_tools(self) -> List[Any]:
        return self.tools
