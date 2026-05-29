"""
NLQ Analytics Agent — converts natural language questions about KPIs
into structured answers + chart configurations using a LangGraph ReAct Agent.
"""
from __future__ import annotations
import json
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage

from models.schemas import (
    AnalyticsQueryRequest, AnalyticsQueryResponse,
    ChartConfig, SeriesConfig, ReferenceLine
)
from services.data_service import (
    records_to_chart_data, filter_by_time_range
)
from agents.tools import current_records_var
from agents.graph_orchestrator import create_analytics_orchestrator
from services.llm_service import get_llm, has_real_llm
from agents.utils import extract_json_from_text
from agents.chart_agent import run_chart_agent

NLQ_SYSTEM_PROMPT = """You are an expert analytics AI for a Digital Twin platform.
You have access to tools to query KPI statistics, detect anomalies, view recent values, and a powerful `analyze_with_pandas` tool for custom scripts.
You MUST use these tools to analyze the data to answer the user's question. For complex analytical queries (correlations, groupby, trends), heavily prefer writing custom Python using the `analyze_with_pandas` tool. 

CRITICAL INSTRUCTIONS:
1. LANGUAGE: You MUST answer in the EXACT SAME LANGUAGE as the user's question (e.g., if the user speaks French, answer in French).
2. DATA VISUALIZATION: NEVER put KPIs with vastly different units or scales (e.g., Percentages, Hertz, Bars) on the same LineChart or AreaChart, as it crushes the smaller values. If asked for a general overview, pick the 1 or 2 most critical KPIs to plot, or use a BarChart to compare their normalized stats.
3. TONE: Be concise, analytical, and provide a true business synthesis rather than just listing numbers robotically.

When you have gathered enough information, you MUST return your final answer as a raw JSON object containing exactly the following keys:
- "answer": string — direct, insightful answer based on the tool results (max 3-4 sentences, use actual numbers, structured nicely).
- "chart_instruction": string — a clear, natural language instruction for a dedicated Data Visualization Agent. Describe exactly what kind of chart would best illustrate your answer, what KPIs to plot, and any important reference lines (e.g. "Create a line chart comparing Pressure and Vibration over the last 24h, with a red reference line at 80%").

CRITICAL: Your final response MUST be ONLY valid JSON, no markdown blocks, no ```json, no extra text.
"""





import asyncio
from typing import AsyncGenerator

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

async def run_nlq_agent_stream(
    request: AnalyticsQueryRequest,
    records: list,
    db_query_id: int = 0,
    db = None,
    db_record = None,
    thread_id: str = "default_session"
) -> AsyncGenerator[str, None]:
    
    records_dicts = [
        {"timestamp": getattr(r, "timestamp"), "value": getattr(r, "value"), "kpi_name": getattr(r, "kpi_name"), "component_id": getattr(r, "component_id")}
        for r in records
    ]
    filtered_dicts = filter_by_time_range(records_dicts, request.timeRange or "24h")

    # Mock fallback if no Groq
    if not has_real_llm():
        yield f'data: {json.dumps({"type": "thought", "content": "No API key found. Using fallback..."})}\n\n'
        await asyncio.sleep(1)
        resp = {
            "type": "result",
            "answer": "Groq API key is missing. Please configure it in .env to use the LangGraph agent.",
            "chart": ChartConfig(chartType="BarChart", title="Missing LLM", xKey="name", series=[], data=[]).model_dump(),
            "rawData": filtered_dicts[-50:],
            "queryId": db_query_id
        }
        yield f'data: {json.dumps(resp, default=json_serial)}\n\n'
        return

    # 1. Set the context variable so tools can access the current data
    token = current_records_var.set(records)
    
    try:
        app = create_analytics_orchestrator()
        
        inputs = {
            "messages": [
                SystemMessage(content=NLQ_SYSTEM_PROMPT),
                HumanMessage(content=f"Time range: {request.timeRange}. User Question: {request.question}")
            ]
        }
        
        config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 10}
        
        llm_result = None
        
        # Use astream(stream_mode="updates") instead of ainvoke or astream_events
        # This is safe on Windows and still allows us to stream thoughts!
        try:
            async for chunk in app.astream(inputs, config=config, stream_mode="updates"):
                for node, values in chunk.items():
                    if node == "agent":
                        # The agent made a decision (either called a tool or finished)
                        last_message = values["messages"][-1]
                        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                            for tc in last_message.tool_calls:
                                yield f'data: {json.dumps({"type": "thought", "content": f"Using tool: {tc.get("name")}..."})}\n\n'
                                await asyncio.sleep(0.05)
                    elif node == "tools":
                        # Tools finished executing
                        yield f'data: {json.dumps({"type": "thought", "content": "Tool finished. Analyzing results..."})}\n\n'
                        await asyncio.sleep(0.05)
            
            # Extract final result
            final_state = app.get_state(config).values
            
            final_message = final_state["messages"][-1].content
            llm_result = extract_json_from_text(final_message)
            if not llm_result:
                raise ValueError("Could not extract JSON from response.")
                
        except Exception as e:
            print(f"Error in NLQ agent: {e}")
            llm_result = {
                "answer": f"Analysis failed (fallback): {str(e)}",
                "chart_instruction": "Create a bar chart showing the error."
            }
            
    finally:
        current_records_var.reset(token)

    # 5. Build response
    answer = llm_result.get("answer", "Analysis complete.")
    chart_instruction = llm_result.get("chart_instruction", "Generate a basic chart for the data.")
    
    yield f'data: {json.dumps({"type": "thought", "content": "Generating dynamic chart..."})}\n\n'
    
    # 6. Delegate chart creation
    class MockRecord:
        def __init__(self, d):
            self.timestamp = d["timestamp"]
            self.value = d["value"]
            self.kpi_name = d["kpi_name"]
            
    filtered_dicts.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min)
    
    mock_records = [MockRecord(d) for d in filtered_dicts]
    chart_data = records_to_chart_data(mock_records)
    
    chart = await run_chart_agent(chart_instruction, chart_data[-100:])

    final_resp = {
        "type": "result",
        "answer": answer,
        "chart": chart.model_dump() if chart else None,
        "rawData": filtered_dicts[-50:],
        "queryId": db_query_id
    }
    
    if db_query_id > 0:
        from db.database import SessionLocal, QueryHistoryDB
        fresh_db = SessionLocal()
        try:
            fresh_db_record = fresh_db.query(QueryHistoryDB).filter(QueryHistoryDB.id == db_query_id).first()
            if fresh_db_record:
                fresh_db_record.answer = answer
                if chart:
                    fresh_db_record.chart_config_json = json.dumps(chart.model_dump(), default=str)
                fresh_db.commit()
        except Exception as db_err:
            print(f"Error updating query history: {db_err}")
        finally:
            fresh_db.close()
    
    yield f'data: {json.dumps(final_resp, default=json_serial)}\n\n'



