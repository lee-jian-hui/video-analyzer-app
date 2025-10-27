"""
Output Storage Service

Manages output files (reports, exports) under the app's outputs directory.
Respects Config.REPORTS_OUTPUT_DIR when set; otherwise uses storage_paths.get_outputs_dir().
Falls back to writing Markdown if a PDF backend is not available.
"""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Optional

from configs import Config
from storage_paths import get_outputs_dir


def _sanitize_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in "._- ") or "output"


class OutputStorage:
    def __init__(self, base_dir: Optional[str] = None):
        base = Path(base_dir).expanduser() if base_dir else (
            Path(Config.REPORTS_OUTPUT_DIR).expanduser() if Config.REPORTS_OUTPUT_DIR else get_outputs_dir()
        )
        base.mkdir(parents=True, exist_ok=True)
        self.base_dir: Path = base

    def default_report_basename(self, video_id: str, display_name: Optional[str] = None) -> str:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        label = _sanitize_filename(display_name or video_id)
        return f"report_{label}_{ts}"

    def default_transcript_basename(self, base_label: str) -> str:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        label = _sanitize_filename(base_label)
        return f"transcript_{label}_{ts}"

    def write_pdf_or_markdown(self, markdown_text: str, basename: str) -> Path:
        pdf_path = self.base_dir / f"{basename}.pdf"
        if self._write_pdf_if_possible(markdown_text, pdf_path):
            return pdf_path
        # Fallback to markdown
        md_path = self.base_dir / f"{basename}.md"
        md_path.write_text(markdown_text, encoding="utf-8")
        return md_path

    def write_pdf(self, markdown_text: str, basename: str) -> Path:
        """Write a PDF only. Raises if a PDF backend is unavailable.

        Returns the path to the written PDF.
        """
        pdf_path = self.base_dir / f"{basename}.pdf"
        try:
            from reportlab.lib.pagesizes import LETTER  # noqa: F401
        except Exception as e:
            raise RuntimeError("PDF backend (reportlab) not installed") from e

        ok = self._write_pdf_if_possible(markdown_text, pdf_path)
        if not ok:
            raise RuntimeError("Failed to write PDF report")
        return pdf_path

    def find_latest(self, prefix: str, ext: str) -> Optional[Path]:
        """Find the most recently modified file matching prefix+ext in outputs.

        Args:
            prefix: Filename prefix (without directory), e.g. "transcript_video1_"
            ext: Extension including dot or not, e.g. ".txt" or "txt"

        Returns:
            Path to latest matching file under outputs, or None if none exist.
        """
        suffix = ext if ext.startswith(".") else f".{ext}"
        candidates = list(self.base_dir.glob(f"{prefix}*{suffix}"))
        if not candidates:
            return None
        candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return candidates[0]

    def _write_pdf_if_possible(self, markdown_text: str, output_path: Path) -> bool:
        try:
            from reportlab.lib.pagesizes import LETTER
            from reportlab.pdfgen import canvas
            from reportlab.lib.units import inch
        except Exception:
            return False

        try:
            c = canvas.Canvas(str(output_path), pagesize=LETTER)
            width, height = LETTER
            x = 1 * inch
            y = height - 1 * inch
            # naive wrapping
            import textwrap
            lines = []
            for para in markdown_text.split("\n"):
                wrapped = textwrap.wrap(para, width=90) if para else [""]
                lines.extend(wrapped)

            for line in lines:
                if y < 1 * inch:
                    c.showPage()
                    y = height - 1 * inch
                c.drawString(x, y, line)
                y -= 12

            c.save()
            return True
        except Exception:
            return False

    @staticmethod
    def sanitize(name: str) -> str:
        """Public sanitizer for filenames."""
        return _sanitize_filename(name)

    def write_text(self, text: str, basename: str, ext: str = ".txt") -> Path:
        path = self.base_dir / f"{basename}{ext}"
        path.write_text(text, encoding="utf-8")
        return path
