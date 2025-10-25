"""Shared logging utilities for the LangGraph PoC."""

from __future__ import annotations

import logging
import os
from typing import Optional


class LoggerFactory:
    """Singleton-style factory to provide consistently configured loggers."""

    _configured: bool = False

    @classmethod
    def _configure(cls) -> None:
        if cls._configured:
            return

        level_name = os.getenv("APP_LOG_LEVEL", "INFO").upper()
        level = getattr(logging, level_name, logging.INFO)

        logging.basicConfig(
            level=level,
            format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        )
        cls._configured = True

    @classmethod
    def get_logger(cls, name: Optional[str] = None) -> logging.Logger:
        cls._configure()
        return logging.getLogger(name or "app")


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Convenience wrapper for modules that prefer module-level imports."""
    return LoggerFactory.get_logger(name)
