"""
KPI Agent — Uses structured output to propose KPIs based on the domain and available DB columns.
"""
from typing import List, Dict
import json
from pydantic import BaseModel, Field
from services.llm_service import get_llm, has_real_llm
from langchain_core.messages import SystemMessage, HumanMessage

class KpiProposal(BaseModel):
    kpi_name: str = Field(description="A professional, actionable label (e.g., 'Thermal Efficiency').")
    formula: str = Field(description="A mathematical formula EXACTLY matching the available columns. Use basic math operators: +, -, *, /.")
    unit: str = Field(description="The strictly correct unit of measurement (e.g., '%', 'bar', '°C').")
    direction: str = Field(description="'asc' if higher values are BAD, 'desc' if lower values are BAD.")
    orange: float = Field(description="The threshold value for a Warning state.")
    red: float = Field(description="The critical threshold for a Red Alert state.")
    interaction: str = Field(description="'transition' for continuous stats, 'pulse' for alerts, 'glow' for efficiencies.")
    target_machine_id: str = Field(description="The ID of the most appropriate machine from the provided components list for this KPI, or empty if none fits.")

class KpiList(BaseModel):
    kpis: List[KpiProposal] = Field(description="List of exactly 3 to 5 brilliant KPIs.")

KPI_SYSTEM_PROMPT = """You are an elite Data Scientist and Domain Architect specializing in Industry 4.0 Digital Twins.
Your task is to analyze an industry `domain`, a list of available PostgreSQL `columns`, and a list of `components` (machines/assets), and engineer exactly 3 to 5 BRILLIANT, HIGH-VALUE Key Performance Indicators (KPIs).

Do not just return the raw columns. You must deduce the physical meaning of the data and propose advanced metrics that operational managers actually care about.
Depending on the domain, construct metrics such as:
- **Factory/Manufacturing**: Overall Equipment Effectiveness (OEE), scrap rates, output efficiency, temperature deltas, pressure drops.
- **Airport**: Passenger throughput, average security wait times, baggage handling efficiency, gate turnaround times.
- **Warehousing/Supply Chain**: Picking velocity, storage density, conveyor belt load factor, sorting accuracy.

CRITICAL: YOU MUST ONLY USE EXACT COLUMN NAMES PROVIDED IN THE INPUT FOR YOUR FORMULAS. DO NOT HALLUCINATE COLUMN NAMES.
Assign the most appropriate `target_machine_id` from the provided `components` list based on the nature of the KPI.
"""

def fallback_kpi_proposals(columns: List[str], components: List[Dict[str, str]] = None) -> List[Dict]:
    """Fallback mocked KPIs if LLM is down."""
    mock_kpis = []
    if not columns:
        return mock_kpis

    for i, col in enumerate(columns[:4]):
        machine_idx = i % len(components) if components else 0
        target_machine_id = components[machine_idx]["id"] if components else ""
        
        mock_kpis.append({
            "kpi_name": col.replace("_", " ").title(),
            "formula": col,
            "unit": "units",
            "direction": "asc",
            "orange": 75,
            "red": 90,
            "interaction": "pulse" if i % 2 == 0 else "transition",
            "target_machine_id": target_machine_id
        })
        
    if len(columns) >= 2:
        col1 = columns[0]
        col2 = columns[1]
        machine_idx = 4 % len(components) if components else 0
        target_machine_id = components[machine_idx]["id"] if components else ""
        mock_kpis.append({
            "kpi_name": f"Ratio {col1}/{col2}",
            "formula": f"{col1} / ({col2} + 0.1)",
            "unit": "%",
            "direction": "desc",
            "orange": 2.0,
            "red": 1.0,
            "interaction": "glow",
            "target_machine_id": target_machine_id
        })
        
    return mock_kpis

async def propose_kpis(domain: str, columns: List[str], components: List[Dict[str, str]] = None) -> List[Dict]:
    """Invoke the LLM to get proposed KPIs using structured output."""
    if components is None:
        components = []

    if not columns:
        return []

    if not has_real_llm():
        return fallback_kpi_proposals(columns, components)

    llm = get_llm()
    structured_llm = llm.with_structured_output(KpiList)
    
    user_content = json.dumps({"domain": domain, "columns": columns, "components": components}, indent=2)
    messages = [
        SystemMessage(content=KPI_SYSTEM_PROMPT),
        HumanMessage(content=f"Generate KPIs for:\n{user_content}")
    ]
    
    try:
        from services.llm_service import get_langfuse_callback, AgentMetricsCallbackHandler
        import uuid
        callbacks = [AgentMetricsCallbackHandler(uuid.uuid4())]
        lf_cb = get_langfuse_callback()
        if lf_cb:
            callbacks.append(lf_cb)
        result = structured_llm.invoke(messages, config={"callbacks": callbacks})
        return [k.model_dump() for k in result.kpis]
    except Exception as e:
        print(f"Error in KPI structured output: {e}")
        return fallback_kpi_proposals(columns, components)
