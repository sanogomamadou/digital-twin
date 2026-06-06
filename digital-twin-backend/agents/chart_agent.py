"""
Chart Agent — given raw data + user prompt, generates a complete
Recharts-compatible chart configuration JSON using structured output.
"""
from __future__ import annotations
import json
from models.schemas import ChartConfig, ChartLLMConfig, SeriesConfig, ReferenceLine
from services.llm_service import get_llm, has_real_llm
from services.data_service import infer_chart_type
from langchain_core.messages import SystemMessage, HumanMessage

COLORS = ["#6395ff", "#10d98d", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"]

CHART_SYSTEM_PROMPT = """You are a data visualization expert.
Given data (JSON) and a user prompt, return a valid ChartConfig structure.
Pick the most effective chart type for the data shape and user intent.
Use standard keys for 'chartType' like AreaChart, LineChart, BarChart.
"""

def mock_chart_config(prompt: str, data: list[dict]) -> ChartConfig:
    """Rule-based chart config generation."""
    chart_type = infer_chart_type(prompt, data)
    if not data:
        return ChartConfig(chartType="BarChart", title="No data", xKey="name", series=[], referenceLines=[], insight="", stacked=False, gradient=True, data=[])

    sample = data[0]
    x_key = next((k for k in ("timestamp", "time", "date", "name", "label") if k in sample), list(sample.keys())[0])
    num_keys = [k for k in sample if k != x_key and isinstance(sample[k], (int, float))]

    series = [SeriesConfig(key=k, name=k.replace("_", " ").title(), color=COLORS[i % len(COLORS)], type="monotone") for i, k in enumerate(num_keys[:6])]

    return ChartConfig(
        chartType=chart_type,
        title=f"Chart — {prompt[:50]}",
        xKey=x_key,
        series=series,
        referenceLines=[],
        data=data,
        insight=f"Showing {len(data)} data points across {len(num_keys)} metrics.",
        stacked=False,
        gradient=True
    )


async def run_chart_agent(prompt: str, data: list[dict]) -> ChartConfig:
    if not has_real_llm():
        return mock_chart_config(prompt, data)

    llm = get_llm()
    structured_llm = llm.with_structured_output(ChartLLMConfig)
    
    context = json.dumps({
        "prompt": prompt,
        "data_sample": data[:10],
        "total_rows": len(data),
        "columns": list(data[0].keys()) if data else [],
    }, indent=2)
    
    messages = [
        SystemMessage(content=CHART_SYSTEM_PROMPT),
        HumanMessage(content=f"Generate the chart config for:\n{context}")
    ]
    
    try:
        from services.llm_service import get_langfuse_callback, AgentMetricsCallbackHandler
        import uuid
        trace_id_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, "chart_agent")
        callbacks = [AgentMetricsCallbackHandler(trace_id_uuid)]
        lf_cb = get_langfuse_callback()
        if lf_cb:
            callbacks.append(lf_cb)
            
        result = structured_llm.invoke(messages, config={"callbacks": callbacks})
            
        return ChartConfig(
            chartType=result.chartType,
            title=result.title,
            xKey=result.xKey,
            yLabel=result.yLabel,
            series=result.series,
            referenceLines=result.referenceLines,
            data=data,
            insight=result.insight,
            stacked=result.stacked,
            gradient=result.gradient,
        )
    except Exception as e:
        print(f"Error in chart structured output: {e}")
        return mock_chart_config(prompt, data)
