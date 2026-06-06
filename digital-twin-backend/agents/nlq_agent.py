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
from services.llm_service import get_llm, has_real_llm, get_base_system_prompt
from agents.utils import extract_json_from_text
from agents.chart_agent import run_chart_agent
from services.llm_service import get_langfuse_prompt
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import uuid

class NLQResponseSchema(BaseModel):
    answer: str = Field(description="Direct, insightful answer based on the tool results (max 3-4 sentences).")
    chart_instruction: str = Field(description="A clear, natural language instruction for a dedicated Data Visualization Agent.")

parser = PydanticOutputParser(pydantic_object=NLQResponseSchema)

NLQ_SYSTEM_PROMPT = """You are an expert analytics AI for a Digital Twin platform.
You have access to tools to query KPI statistics, detect anomalies, view recent values, get the trend of a KPI over time, and compare a KPI across components.
You MUST use these tools to analyze the data to answer the user's question. Use the `get_kpi_list` tool FIRST to discover what KPIs are available in the current dataset. Use the `get_kpi_trend_over_time` tool to analyze time-series trends, and use `compare_kpi_across_components` to evaluate performance differences between machines or zones.

CRITICAL INSTRUCTIONS:
1. AVAILABLE KPIs: Only analyze and refer to the KPIs that are ACTUALLY present in the data provided to you by the tools. DO NOT invent, assume, or search for KPIs like "Pressure" or "Vibration" unless they are explicitly in the dataset for the current domain.
2. LANGUAGE: You MUST answer in the EXACT SAME LANGUAGE as the user's question (e.g., if the user speaks French, answer in French).
2. DATA VISUALIZATION: NEVER put KPIs with vastly different units or scales (e.g., Percentages, Hertz, Bars) on the same LineChart or AreaChart, as it crushes the smaller values. If asked for a general overview, pick the 1 or 2 most critical KPIs to plot, or use a BarChart to compare their normalized stats.
3. TONE: Be concise, analytical, and provide a true business synthesis rather than just listing numbers robotically.

When you have gathered enough information, you MUST return your final answer as a raw JSON object containing exactly the following keys:
- "answer": string — direct, insightful answer based on the tool results (max 3-4 sentences, use actual numbers, structured nicely).
- "chart_instruction": string — a clear, natural language instruction for a dedicated Data Visualization Agent. Describe exactly what kind of chart would best illustrate your answer, what KPIs to plot, and any important reference lines (e.g. "Create a line chart comparing [KPI_1] and [KPI_2] over the last 24h, with a red reference line at 80%").

CRITICAL: Your final response MUST be ONLY valid JSON, no markdown blocks, no ```json, no extra text.
{format_instructions}
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
    filtered_dicts = filter_by_time_range(records_dicts, request.time_range or "24h")

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
        
        base_prompt = get_base_system_prompt()
        dynamic_nlq_prompt = get_langfuse_prompt("nlq_system_prompt", fallback_prompt=NLQ_SYSTEM_PROMPT)
        dynamic_nlq_prompt = dynamic_nlq_prompt.replace("{format_instructions}", parser.get_format_instructions())
        
        full_system_prompt = f"{base_prompt}\n\n{dynamic_nlq_prompt}" if base_prompt else dynamic_nlq_prompt

        messages_list = [SystemMessage(content=full_system_prompt)]
        if getattr(request, 'history', None):
            from langchain_core.messages import AIMessage
            for msg in request.history[-6:]: # Keep last 3 turns
                if msg.role == "user":
                    messages_list.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    messages_list.append(AIMessage(content=msg.content))
        
        messages_list.append(HumanMessage(content=f"Time range: {request.time_range}. User Question: {request.question}"))
        
        inputs = {
            "messages": messages_list
        }

        # Create deterministic UUID for trace_id to link feedback later
        trace_id_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"query_{db_query_id}")
        config = {"recursion_limit": 10, "run_id": trace_id_uuid}
        
        # Inject Langfuse callback for full Graph tracing
        from services.llm_service import get_langfuse_callback
        lf_cb = get_langfuse_callback()
        if lf_cb:
            config["callbacks"] = [lf_cb]
            
        yield f'data: ' + json.dumps({"type": "thought", "content": "Contacting Groq LLM..."}) + '\n\n'
        await asyncio.sleep(0.05)
        
        llm_result = None
        
        # Use astream(stream_mode="updates") instead of ainvoke or astream_events
        # This is safe on Windows and still allows us to stream thoughts!
        try:
            last_agent_message = None
            async for chunk in app.astream(inputs, config=config, stream_mode="updates"):
                for node, values in chunk.items():
                    if node == "agent":
                        # The agent made a decision (either called a tool or finished)
                        last_message = values["messages"][-1]
                        last_agent_message = last_message
                        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                            for tc in last_message.tool_calls:
                                tool_name = tc.get("name")
                                yield f'data: {json.dumps({"type": "thought", "content": f"Using tool: {tool_name}..."})}\n\n'
                                await asyncio.sleep(0.05)
                    elif node == "tools":
                        # Tools finished executing
                        yield f'data: {json.dumps({"type": "thought", "content": "Tool finished. Analyzing results..."})}\n\n'
                        await asyncio.sleep(0.05)
            
            if not last_agent_message:
                raise ValueError("No response from agent")
                
            final_message = last_agent_message.content
            
            # Guardrails: Attempt to parse with Pydantic
            try:
                parsed_output = parser.parse(final_message)
                llm_result = parsed_output.model_dump()
            except Exception as parse_e:
                print(f"[Guardrails] Pydantic parsing failed: {parse_e}. Falling back to dirty JSON extract.")
                llm_result = extract_json_from_text(final_message)
                
            if not llm_result:
                raise ValueError("Could not extract or validate JSON from response.")
                
        except Exception as e:
            print(f"Error in NLQ agent: {e}")
            yield f'data: ' + json.dumps({"type": "thought", "content": f"Error: {str(e)}"}) + '\n\n'
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



