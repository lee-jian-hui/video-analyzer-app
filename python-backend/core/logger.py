import logging
import os
from datetime import datetime


def get_logger(name: str = "AppLogger", log_dir: str = None) -> logging.Logger:
    """
    Returns a configured logger with both console and file handlers.

    Usage:
        from core.logger import get_logger
        logger = get_logger("MCPManager")
        logger.info("Started manager")
    """
    # === Prepare log directory ===
    if log_dir is None:
        log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, f"{name.lower()}_{datetime.now().strftime('%Y%m%d')}.log")

    # === Formatter ===
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # === File handler ===
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    # === Console handler ===
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    # === Create or get existing logger ===
    logger = logging.getLogger(name)
    if not logger.handlers:  # avoid duplicate handlers on reload
        logger.setLevel(logging.INFO)
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    logger.propagate = False
    return logger
