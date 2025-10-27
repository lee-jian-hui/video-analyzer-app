try:
    import tiktoken  # type: ignore
except Exception:  # pragma: no cover
    tiktoken = None  # type: ignore


def _estimate_tokens_heuristic(text: str) -> int:
    # Very rough heuristic: ~4 chars per token
    return max(1, int(len(text) / 4))


def count_tokens(text: str, model_hint: str | None = None) -> int:
    """Return approximate token count for text.

    Uses tiktoken if available; falls back to a simple heuristic if not.
    model_hint is optional and only used to choose a reasonable encoder.
    """
    if not text:
        return 0

    if tiktoken is None:
        return _estimate_tokens_heuristic(text)

    # Choose a generic, robust encoding
    # Prefer o200k_base if available, else cl100k_base
    enc = None
    for name in ("o200k_base", "cl100k_base"):
        try:
            enc = tiktoken.get_encoding(name)
            break
        except Exception:
            continue

    if enc is None:
        return _estimate_tokens_heuristic(text)

    try:
        return len(enc.encode(text))
    except Exception:
        return _estimate_tokens_heuristic(text)

