from pydantic import BaseModel, Field


class ValidateIdeaRequest(BaseModel):
    """Body for POST /api/validate."""

    user_idea: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="The startup or business idea to validate.",
        examples=[
            "A platform where local chefs can rent restaurant kitchens during off-hours for pop-up dining."
        ],
    )


class ValidationResponse(BaseModel):
    """Full validation result returned after the LangGraph pipeline completes."""

    id: str | None = None
    title: str | None = None
    user_idea: str
    narrowed_down_idea: str = ""
    pros: str = ""
    cons: str = ""
    difficulty_score: str = ""
    competitors_list: str = ""
    validation_score: str = ""
    validation_score_reasoning: str = ""
    created_at: str | None = None


class ValidationSummary(BaseModel):
    """Small validation record used by the sidebar history."""

    id: str
    title: str
    user_idea: str
    validation_score: str = ""
    difficulty_score: str = ""
    created_at: str


class HealthResponse(BaseModel):
    """Body for GET /health."""

    status: str = "ok"
    model: str = ""
