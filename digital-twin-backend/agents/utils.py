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
            
    # Brace-matching scan from the first '{' to its matching '}' — handles
    # surrounding prose and nested objects better than a greedy regex.
    start = text.find('{')
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break

    return None
