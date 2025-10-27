"""
Report Prompts

Prompt templates for generating structured video analysis reports.
"""
from typing import List, Dict


def format_video_report_prompt(
    video_id: str,
    display_name: str,
    summary: str,
    recent_messages: List[Dict[str, str]],
) -> str:
    msgs_text = "\n".join([f"- {m['role'].upper()}: {m['content']}" for m in recent_messages])
    return f"""
You are a helpful assistant generating a comprehensive analysis report for a desktop video analysis session.

Report requirements:
- Start with a short executive summary (3-5 sentences) based on the conversation.
- Include sections with clear headings:
  1) Theme of the video
  2) Entities detected in the video
  3) Summary of the video
  4) Notable observations / recommendations
- Keep it concise, factual, and readable.

Context:
- Video ID: {video_id}
- Display Name: {display_name}
- Chat Summary:
{summary}

- Recent Messages:
{msgs_text}

Output: Provide the final report content in Markdown with proper headings.
"""




