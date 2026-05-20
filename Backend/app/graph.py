import asyncio
import re
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph

class ValidationEngineState(TypedDict):
    user_idea: str                       # User's intial idea
    narrowed_down_idea: str              # llm narrowed down idea

    pros: list[str]                 # List of pros of the idea
    cons: list[str]                 # List of cons of the idea

    difficulty_score: int           # Difficulty level score of idea
    competitors_list: list[str]          # List of competitors for the user's idea (real)

    validation_score: int           # Validation score, is this a good idea
    validation_score_reasoning: str # Reasoning from llm for the score

# LLM model being user (Switch to OpenAI later)
llm = ChatOllama(model="llama3.1")

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
            "Using the narrowed-down analysis above, list exactly 5 pros for the overall refined idea. "
            "For each distinct niche suggested in the analysis, list exactly 5 pros for that niche."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at identifying pros for ideas. "
            "Based on the user's idea, give 5 pros to their idea. "
            "Do not give examples of anything else or use conversational filler. "
            "Output 5 best things (pros) about the idea."
        )
    )

    response = await llm.ainvoke([system_prompt, instruction])
    return {"pros": response.content}

async def define_cons(state: ValidationEngineState) -> dict:
    """Defines the cons to the user's validated idea."""
    instruction = HumanMessage(
        content=(
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            "Using the narrowed-down analysis above, list exactly 5 cons for the overall refined idea. "
            "For each distinct niche suggested in the analysis, list exactly 5 cons for that niche."
        )
    )
    system_prompt = SystemMessage(
        content=(
            "You are a helpful skilled assistant good at identifying cons for ideas. "
            "Based on the user's idea, give 5 cons to their idea. "
            "Do not give examples of anything else or use conversational filler. "
            "Output 5 worst things (cons) about the idea."
        )
    )

    response = await llm.ainvoke([system_prompt, instruction])
    return {"cons": response.content}

async def get_difficulty_score(state: ValidationEngineState) -> dict:
    """ Defines a difficulty score based on the user's validated idea"""
    instruction = HumanMessage(
        content=(
            f"Narrowed-down analysis:\n{state.get('narrowed_down_idea', '')}\n\n"
            f"PROS: {state.get('pros')} CONS: {state.get('cons')}"
            "Using the narrowed down analysis idea and the pros and cons, give a score on difficulty also based on the pros and cons"
            "The score should be exactly between 1 to 10 , 1 being the easiest and 10 being the most difficult"
            "No filler, just the number itself"
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

# Add graph edges
graph.add_edge(START, "validate_idea_node")
graph.add_edge("validate_idea_node", "define_pros_node")
graph.add_edge("define_pros_node", "define_cons_node")
graph.add_edge("define_cons_node", "get_difficulty_score_node")
graph.add_edge("get_difficulty_score_node", END)


# Compile the graph
app = graph.compile()


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
    final_output = await app.ainvoke(initial_input)

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


    print("THE DIFFICULTY SCORE IS:" + final_output.get("difficulty_score"))

if __name__ == "__main__":
    asyncio.run(main())