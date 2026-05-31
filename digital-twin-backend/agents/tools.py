import json
from typing import List, Dict, Any, Optional
from langchain_core.tools import tool
from services.data_service import compute_stats
from datetime import datetime
import contextvars

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

current_records_var = contextvars.ContextVar("current_records", default=[])

@tool
def get_kpi_list() -> str:
    """
    Get the list of all available components and their associated KPI names in the current context.
    Returns a JSON list of dicts: [{"component_id": str, "kpi_names": list[str]}].
    Use this first to map component IDs (like 'gate_102_ri4nr') to their KPI names.
    """
    try:
        records = current_records_var.get()
        comp_to_kpis = {}
        for r in records:
            cid = getattr(r, "component_id", "")
            kname = getattr(r, "kpi_name", "")
            if cid and kname:
                comp_to_kpis.setdefault(cid, set()).add(kname)
        res = [{"component_id": cid, "kpi_names": list(kpis)} for cid, kpis in comp_to_kpis.items()]
        return json.dumps(res) if res else "[]"
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_kpi_statistics(kpi_name: str, component_id: Optional[str] = None) -> str:
    """
    Get statistical data (min, max, mean, std) for a specific KPI.
    Optionally filters by component_id. Do NOT pass component names (e.g. 'Gate 102') as kpi_name.
    """
    try:
        records = current_records_var.get()
        filtered = [
            {"timestamp": getattr(r, "timestamp", None), "value": getattr(r, "value", 0), "kpi_name": getattr(r, "kpi_name", "")}
            for r in records
            if getattr(r, "kpi_name", "") == kpi_name and (component_id is None or getattr(r, "component_id", "") == component_id)
        ]
        if not filtered:
            return json.dumps({"error": f"No data found for KPI '{kpi_name}'" + (f" and component '{component_id}'" if component_id else "")})
        
        stats = compute_stats(filtered, "value")
        return json.dumps(stats, default=json_serial)
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def detect_kpi_anomalies(kpi_name: str, component_id: Optional[str] = None, threshold_std: float = 2.5) -> str:
    """
    Detect anomalies (spikes or drops) for a specific KPI.
    Optionally filters by component_id. Do NOT pass component names as kpi_name.
    """
    try:
        records = current_records_var.get()
        filtered = [
            {"timestamp": getattr(r, "timestamp", None), "value": getattr(r, "value", 0), "kpi_name": getattr(r, "kpi_name", "")}
            for r in records
            if getattr(r, "kpi_name", "") == kpi_name and (component_id is None or getattr(r, "component_id", "") == component_id)
        ]
        if not filtered:
            return "[]"
            
        stats = compute_stats(filtered, "value")
        mean = stats.get("mean", 0)
        std = stats.get("std", 0)
        
        anomalies = []
        if std > 0:
            for r in filtered:
                if abs(r["value"] - mean) / std > threshold_std:
                    anomalies.append(r)
        res = anomalies[-10:] # Return top 10 recent anomalies
        return json.dumps(res, default=json_serial) if res else "[]"
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_recent_values(kpi_name: str, component_id: Optional[str] = None, limit: int = 5) -> str:
    """
    Get the most recent raw values for a specific KPI.
    Optionally filters by component_id. Do NOT pass component names as kpi_name.
    """
    try:
        records = current_records_var.get()
        filtered = [
            {"timestamp": getattr(r, "timestamp", None), "value": getattr(r, "value", 0), "kpi_name": getattr(r, "kpi_name", "")}
            for r in records
            if getattr(r, "kpi_name", "") == kpi_name and (component_id is None or getattr(r, "component_id", "") == component_id)
        ]
        # Sort by timestamp descending
        filtered.sort(key=lambda x: x["timestamp"] if x["timestamp"] else datetime.min, reverse=True)
        res = filtered[:limit]
        return json.dumps(res, default=json_serial) if res else "[]"
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def get_kpi_trend_over_time(kpi_name: str, interval: str = "1H", component_id: Optional[str] = None) -> str:
    """
    Get the trend of a KPI over time by grouping data into intervals (e.g. '1H', '6H', '1D').
    Returns JSON string with aggregated values (mean, max, min) per interval.
    Optionally filters by component_id.
    """
    import pandas as pd
    try:
        records = current_records_var.get()
        filtered = [
            {"timestamp": getattr(r, "timestamp", None), "value": getattr(r, "value", 0)}
            for r in records
            if getattr(r, "kpi_name", "") == kpi_name and (component_id is None or getattr(r, "component_id", "") == component_id)
        ]
        if not filtered:
            return json.dumps({"error": f"No data found for KPI '{kpi_name}'"})
        
        df = pd.DataFrame(filtered)
        if df.empty or "timestamp" not in df.columns:
            return "[]"
        
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.set_index("timestamp", inplace=True)
        # Resample and aggregate
        agg_df = df.resample(interval).agg({"value": ["mean", "max", "min"]}).dropna()
        agg_df.columns = ["mean", "max", "min"]
        agg_df.reset_index(inplace=True)
        # Convert timestamp back to string
        agg_df["timestamp"] = agg_df["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
        return agg_df.to_json(orient="records")
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def compare_kpi_across_components(kpi_name: str) -> str:
    """
    Compare a specific KPI across all different components (machines, gates, etc).
    Returns JSON string with the average and max values for each component.
    """
    import pandas as pd
    try:
        records = current_records_var.get()
        filtered = [
            {"component_id": getattr(r, "component_id", "unknown"), "value": getattr(r, "value", 0)}
            for r in records
            if getattr(r, "kpi_name", "") == kpi_name
        ]
        if not filtered:
            return json.dumps({"error": f"No data found for KPI '{kpi_name}'"})
        
        df = pd.DataFrame(filtered)
        if df.empty:
            return "[]"
        
        agg_df = df.groupby("component_id").agg({"value": ["mean", "max"]}).reset_index()
        agg_df.columns = ["component_id", "mean", "max"]
        # Round the values
        agg_df["mean"] = agg_df["mean"].round(2)
        agg_df["max"] = agg_df["max"].round(2)
        return agg_df.to_json(orient="records")
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool
def search_documentation(query: str) -> str:
    """
    Search the internal documentation for procedures, emergency protocols, and rules.
    Use this tool when the user asks about procedures, rules, limits, or what to do in case of an anomaly.
    """
    import os
    try:
        doc_path = os.path.join(os.path.dirname(__file__), "..", "source_data", "internal_procedures.md")
        if not os.path.exists(doc_path):
            return "Error: Internal procedures document not found."
        
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Very simple RAG: just return the whole document for now as it is small.
        # In a real system, we'd use vector search.
        return f"Document Content:\n{content}"
    except Exception as e:
        return f"Error reading documentation: {str(e)}"

