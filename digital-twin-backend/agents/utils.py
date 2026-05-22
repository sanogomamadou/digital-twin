import re
import json
from typing import Optional, Dict, Any

COLORS = ["#6395ff", "#10d98d", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"]

def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """Extracts a JSON object from a text string containing markdown code blocks."""
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
            
    # Try finding any { ... } block if no markdown backticks
    fallback_match = re.search(r'(\{.*\})', text, re.DOTALL)
    if fallback_match:
        try:
            return json.loads(fallback_match.group(1))
        except json.JSONDecodeError:
            pass
            
    return None
