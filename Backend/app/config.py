import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")



def resolve_ollama_model(requested: str, base_url: str = OLLAMA_BASE_URL) -> str:
    """Match requested model to a name Ollama actually has installed."""
    try:
        import httpx

        response = httpx.get(f"{base_url}/api/tags", timeout=5.0)
        response.raise_for_status()
        names = [m["name"] for m in response.json().get("models", [])]
    except Exception:
        return requested

    if not names:
        return requested

    if requested in names:
        return requested

    base = requested.split(":")[0]
    if base in names:
        return base

    for name in names:
        if name == base or name.startswith(f"{base}:"):
            return name

    return names[0]
