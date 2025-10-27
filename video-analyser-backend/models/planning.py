"""
Typed models for LLM-planned orchestration steps and gates.
Used with structured parsing + validation in the orchestrator.
"""
from __future__ import annotations

from typing import Any, Dict, List
from pydantic import BaseModel, Field, RootModel


class PlanStep(BaseModel):
    agent: str = Field(..., description="Registered agent name")
    tools: List[str] = Field(default_factory=list, description="Ordered tool names for the agent")
    args: Dict[str, Any] = Field(default_factory=dict, description="Optional arguments per step (not required)")


class GlobalPlan(RootModel[List[PlanStep]]):
    pass


class ToolsGate(BaseModel):
    should_use_tools: bool
    confidence: float = 0.0
    reason: str = ""


class AgentSelection(RootModel[List[str]]):
    pass
