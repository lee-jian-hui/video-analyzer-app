from typing import Tuple

from configs import Config
from utils.token_utils import count_tokens


def fit_message_and_context(
    user_message: str,
    context_text: str,
    summarizer_fn,
    model_hint: str | None = None,
) -> Tuple[str, bool]:
    """Ensure combined prompt fits into target context budget.

    Strategy:
    1) Build combined text (context + user message)
    2) If over budget, summarize context_text once
    3) Recheck; if still over, summarize user_message once
    4) Recheck; if still over, hard truncate from the start of context and end of message

    Returns: (fitted_text, changed)
    """
    reserve = max(0, int(getattr(Config, "MAX_NEW_TOKENS", 512)))
    safety = max(0, int(getattr(Config, "CONTEXT_SAFETY_MARGIN_TOKENS", 256)))
    budget = max(512, int(getattr(Config, "MAX_CONTEXT_TOKENS", 4096)))
    target = max(256, budget - reserve - safety)

    def over_limit(txt: str) -> bool:
        return count_tokens(txt, model_hint=model_hint) > target

    # 1) Combine
    combined = (
        f"[Context from previous conversation: {context_text}]\n\nUser message: {user_message}"
        if context_text else user_message
    )
    if not over_limit(combined):
        return combined, False

    changed = False

    # 2) Summarize context
    if context_text:
        try:
            summarized_context = summarizer_fn(context_text).strip()
            combined = f"[Context summary (shortened): {summarized_context}]\n\nUser message: {user_message}"
            changed = True
            if not over_limit(combined):
                return combined, changed
        except Exception:
            # Ignore summarization failure and continue
            pass

    # 3) Summarize user message
    try:
        summarized_user = summarizer_fn(user_message).strip()
        combined = (
            f"[Context summary (shortened): {summarized_context}]\n\nUser message (shortened): {summarized_user}"
            if context_text else f"User message (shortened): {summarized_user}"
        )
        changed = True
        if not over_limit(combined):
            return combined, changed
    except Exception:
        pass

    # 4) Hard truncate as last resort
    # Keep more budget for user message than context
    # Allocate 70% for message, 30% for context
    # Approximate tokens via char windows using heuristic ratio 4 chars/token
    # We still use count_tokens to check.
    ctx = (summarized_context if context_text else "") if 'summarized_context' in locals() else (context_text or "")
    msg = (summarized_user if 'summarized_user' in locals() else user_message)

    # Iteratively trim until it fits or becomes very small
    if ctx:
        ctx_target = int(target * 0.3)
        # Trim from the start (older first) for context
        while count_tokens(ctx, model_hint=model_hint) > ctx_target and len(ctx) > 200:
            ctx = ctx[len(ctx)//10 :]
    msg_target = target - count_tokens(ctx, model_hint=model_hint)
    msg_target = max(256, int(target * 0.7), msg_target)
    while count_tokens(msg, model_hint=model_hint) > msg_target and len(msg) > 200:
        # Trim from the end for user message (keep the beginning instructions)
        msg = msg[: int(len(msg) * 0.9)]

    combined = (f"[Context (truncated)]: {ctx}\n\n" if ctx else "") + f"User message (truncated): {msg}"
    return combined, True

