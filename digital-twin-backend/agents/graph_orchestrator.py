from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END, add_messages
from langgraph.prebuilt import ToolNode
from agents.tools import get_kpi_list, get_kpi_statistics, detect_kpi_anomalies, get_recent_values, get_kpi_trend_over_time, compare_kpi_across_components, search_documentation
from services.llm_service import get_llm

# Define the state for the LangGraph
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]

_cached_workflow = None

def create_analytics_orchestrator():
    """Builds and returns the LangGraph orchestrator for Analysis (NLQ or Reports)."""
    global _cached_workflow
    if _cached_workflow is not None:
        return _cached_workflow

    llm = get_llm()
    if not llm:
        raise ValueError("Groq LLM is not configured properly.")

    # 1. Define tools
    tools = [get_kpi_list, get_kpi_statistics, detect_kpi_anomalies, get_recent_values, get_kpi_trend_over_time, compare_kpi_across_components, search_documentation]
    
    # 2. Bind tools to the LLM
    llm_with_tools = llm.bind_tools(tools)
    
    # 3. Define Nodes
    async def agent_node(state: AgentState):
        messages = state["messages"]
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}
        
    tool_node = ToolNode(tools)

    # 4. Build Graph
    workflow = StateGraph(AgentState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    workflow.set_entry_point("agent")
    
    # Logic to route: if agent calls a tool -> go to tools, else -> end
    def should_continue(state: AgentState) -> str:
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END

    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")
    
    _cached_workflow = workflow.compile()
    return _cached_workflow
