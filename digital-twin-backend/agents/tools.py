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
def analyze_with_pandas(script: str) -> str:
    """
    Execute a custom Python script using Pandas to analyze data.
    The environment contains a pandas DataFrame named `df` populated with the current KPI records.
    The DataFrame columns are: 'timestamp', 'value', 'kpi_name', 'component_id'.
    The script MUST print its result to stdout using `print()`. 
    Example: `print(df.groupby('kpi_name')['value'].mean().to_json())`
    """
    import pandas as pd
    import sys
    import io
    import textwrap
    
    try:
        records = current_records_var.get()
        data = [
            {
                "timestamp": getattr(r, "timestamp", None), 
                "value": getattr(r, "value", 0), 
                "kpi_name": getattr(r, "kpi_name", ""),
                "component_id": getattr(r, "component_id", "")
            }
            for r in records
        ]
        if not data:
            return "Error: No data available in context."
            
        df = pd.DataFrame(data)
        
        # Capture stdout
        old_stdout = sys.stdout
        new_stdout = io.StringIO()
        sys.stdout = new_stdout
        
        # Clean script
        clean_script = textwrap.dedent(script).strip()
        if clean_script.startswith("```python"):
            clean_script = clean_script[9:]
            if clean_script.endswith("```"):
                clean_script = clean_script[:-3]
        clean_script = clean_script.strip()
        
        # Execute in sandboxed namespace
        local_env = {"df": df, "pd": pd, "json": json}
        try:
            exec(clean_script, {}, local_env)
            output = new_stdout.getvalue()
            if not output:
                return "Script executed successfully but produced no output. Did you forget to use print()?"
            return output.strip()
        finally:
            sys.stdout = old_stdout
            
    except Exception as e:
        if 'old_stdout' in locals():
            sys.stdout = old_stdout
        return f"Error executing Pandas script: {str(e)}"

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

