import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from models.schemas import (
    AnalyticsQueryRequest, AnalyticsQueryResponse,
    ChartFromPromptRequest, ChartConfig, QuerySuggestion
)
from agents.nlq_agent import run_nlq_agent
from agents.chart_agent import run_chart_agent
from agents.report_agent import run_report_agent

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/query", response_model=AnalyticsQueryResponse)
async def nlq_query(request: AnalyticsQueryRequest, db: Session = Depends(get_db)):
    """
    Ask a natural language question about KPI data.
    Returns an answer + a chart configuration ready for Recharts.
    """
    try:
        records = crud.get_kpi_data(
            db,
            component_id=request.componentId,
            limit=2000,
        )
        # Save query to history (answer filled after agent)
        db_record = crud.save_query(db, question=request.question, answer="", chart_config=None)

        response = await run_nlq_agent(request, records, db_query_id=db_record.id)

        # Update history record with answer
        db_record.answer = response.answer
        if response.chart:
            db_record.chart_config_json = json.dumps(response.chart.model_dump(), default=str)
        db.commit()

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chart", response_model=ChartConfig)
async def chart_from_prompt(request: ChartFromPromptRequest):
    """
    Given raw data and a prompt, generate the best Recharts chart config.
    """
    try:
        return await run_chart_agent(request.prompt, request.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/report")
async def generate_report(request: dict):
    """
    Generate an AI PDF report text based on the current twin data.
    """
    try:
        report_text = await run_report_agent(request)
        return {"report": report_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_history(limit: int = 20, db: Session = Depends(get_db)):
    """Get the last N NLQ query history records."""
    records = crud.get_query_history(db, limit)
    return [
        {
            "id": r.id,
            "question": r.question,
            "answer": r.answer,
            "chartConfig": json.loads(r.chart_config_json) if r.chart_config_json else None,
            "createdAt": str(r.created_at),
        }
        for r in records
    ]


@router.get("/suggestions", response_model=list[QuerySuggestion])
def get_suggestions(db: Session = Depends(get_db)):
    """Return smart NLQ suggestions based on available KPI data."""
    summary = crud.get_all_kpi_summary(db)
    suggestions = []

    if not summary:
        return [
            QuerySuggestion(text="What is the system status?", category="summary"),
            QuerySuggestion(text="Show me an overview dashboard", category="summary"),
        ]

    kpi_names = list({r["kpi_name"] for r in summary})
    comp_ids  = list({r["component_id"] for r in summary})

    suggestions += [
        QuerySuggestion(text=f"Show the trend of {kpi_names[0]} over time", category="trend"),
        QuerySuggestion(text=f"Compare {kpi_names[0]} across all components", category="compare"),
        QuerySuggestion(text="Are there any anomalies in my KPI data?", category="anomaly"),
        QuerySuggestion(text=f"What is the average {kpi_names[0]}?", category="summary"),
        QuerySuggestion(text=f"Show me a distribution chart of {kpi_names[0]}", category="compare"),
    ]
    if len(kpi_names) > 1:
        suggestions.append(QuerySuggestion(
            text=f"Show {kpi_names[0]} vs {kpi_names[1]} on the same chart",
            category="compare"
        ))
    if comp_ids:
        suggestions.append(QuerySuggestion(
            text=f"What are the KPI stats for component {comp_ids[0]}?",
            category="summary"
        ))

    return suggestions[:8]
