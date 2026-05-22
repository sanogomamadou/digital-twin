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

class KpiList(BaseModel):
    kpis: List[KpiProposal] = Field(description="List of exactly 3 to 5 brilliant KPIs.")

KPI_SYSTEM_PROMPT = """You are an elite Data Scientist and Domain Architect specializing in Industry 4.0 Digital Twins.
Your task is to analyze an industry `domain` and a list of available PostgreSQL `columns`, and engineer exactly 3 to 5 BRILLIANT, HIGH-VALUE Key Performance Indicators (KPIs).

Do not just return the raw columns. You must deduce the physical meaning of the data and propose advanced metrics that operational managers actually care about.
Depending on the domain, construct metrics such as:
- **Factory/Manufacturing**: Overall Equipment Effectiveness (OEE), scrap rates, output efficiency, temperature deltas, pressure drops.
- **Airport**: Passenger throughput, average security wait times, baggage handling efficiency, gate turnaround times.
- **Warehousing/Supply Chain**: Picking velocity, storage density, conveyor belt load factor, sorting accuracy.

CRITICAL: YOU MUST ONLY USE EXACT COLUMN NAMES PROVIDED IN THE INPUT FOR YOUR FORMULAS. DO NOT HALLUCINATE COLUMN NAMES.
"""

def fallback_kpi_proposals(columns: List[str]) -> List[Dict]:
    """Fallback mocked KPIs if LLM is down."""
    mock_kpis = []
    if columns:
        col1 = columns[0]
        col2 = columns[1] if len(columns) > 1 else columns[0]
        mock_kpis.append({
            "kpi_name": "Base " + col1.title(),
            "formula": col1,
            "unit": "units",
            "direction": "asc",
            "orange": 75,
            "red": 90,
            "interaction": "pulse"
        })
        if col1 != col2:
            mock_kpis.append({
                "kpi_name": f"{col1.title()} & {col2.title()} Sum",
                "formula": f"{col1} + {col2}",
                "unit": "units",
                "direction": "asc",
                "orange": 150,
                "red": 200,
                "interaction": "transition"
            })
    return mock_kpis

async def propose_kpis(domain: str, columns: List[str]) -> List[Dict]:
    """Invoke the LLM to get proposed KPIs using structured output."""
    if not columns:
        return []

    if not has_real_llm():
        return fallback_kpi_proposals(columns)

    llm = get_llm()
    structured_llm = llm.with_structured_output(KpiList)
    
    user_content = json.dumps({"domain": domain, "columns": columns}, indent=2)
    messages = [
        SystemMessage(content=KPI_SYSTEM_PROMPT),
        HumanMessage(content=f"Generate KPIs for:\n{user_content}")
    ]
    
    try:
        result = structured_llm.invoke(messages)
        return [k.model_dump() for k in result.kpis]
    except Exception as e:
        print(f"Error in KPI structured output: {e}")
        return fallback_kpi_proposals(columns)
