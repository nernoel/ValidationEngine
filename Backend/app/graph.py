import asyncio
import re
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL, resolve_ollama_model

class ValidationEngineState(TypedDict):
    user_idea: str                       # User's intial idea
    narrowed_down_idea: str              # llm narrowed down idea

    pros: list[str]                     # List of pros of the idea
    cons: list[str]                     # List of cons of the idea

    difficulty_score: int               # Difficulty level score of idea
    competitors_list: list[str]          # List of competitors for the user's idea (real)

    validation_score: int               # Validation score, is this a good idea
    validation_score_reasoning: str     # Reasoning from llm for the score

# LLM model (Switch to OpenAI later). Resolved against `ollama list` at import.
OLLAMA_MODEL_RESOLVED = resolve_ollama_model(OLLAMA_MODEL)
llm = ChatOllama(
    model="llama3.2:latest",
    # base_url=OLLAMA_BASE_URL,
    validate_model_on_init=False,
)

"""
Building the langgraph nodes
"""

async def validate_idea(state: ValidationEngineState) -> dict:
    """Narrow the user's idea."""
    instruction = HumanMessage(content=f"Here is my business idea: {state['user_idea']}")
    system_prompt = SystemMessage(
        content=(
            "You are a helpful assistant skilled at validating startup / business ideas. "
            "Based on the user's idea, narrow it down into a more specific idea instead of broad. "
            "Describe the refined idea clearly and in detail, help the user narrow down the idea if it is general. "
            "Do not talk to the user or use conversational filler. "
            "Do not give examples of the idea such as what they ask for"
            "Analyze the input and output only the necessary analysis."
            "Give exactly 6 lines of the idea defined nothing less nothing more"
        )
    )

    # Invoke LLM with original response as well
    response = await llm.ainvoke([system_prompt, instruction]) 
    return {"narrowed_down_idea": response.content}

async def define_pros(state: ValidationEngineState) -> dict:
    """Defines the pros to the user's validated idea."""
    instruction = HumanMessage(
        content=(
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            "List exactly 5 pros for the overall refined idea only. "
            "Do not list pros per niche or sub-category."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at identifying pros for ideas. "
            "Output exactly 5 pros for the overall idea only. "
            "One short line per pro (under 15 words each). "
            "No headings, no niches, no extra commentary."
        )
    )

    response = await llm.ainvoke([system_prompt, instruction])
    return {"pros": response.content}

async def define_cons(state: ValidationEngineState) -> dict:
    """Defines the cons to the user's validated idea."""
    instruction = HumanMessage(
        content=(
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            "List exactly 5 cons for the overall refined idea only. "
            "Do not list cons per niche or sub-category."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at identifying cons for ideas. "
            "Output exactly 5 cons for the overall idea only. "
            "One short line per con (under 15 words each). "
            "No headings, no niches, no extra commentary."
        )
    )

    response = await llm.ainvoke([system_prompt, instruction])
    return {"cons": response.content}

async def get_difficulty_score(state: ValidationEngineState) -> dict:
    """ Defines a difficulty score based on the user's validated idea"""
    instruction = HumanMessage(
        content=(
            f"Original idea:\n{state.get('user_idea', '')}\n\n"
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            f"PROS: {state.get('pros')}\n"
            f"CONS: {state.get('cons')}\n\n"
            "Using the narrowed down analysis, pros, and cons, give a difficulty score. "
            "The score should be exactly between 1 to 10, 1 being the easiest and 10 being the most difficult. "
            "No filler, just the number itself."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "Give e difficulty score for the  validated idea"
            "nothing else should be given here just give the number and thats it"
            "No filler needs to be given here, just the number"
        )
    )
    response = await llm.ainvoke([system_prompt, instruction])
    return {"difficulty_score": response.content}

async def define_competitors_list(state: ValidationEngineState) -> dict:
    """Defines real competitors for the user's validated idea."""
    instruction = HumanMessage(
        content=(
            f"Original idea:\n{state.get('user_idea', '')}\n\n"
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            "Using the original idea and narrowed-down analysis above, list real companies "
            "that already compete in this market. "
            "List at least 5 competitors if they exist. "
            "Return only competitor names, one per line."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at identifying real market competitors. "
            "Based on the user's idea, list real existing companies that compete in the same space. "
            "Do not invent fictional companies. "
            "Do not give examples of anything else or use conversational filler. "
            "Output only competitor names, one per line."
        )
    )

    response = await llm.ainvoke([system_prompt, instruction])
    return {"competitors_list": response.content}

async def get_validation_score(state: ValidationEngineState) -> dict:
    """Defines an overall validation score for the user's validated idea."""
    instruction = HumanMessage(
        content=(
            f"Original idea:\n{state.get('user_idea', '')}\n\n"
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            f"PROS: {state.get('pros')}\n"
            f"CONS: {state.get('cons')}\n"
            f"DIFFICULTY SCORE: {state.get('difficulty_score')}\n"
            f"COMPETITORS: {state.get('competitors_list')}\n\n"
            "Using all of the context above, assign one validation score for how strong this idea is. "
            "The score should be exactly between 1 to 10, 1 being the weakest and 10 being the strongest. "
            "No filler, just the number itself."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "Give a validation score for the validated idea. "
            "Nothing else should be given here, just give the number and thats it. "
            "No filler needs to be given here, just the number."
        )
    )
    response = await llm.ainvoke([system_prompt, instruction])
    return {"validation_score": response.content}

async def define_validation_score_reasoning(state: ValidationEngineState) -> dict:
    """Explains why the validation score was assigned."""
    instruction = HumanMessage(
        content=(
            f"Original idea:\n{state.get('user_idea', '')}\n\n"
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            f"PROS: {state.get('pros')}\n"
            f"CONS: {state.get('cons')}\n"
            f"DIFFICULTY SCORE: {state.get('difficulty_score')}\n"
            f"COMPETITORS: {state.get('competitors_list')}\n"
            f"VALIDATION SCORE: {state.get('validation_score')}\n\n"
            "Give a brief explanation of why the validation score is appropriate. "
            "Maximum 5 sentences total. Keep it short for a simple UI summary."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at explaining startup validation scores. "
            "Explain why the score was given in at most 5 short sentences. "
            "No bullet lists, no headings, no long paragraphs. "
            "Do not change the score. "
            "Do not use conversational filler."
        )
    )
    response = await llm.ainvoke([system_prompt, instruction])
    return {"validation_score_reasoning": response.content}

"""
Graph visualization
-> WORKING ON IT....
"""

# Create langgraph graph
graph = StateGraph(ValidationEngineState)

graph.add_node("validate_idea_node", validate_idea)
graph.add_node("define_pros_node", define_pros)
graph.add_node("define_cons_node", define_cons)
graph.add_node("get_difficulty_score_node", get_difficulty_score)
graph.add_node("define_competitors_list_node", define_competitors_list)
graph.add_node("get_validation_score_node", get_validation_score)
graph.add_node("define_validation_score_reasoning_node", define_validation_score_reasoning)

# Add graph edges
graph.add_edge(START, "validate_idea_node")
graph.add_edge("validate_idea_node", "define_pros_node")
graph.add_edge("define_pros_node", "define_cons_node")
graph.add_edge("define_cons_node", "get_difficulty_score_node")
graph.add_edge("get_difficulty_score_node", "define_competitors_list_node")
graph.add_edge("define_competitors_list_node", "get_validation_score_node")
graph.add_edge("get_validation_score_node", "define_validation_score_reasoning_node")
graph.add_edge("define_validation_score_reasoning_node", END)

# Compile the graph (validation_app — FastAPI uses `app` in main.py)
validation_app = graph.compile()


"""
Testing the graph functionality along with llm time
"""

async def main():
    initial_input = {
        "user_idea": "A platform where local chefs can rent out restaurant kitchens during their off-hours to host pop-up dining experiences."
    }
    
    print("🚀 Running LangGraph Validation Engine...")
    print(f"User Input: {initial_input['user_idea']}\n")
    print("Waiting for LLM generation...")
    print("=" * 70)

    # Execute the graph asynchronously
    final_output = await validation_app.ainvoke(initial_input)

    print("\n--- [NODE OUTPUT] NARROWED DOWN IDEA ---")
    print(final_output.get("narrowed_down_idea"))

    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] PROS ---")
    print("=" * 70)
    print(final_output.get("pros"))

    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] CONS ---")
    print("=" * 70)
    print(final_output.get("cons"))
    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] DIFFICULTY SCORE ---")
    print("=" * 70)
    print(final_output.get("difficulty_score"))

    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] COMPETITORS LIST ---")
    print("=" * 70)
    print(final_output.get("competitors_list"))

    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] VALIDATION SCORE ---")
    print("=" * 70)
    print(final_output.get("validation_score"))

    print("\n" + "=" * 70)
    print("--- [NODE OUTPUT] VALIDATION SCORE REASONING ---")
    print("=" * 70)
    print(final_output.get("validation_score_reasoning"))
    print("\n" + "=" * 70)

if __name__ == "__main__":
    asyncio.run(main())