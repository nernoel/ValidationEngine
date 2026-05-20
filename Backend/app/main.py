import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ollama import ResponseError

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.graph import OLLAMA_MODEL_RESOLVED, llm, validation_app
from app.schemas import HealthResponse, ValidateIdeaRequest, ValidationResponse

api = FastAPI(
    title="Validation Engine API",
    description="Validates startup ideas using a LangGraph pipeline and Ollama.",
    version="0.1.0",
)

# CORS middleware for usage with front end
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _graph_result_to_response(
    user_idea: str, result: dict
) -> ValidationResponse:
    return ValidationResponse(
        user_idea=user_idea,
        narrowed_down_idea=result.get("narrowed_down_idea") or "",
        pros=result.get("pros") or "",
        cons=result.get("cons") or "",
        difficulty_score=str(result.get("difficulty_score") or ""),
        competitors_list=result.get("competitors_list") or "",
        validation_score=str(result.get("validation_score") or ""),
        validation_score_reasoning=result.get("validation_score_reasoning") or "",
    )


def _ollama_reachable() -> tuple[bool, list[str]]:
    try:
        response = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        response.raise_for_status()
        names = [m["name"] for m in response.json().get("models", [])]
        return True, names
    except Exception:
        return False, []


@api.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    reachable, installed = _ollama_reachable()
    if not reachable:
        return HealthResponse(
            status="ollama_unreachable",
            model=f"{OLLAMA_MODEL_RESOLVED} (Ollama not reachable at {OLLAMA_BASE_URL})",
        )
    if OLLAMA_MODEL_RESOLVED not in installed:
        return HealthResponse(
            status="model_missing",
            model=(
                f"configured={OLLAMA_MODEL}, resolved={OLLAMA_MODEL_RESOLVED}, "
                f"installed={installed}"
            ),
        )
    return HealthResponse(status="ok", model=OLLAMA_MODEL_RESOLVED)


@api.post("/api/validate", response_model=ValidationResponse)
async def validate_idea(request: ValidateIdeaRequest) -> ValidationResponse:
    """
    Run the full validation pipeline on a business idea.
    Expect several minutes of processing while Ollama runs each graph node.
    """
    reachable, installed = _ollama_reachable()
    if not reachable:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Ollama is not reachable at {OLLAMA_BASE_URL}. "
                "Keep the Ollama app running (port 11434). "
                "You do not need to run `ollama serve` if the app is already running."
            ),
        )
    if OLLAMA_MODEL_RESOLVED not in installed:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model '{OLLAMA_MODEL_RESOLVED}' is not installed. "
                f"Installed models: {installed}. "
                f"Run: ollama pull {OLLAMA_MODEL or 'llama3.2:latest'}"
            ),
        )

    try:
        result = await validation_app.ainvoke({"user_idea": request.user_idea})
    except ResponseError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Ollama error: {exc}. "
                f"base_url={OLLAMA_BASE_URL}, model={OLLAMA_MODEL_RESOLVED}, "
                f"installed={installed}"
            ),
        ) from exc
    except Exception as exc:
        err = str(exc).lower()
        if "not found" in err or "connection" in err or "refused" in err:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Ollama connection/model error: {exc}. "
                    f"base_url={OLLAMA_BASE_URL}, model={OLLAMA_MODEL_RESOLVED}"
                ),
            ) from exc
        raise HTTPException(
            status_code=500,
            detail=f"Validation pipeline failed: {exc}",
        ) from exc

    return _graph_result_to_response(request.user_idea, result)


# Uvicorn entrypoint: uvicorn app.main:api --reload
app = api
