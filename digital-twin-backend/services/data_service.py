"""
Data Service — handles CSV/Excel parsing, KPI aggregations,
time-range filtering, and statistics via Pandas.
"""
from __future__ import annotations
import io
import re
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd


TIME_RANGES = {
    "1h":  timedelta(hours=1),
    "6h":  timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d":  timedelta(days=7),
    "30d": timedelta(days=30),
}


def parse_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Parse CSV or Excel file into a DataFrame."""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in ("xlsx", "xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        # Try common separators
        for sep in (",", ";", "\t"):
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), sep=sep)
                if len(df.columns) > 1:
                    break
            except Exception:
                continue
    df.columns = [str(c).strip() for c in df.columns]
    return df


def detect_columns(df: pd.DataFrame) -> dict:
    """Auto-detect timestamp, value, and unit columns."""
    cols = [c.lower() for c in df.columns]
    timestamp_col = next((df.columns[i] for i, c in enumerate(cols)
                          if any(k in c for k in ("time", "date", "ts", "datetime", "timestamp"))), None)
    value_col = next((df.columns[i] for i, c in enumerate(cols)
                      if any(k in c for k in ("value", "val", "measure", "reading", "data"))), None)
    unit_col = next((df.columns[i] for i, c in enumerate(cols)
                     if any(k in c for k in ("unit", "uom", "measure_unit"))), None)
    return {"timestamp": timestamp_col, "value": value_col, "unit": unit_col}


def df_to_kpi_records(df: pd.DataFrame, value_col: str, timestamp_col: Optional[str] = None, unit_col: Optional[str] = None) -> list[dict]:
    """Convert DataFrame rows to KPI record dicts."""
    records = []
    for _, row in df.iterrows():
        ts = datetime.utcnow()
        if timestamp_col and timestamp_col in row.index:
            try:
                ts = pd.to_datetime(row[timestamp_col])
                if hasattr(ts, 'to_pydatetime'):
                    ts = ts.to_pydatetime()
            except Exception:
                pass

        try:
            val = float(row[value_col])
        except (ValueError, TypeError):
            continue

        unit = ""
        if unit_col and unit_col in row.index:
            unit = str(row[unit_col])

        records.append({"value": val, "unit": unit, "timestamp": ts, "source": "csv"})
    return records


def filter_by_time_range(records: list[dict], time_range: str = "24h") -> list[dict]:
    """Filter records to only include those within the time range."""
    delta = TIME_RANGES.get(time_range, timedelta(hours=24))
    cutoff = datetime.utcnow() - delta
    filtered = []
    for r in records:
        ts = r.get("timestamp")
        if ts is None:
            filtered.append(r)
            continue
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except Exception:
                filtered.append(r)
                continue
        if hasattr(ts, 'replace'):
            ts = ts.replace(tzinfo=None)
        if ts >= cutoff:
            filtered.append(r)
    return filtered


def compute_stats(records: list[dict], value_key: str = "value") -> dict:
    """Compute basic statistics on a list of value records."""
    vals = [r[value_key] for r in records if value_key in r and r[value_key] is not None]
    if not vals:
        return {}
    s = pd.Series(vals, dtype=float)
    return {
        "count": len(vals),
        "mean": round(s.mean(), 2),
        "median": round(s.median(), 2),
        "std": round(s.std(), 2),
        "min": round(s.min(), 2),
        "max": round(s.max(), 2),
        "p95": round(s.quantile(0.95), 2),
    }


def records_to_chart_data(records: list, timestamp_field="timestamp", value_field="value", label_field="kpi_name", fmt="%H:%M") -> list[dict]:
    """Convert DB KPI records to chart-ready dicts keyed by KPI name."""
    rows: dict[str, dict] = {}
    for r in records:
        ts = getattr(r, timestamp_field, None)
        val = getattr(r, value_field, None)
        name = getattr(r, label_field, "value")
        if ts is None or val is None:
            continue
        key = ts.strftime(fmt) if hasattr(ts, "strftime") else str(ts)
        if key not in rows:
            rows[key] = {"timestamp": key}
        rows[key][name] = round(float(val), 2)
    return list(rows.values())


def infer_chart_type(question: str, data: list[dict]) -> str:
    """Rule-based chart type inference from question keywords."""
    q = question.lower()
    if any(w in q for w in ("trend", "over time", "evolution", "historique", "history")):
        return "AreaChart"
    if any(w in q for w in ("compare", "comparison", "difference", "vs", "versus", "entre")):
        return "BarChart"
    if any(w in q for w in ("distribution", "proportion", "percentage", "repartition", "répartition", "pie")):
        return "PieChart"
    if any(w in q for w in ("correlation", "scatter", "relation", "between")):
        return "ScatterChart"
    if any(w in q for w in ("radar", "global", "overview")):
        return "RadarChart"
    if any(w in q for w in ("anomaly", "anomalie", "outlier", "spike", "pic", "alerte")):
        return "LineChart"
    if any(w in q for w in ("stack", "composition", "cumul")):
        return "BarChart"
    # Default: if time-series data → AreaChart, else BarChart
    if data and "timestamp" in data[0]:
        return "AreaChart"
    return "BarChart"
