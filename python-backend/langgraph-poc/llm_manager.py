import os

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from core.logger import get_logger

logger = get_logger(__name__)

MODEL_ID = "microsoft/Phi-3-mini-4k-instruct"
DEVICE_ENV_VAR = "LLM_DEVICE"


def _determine_device() -> str:
    """
    Resolve which device the LLM should use.
    Priority order:
      1. Explicit env var override via LLM_DEVICE.
      2. CUDA if available.
      3. CPU fallback.
    """
    requested = os.getenv(DEVICE_ENV_VAR)
    if requested:
        normalized = requested.strip().lower()
        if normalized in {"cuda", "gpu"}:
            if torch.cuda.is_available():
                logger.info("Using GPU as requested via %s.", DEVICE_ENV_VAR)
                return "cuda"
            logger.warning(
                "GPU requested via %s but CUDA is unavailable. Falling back to CPU.",
                DEVICE_ENV_VAR,
            )
        elif normalized == "cpu":
            logger.info("Using CPU as requested via %s.", DEVICE_ENV_VAR)
            return "cpu"
        else:
            logger.warning(
                "Unrecognized %s value '%s'. Falling back to auto-detection.",
                DEVICE_ENV_VAR,
                requested,
            )

    auto_device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Auto-detected %s usage for Phi-3.", auto_device.upper())
    return auto_device


DEVICE = _determine_device()

class LLMManager:
    _instance = None


    def __new__(cls):
        if cls._instance is None:
            logger.info("🚀 Loading local LLM (Phi-3-mini)...")
            cls._instance = super().__new__(cls)
            cls._instance.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            cls._instance.model = AutoModelForCausalLM.from_pretrained(MODEL_ID, device_map=DEVICE)
        return cls._instance

    def generate(self, prompt: str) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt")
        outputs = self.model.generate(**inputs, max_new_tokens=100)
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)
