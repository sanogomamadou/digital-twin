import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db import crud
from models.schemas import (
    AnalyticsQueryRequest, AnalyticsQueryResponse,
    ChartFromPromptRequest, ChartConfig, QuerySuggestion, ReportRequest
)
from fastapi.responses import StreamingResponse
from agents.nlq_agent import run_nlq_agent_stream
from agents.chart_agent import run_chart_agent
from agents.report_agent import run_report_agent

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/query")
async def nlq_query(request: AnalyticsQueryRequest, db: Session = Depends(get_db)):
    """
    Ask a natural language question about KPI data.
    Returns an answer + a chart configuration ready for Recharts as a SSE stream.
    """
    try:
        records = crud.get_kpi_data(
            db,
            component_id=request.componentId,
            limit=2000,
        )
        # Save query to history (answer filled after agent)
        db_record = crud.save_query(db, question=request.question, answer="", chart_config=None)

        return StreamingResponse(
            run_nlq_agent_stream(request, records, db_query_id=db_record.id, db=db, db_record=db_record),
            media_type="text/event-stream"
        )

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
async def generate_report(request: ReportRequest, db: Session = Depends(get_db)):
    """
    Generate an AI PDF report text based on the current twin data and historical DB data.
    """
    try:
        records = crud.get_kpi_data(db, limit=5000)
        report_text = await run_report_agent(request.model_dump(), records)
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
async def get_suggestions(db: Session = Depends(get_db)):
    """Return generic predefined NLQ suggestions based on the twin's domain."""
    layout = crud.get_layout(db, "default")
    domain = layout.domain.lower() if layout and layout.domain else "factory"
    
    if "airport" in domain:
        return [
            QuerySuggestion(text="Show the trend of Passenger Flow over time", category="trend"),
            QuerySuggestion(text="Compare Security Wait across all terminals", category="compare"),
            QuerySuggestion(text="Are there any anomalies in Gate Utilization?", category="anomaly"),
            QuerySuggestion(text="What is the average Baggage Delay?", category="summary"),
            QuerySuggestion(text="Show me a distribution chart of Passenger Flow by zone", category="compare"),
            QuerySuggestion(text="What is the overall airport status?", category="summary"),
        ]
    elif "warehouse" in domain:
        return [
            QuerySuggestion(text="Show the trend of Pick Rate in the storage zones", category="trend"),
            QuerySuggestion(text="Compare Dock Utilization across all docks", category="compare"),
            QuerySuggestion(text="Are there any anomalies in Order Cycle Time?", category="anomaly"),
            QuerySuggestion(text="What is the average Rack Fill Rate?", category="summary"),
            QuerySuggestion(text="Show me a distribution chart of Pick Rate by area", category="compare"),
            QuerySuggestion(text="What is the warehouse status?", category="summary"),
        ]
    else:
        return [
            QuerySuggestion(text="Show the trend of Machine Temperature over time", category="trend"),
            QuerySuggestion(text="Compare Production Throughput across all machines", category="compare"),
            QuerySuggestion(text="Are there any anomalies in Machine Downtime?", category="anomaly"),
            QuerySuggestion(text="What is the average Quality Rate?", category="summary"),
            QuerySuggestion(text="Show me a distribution chart of Production Throughput", category="compare"),
            QuerySuggestion(text="What is the system status?", category="summary"),
        ]
