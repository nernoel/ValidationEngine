import asyncio
import re
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field


class ExampleProsCons(TypedDict):
    name: str
    pros: list[str]
    cons: list[str]


class ExampleProsConsOutput(BaseModel):
    name: str = Field(description="Short label for this narrowed-down niche example")
    pros: list[str] = Field(description="Exactly 5 pros for this niche")
    cons: list[str] = Field(description="Exactly 5 cons for this niche")


class ProsConsOutput(BaseModel):
    overall_pros: list[str] = Field(description="Exactly 5 pros for the overall refined idea")
    overall_cons: list[str] = Field(description="Exactly 5 cons for the overall refined idea")
    examples: list[ExampleProsConsOutput] = Field(
        description="Pros and cons for each suggested niche from the narrowed-down analysis"
    )


class DifficultyOutput(BaseModel):
    difficulty: int = Field(ge=1, le=10, description="Difficulty from 1 (easiest) to 10 (hardest)")


class CompetitorsOutput(BaseModel):
    competitors: list[str] = Field(description="Real competitor company names in this market")


class ValidationScoreOutput(BaseModel):
    score: int = Field(ge=1, le=10, description="Validation score from 1 (lowest) to 10 (highest)")


class ValidationEngineState(TypedDict):
    idea: str
    narrowed_down_ideas: str

    pros: list[str]
    cons: list[str]
    example_pros_cons: list[ExampleProsCons]

    difficulty: int
    competitors: list[str]

    validation_score: int
    validation_score_reasoning: str


llm = ChatOllama(model="llama3.1")


def _analysis_context(state: ValidationEngineState) -> str:
    return (
        f"Original idea:\n{state['idea']}\n\n"
        f"Narrowed-down analysis and suggested niches:\n{state['narrowed_down_ideas']}"
    )


def _parse_score_1_10(text: str) -> int:
    match = re.search(r"\b(10|[1-9])\b", text.strip())
    if not match:
        return 5
    return int(match.group(1))


# --- Graph nodes ---


async def validate_idea(state: ValidationEngineState) -> dict:
    """Narrow the user's idea and suggest specific niches."""
    user_prompt = HumanMessage(content=f"Here is my business idea: {state['idea']}")
    system_prompt = SystemMessage(
        content=(
            "You are a helpful assistant skilled at validating startup ideas. "
            "Based on the user's idea, narrow it down into a more specific niche. "
            "Describe the refined idea clearly and in detail, and list several highly "
            "profitable, specific niches to help the user narrow down the idea if it is general. "
            "Do not talk to the user or use conversational filler. "
            "Analyze the input and output only the necessary analysis."
        )
    )

    response = await llm.ainvoke([system_prompt, user_prompt])
    return {"narrowed_down_ideas": response.content}


async def define_pros_and_cons(state: ValidationEngineState) -> dict:
    """Pros and cons for the overall idea and each suggested niche."""
    system_prompt = SystemMessage(
        content=(
            "You are a startup validation analyst. "
            "Using the original idea and the narrowed-down analysis provided, produce balanced pros and cons. "
            "For the overall refined idea, list exactly 5 pros and exactly 5 cons. "
            "For each distinct niche or example suggested in the narrowed-down analysis, "
            "list exactly 5 pros and exactly 5 cons for that niche. "
            "Base every point on the supplied context; do not invent niches that were not suggested. "
            "Do not use conversational filler."
        )
    )
    user_prompt = HumanMessage(content=_analysis_context(state))

    structured_llm = llm.with_structured_output(ProsConsOutput)
    result: ProsConsOutput = await structured_llm.ainvoke([system_prompt, user_prompt])

    return {
        "pros": result.overall_pros,
        "cons": result.overall_cons,
        "example_pros_cons": [
            {"name": ex.name, "pros": ex.pros, "cons": ex.cons}
            for ex in result.examples
        ],
    }


async def define_difficulty(state: ValidationEngineState) -> dict:
    """Difficulty score from 1 (easiest) to 10 (hardest)."""
    system_prompt = SystemMessage(
        content=(
            "You are a startup validation analyst. "
            "Using the original idea and the narrowed-down analysis, assign a single difficulty score "
            "from 1 (easiest to execute) to 10 (hardest). "
            "Base the score only on the supplied context."
        )
    )
    user_prompt = HumanMessage(content=_analysis_context(state))

    structured_llm = llm.with_structured_output(DifficultyOutput)
    try:
        result: DifficultyOutput = await structured_llm.ainvoke([system_prompt, user_prompt])
        return {"difficulty": result.difficulty}
    except Exception:
        response = await llm.ainvoke([system_prompt, user_prompt])
        return {"difficulty": _parse_score_1_10(response.content)}


async def define_competitors(state: ValidationEngineState) -> dict:
    """List of real competitors in the market."""
    system_prompt = SystemMessage(
        content=(
            "You are a startup validation analyst. "
            "Using the original idea and the narrowed-down analysis, list real companies "
            "that already compete in this space. "
            "Return only competitor names; no other commentary."
        )
    )
    user_prompt = HumanMessage(content=_analysis_context(state))

    structured_llm = llm.with_structured_output(CompetitorsOutput)
    try:
        result: CompetitorsOutput = await structured_llm.ainvoke([system_prompt, user_prompt])
        return {"competitors": result.competitors}
    except Exception:
        response = await llm.ainvoke([system_prompt, user_prompt])
        names = [line.strip("-• ").strip() for line in response.content.splitlines() if line.strip()]
        return {"competitors": names}


async def compute_validation_score(state: ValidationEngineState) -> dict:
    """Overall validation score from 1 to 10 using full prior analysis."""
    system_prompt = SystemMessage(
        content=(
            "You are a startup validation analyst. "
            "Using the original idea, narrowed-down analysis, pros, cons, difficulty, and competitors, "
            "assign one validation score from 1 (lowest) to 10 (highest). "
            "Return only the numeric score."
        )
    )
    user_prompt = HumanMessage(
        content=(
            f"{_analysis_context(state)}\n\n"
            f"Pros: {state.get('pros', [])}\n"
            f"Cons: {state.get('cons', [])}\n"
            f"Difficulty (1-10): {state.get('difficulty', 0)}\n"
            f"Competitors: {state.get('competitors', [])}"
        )
    )

    structured_llm = llm.with_structured_output(ValidationScoreOutput)
    try:
        result: ValidationScoreOutput = await structured_llm.ainvoke([system_prompt, user_prompt])
        return {"validation_score": result.score}
    except Exception:
        response = await llm.ainvoke([system_prompt, user_prompt])
        return {"validation_score": _parse_score_1_10(response.content)}


async def compute_validation_score_reasoning(state: ValidationEngineState) -> dict:
    """Explain why the validation score was assigned."""
    system_prompt = SystemMessage(
        content=(
            "You are a startup validation analyst. "
            "Explain in detail why the given validation score is appropriate. "
            "Reference the idea, narrowed-down analysis, pros, cons, difficulty, and competitors. "
            "Do not use conversational filler."
        )
    )
    user_prompt = HumanMessage(
        content=(
            f"Validation score: {state['validation_score']}\n\n"
            f"{_analysis_context(state)}\n\n"
            f"Pros: {state.get('pros', [])}\n"
            f"Cons: {state.get('cons', [])}\n"
            f"Difficulty (1-10): {state.get('difficulty', 0)}\n"
            f"Competitors: {state.get('competitors', [])}"
        )
    )

    response = await llm.ainvoke([system_prompt, user_prompt])
    return {"validation_score_reasoning": response.content}


# --- Routing (conditional / "maybe" edges) ---


def route_after_validate(
    state: ValidationEngineState,
) -> Literal["__end__"] | list[str]:
    """
    Conditional edge after validate_idea.
    If narrowing failed (empty output), skip the rest of the pipeline.
    Otherwise fan out to parallel analysis nodes (return a list of node names).
    """
    if not state.get("narrowed_down_ideas", "").strip():
        return "__end__"
    return [
        "define_pros_and_cons",
        "define_difficulty",
        "define_competitors",
    ]


def route_after_score(
    state: ValidationEngineState,
) -> Literal["explain_score", "__end__"]:
    """
    Optional follow-up: only generate reasoning when a valid score exists.
    Acts as a 'maybe' node — reasoning runs only when scoring succeeded.
    """
    score = state.get("validation_score", 0)
    if not isinstance(score, int) or score < 1 or score > 10:
        return "__end__"
    return "explain_score"


def build_validation_graph() -> StateGraph:
    """
    Validation pipeline:

        START
          │
          ▼
      validate_idea
          │
          ├─[empty analysis]──► END
          │
          └─[has analysis]──► ┌─ define_pros_and_cons ─┐
                              ├─ define_difficulty ──────┼─► compute_validation_score
                              └─ define_competitors ─────┘         │
                                                                   ├─[invalid score]──► END
                                                                   └─[valid score]────► compute_validation_score_reasoning ─► END

    The three analysis nodes after validate_idea run in parallel (fan-out / join).
  """
    workflow = StateGraph(ValidationEngineState)

    workflow.add_node("validate_idea", validate_idea)
    workflow.add_node("define_pros_and_cons", define_pros_and_cons)
    workflow.add_node("define_difficulty", define_difficulty)
    workflow.add_node("define_competitors", define_competitors)
    workflow.add_node("compute_validation_score", compute_validation_score)
    workflow.add_node(
        "compute_validation_score_reasoning",
        compute_validation_score_reasoning,
    )

    workflow.add_edge(START, "validate_idea")

    # Conditional: continue only if narrowing produced content (list = parallel fan-out)
    workflow.add_conditional_edges("validate_idea", route_after_validate)

    # Parallel branches join here (waits for all three parents)
    workflow.add_edge("define_pros_and_cons", "compute_validation_score")
    workflow.add_edge("define_difficulty", "compute_validation_score")
    workflow.add_edge("define_competitors", "compute_validation_score")

    # Conditional: maybe skip reasoning if score is missing/invalid
    workflow.add_conditional_edges(
        "compute_validation_score",
        route_after_score,
        {
            "explain_score": "compute_validation_score_reasoning",
            "__end__": END,
        },
    )

    workflow.add_edge("compute_validation_score_reasoning", END)

    return workflow


# Compiled graph — use validation_app.ainvoke(initial_state) from FastAPI or scripts
validation_graph = build_validation_graph()
validation_app = validation_graph.compile()


def create_initial_state(idea: str) -> ValidationEngineState:
    return {
        "idea": idea,
        "narrowed_down_ideas": "",
        "pros": [],
        "cons": [],
        "example_pros_cons": [],
        "difficulty": 0,
        "competitors": [],
        "validation_score": 0,
        "validation_score_reasoning": "",
    }


def print_validation_result(result: ValidationEngineState) -> None:
    print("\nNARROWED DOWN IDEAS:\n")
    print(result["narrowed_down_ideas"] or "(none — pipeline ended early)")

    if not result["pros"] and not result["cons"]:
        return

    print("\nOVERALL PROS:\n")
    for pro in result["pros"]:
        print(f"- {pro}")

    print("\nOVERALL CONS:\n")
    for con in result["cons"]:
        print(f"- {con}")

    print("\nPER-EXAMPLE PROS & CONS:\n")
    for example in result["example_pros_cons"]:
        print(f"\n{example['name']}:")
        print("  Pros:")
        for pro in example["pros"]:
            print(f"    - {pro}")
        print("  Cons:")
        for con in example["cons"]:
            print(f"    - {con}")

    print(f"\nDIFFICULTY: {result['difficulty']}/10")
    print("\nCOMPETITORS:\n")
    for competitor in result["competitors"]:
        print(f"- {competitor}")

    print(f"\nVALIDATION SCORE: {result['validation_score']}/10")
    if result["validation_score_reasoning"]:
        print("\nVALIDATION SCORE REASONING:\n")
        print(result["validation_score_reasoning"])


async def main() -> None:
    state = create_initial_state("AI dog walking application")
    result = await validation_app.ainvoke(state)
    print_validation_result(result)


if __name__ == "__main__":
    asyncio.run(main())
