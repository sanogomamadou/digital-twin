"""
Layout Agent — LangGraph StateGraph that converts natural language prompts
into structured layout actions (add / move / remove / connect components).

Works with or without a real LLM (mock fallback included).
"""
from __future__ import annotations
import json
import re
import uuid
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, END

from models.schemas import (
    LayoutStateSchema, ComponentSchema, ConnectionSchema,
    LayoutAction, LayoutLLMResponse, LayoutPromptResponse
)
from services.llm_service import get_llm, has_real_llm, get_base_system_prompt
from langchain_core.messages import SystemMessage, HumanMessage

# ─── Default component palettes per domain ────────────────────────────────────
DOMAIN_DEFAULTS = {
    "factory": {
        "hydraulic_press":   {"color": "#ef4444", "gridSize": [2, 2]},
        "conveyor_belt":     {"color": "#f59e0b", "gridSize": [4, 1]},
        "cnc_machine":       {"color": "#10b981", "gridSize": [2, 2]},
        "assembly_station":  {"color": "#6395ff", "gridSize": [2, 2]},
        "quality_control":   {"color": "#8b5cf6", "gridSize": [2, 2]},
        "warehouse_rack":    {"color": "#06b6d4", "gridSize": [2, 3]},
    },
    "airport": {
        "terminal":       {"color": "#6395ff", "gridSize": [4, 3]},
        "gate":           {"color": "#10b981", "gridSize": [2, 2]},
        "runway":         {"color": "#374151", "gridSize": [6, 2]},
        "checkin_desk":   {"color": "#f59e0b", "gridSize": [3, 1]},
        "security_zone":  {"color": "#ef4444", "gridSize": [2, 2]},
        "baggage_claim":  {"color": "#8b5cf6", "gridSize": [3, 3]},
    },
    "warehouse": {
        "warehouse_rack":  {"color": "#06b6d4", "gridSize": [2, 3]},
        "picking_zone":    {"color": "#f59e0b", "gridSize": [3, 2]},
        "reception_dock":  {"color": "#10b981", "gridSize": [2, 2]},
        "shipping_dock":   {"color": "#6395ff", "gridSize": [2, 2]},
        "sorter":          {"color": "#8b5cf6", "gridSize": [2, 2]},
        "conveyor":        {"color": "#ef4444", "gridSize": [4, 1]},
    },
}




# ─── Helper: find next free cell ──────────────────────────────────────────────
def find_free_cell(components: list[dict], cols: int, rows: int, size: list[int]) -> tuple[int, int]:
    occupied = set()
    for c in components:
        cw, ch = c.get("gridSize", [2, 2])
        for r in range(c["row"], c["row"] + ch):
            for col in range(c["col"], c["col"] + cw):
                occupied.add((r, col))

    w, h = size
    for row in range(rows - h + 1):
        for col in range(cols - w + 1):
            cells = [(row + dr, col + dc) for dr in range(h) for dc in range(w)]
            if not any(cell in occupied for cell in cells):
                return row, col
    return 0, 0


def find_component_by_name(components: list[dict], name_hint: str) -> dict | None:
    name_hint = name_hint.lower()
    for c in components:
        if name_hint in c.get("name", "").lower() or name_hint in c.get("type", "").lower():
            return c
    return None


# ─── Mock fallback parser ─────────────────────────────────────────────────────
def mock_parse_prompt(prompt: str, layout: dict) -> dict:
    """Rule-based prompt parser for demo without LLM."""
    prompt_lower = prompt.lower()
    domain = layout.get("domain", "factory")
    palette = DOMAIN_DEFAULTS.get(domain, DOMAIN_DEFAULTS["factory"])
    components = layout.get("components", [])
    cols = layout.get("gridCols", 10)
    rows = layout.get("gridRows", 8)
    actions = []

    # ── ADD patterns ──────────────────────────────────────────────────────────
    add_patterns = [
        (r"add(?:er|ez|er)?\s+(\d+)?\s*([a-z_ ]+?)(?:\s+(?:near|pr[eè]s|à|a|next to|beside)\s+(.+?))?(?:\s*$|\.)",
         "add"),
    ]
    for pat, _ in add_patterns:
        for m in re.finditer(pat, prompt_lower):
            count = int(m.group(1)) if m.group(1) else 1
            type_hint = m.group(2).strip().replace(" ", "_")
            # Match to closest component type in palette
            matched_type = next(
                (t for t in palette if type_hint in t or t in type_hint), list(palette.keys())[0]
            )
            cfg = palette[matched_type]
            for i in range(count):
                row, col = find_free_cell(
                    components + [a for a in actions if a.get("action") == "add"],
                    cols, rows, cfg["gridSize"]
                )
                name_suffix = len([c for c in components if matched_type in c.get("type", "")]) + i + 1
                actions.append({
                    "action": "add",
                    "componentType": matched_type,
                    "componentName": f"{matched_type.replace('_', ' ').title()} {name_suffix}",
                    "row": row, "col": col,
                    "gridSize": cfg["gridSize"],
                    "color": cfg["color"],
                })

    # ── MOVE patterns ─────────────────────────────────────────────────────────
    for m in re.finditer(r"(?:move|d[eé]placer|bouger)\s+([a-z_ ]+?)\s+(?:to|vers|à|a|at)\s+(?:row\s*)?(\d+)[\s,]+(?:col(?:umn)?\s*)?(\d+)", prompt_lower):
        comp = find_component_by_name(components, m.group(1).strip())
        if comp:
            actions.append({
                "action": "move",
                "componentId": comp["id"],
                "row": int(m.group(2)) - 1,
                "col": int(m.group(3)) - 1,
            })

    # ── REMOVE patterns ───────────────────────────────────────────────────────
    for m in re.finditer(r"(?:remove|delete|supprimer|enlever)\s+([a-z_ 0-9]+?)(?:\s*$|\.)", prompt_lower):
        comp = find_component_by_name(components, m.group(1).strip())
        if comp:
            actions.append({"action": "remove", "componentId": comp["id"]})

    # ── CONNECT patterns ──────────────────────────────────────────────────────
    for m in re.finditer(r"(?:connect|lier|relier)\s+([a-z_ 0-9]+?)\s+(?:to|avec|and|à)\s+([a-z_ 0-9]+?)(?:\s*$|\.)", prompt_lower):
        src = find_component_by_name(components, m.group(1).strip())
        tgt = find_component_by_name(components, m.group(2).strip())
        if src and tgt:
            actions.append({
                "action": "connect",
                "sourceId": src["id"],
                "targetId": tgt["id"],
            })

    if not actions:
        # Generic: if only a component type is mentioned, add one
        for t in palette:
            if t.replace("_", " ") in prompt_lower or t in prompt_lower:
                cfg = palette[t]
                row, col = find_free_cell(components, cols, rows, cfg["gridSize"])
                name_suffix = len([c for c in components if t in c.get("type", "")]) + 1
                actions.append({
                    "action": "add",
                    "componentType": t,
                    "componentName": f"{t.replace('_', ' ').title()} {name_suffix}",
                    "row": row, "col": col,
                    "gridSize": cfg["gridSize"],
                    "color": cfg["color"],
                })
                break

    explanation = f"Processed prompt: '{prompt}'. Actions planned: {len(actions)}."
    if not actions:
        explanation = f"No specific action detected for: '{prompt}'. Try 'Add 2 conveyor belts' or 'Move Assembly Station to row 3, col 5'."

    return {"actions": actions, "explanation": explanation}


# ─── Helper: find closest free cell ───────────────────────────────────────────
def check_collision(components: list[dict], row: int, col: int, w: int, h: int) -> bool:
    for c in components:
        cw, ch = c.get("gridSize", [2, 2])
        # AABB collision
        if row < c["row"] + ch and row + h > c["row"] and col < c["col"] + cw and col + w > c["col"]:
            return True
    return False

def find_closest_free_cell(components: list[dict], cols: int, rows: int, size: list[int], target_row: int, target_col: int) -> tuple[int, int]:
    """Finds the closest non-overlapping cell to the target via concentric rectangles."""
    w, h = size
    
    # Boundary clamp target
    t_r = max(0, min(target_row, rows - h))
    t_c = max(0, min(target_col, cols - w))
    
    if not check_collision(components, t_r, t_c, w, h):
        return t_r, t_c
        
    # Search radius
    for radius in range(1, max(cols, rows)):
        for r in range(max(0, t_r - radius), min(rows - h + 1, t_r + radius + 1)):
            for c in range(max(0, t_c - radius), min(cols - w + 1, t_c + radius + 1)):
                # Only check perimeter of the expanded search box
                if abs(r - t_r) == radius or abs(c - t_c) == radius:
                    if not check_collision(components, r, c, w, h):
                        return r, c
                        
    return t_r, t_c # Fallback, let it overlap if grid is 100% full

# ─── LLM system prompt ────────────────────────────────────────────────────────
LAYOUT_SYSTEM_PROMPT = """You are an elite Digital Twin Spatial Architect AND a Senior 3D Technical Artist specializing in industrial facility design.
Given a natural language instruction and the current layout state (JSON), generate a JSON object with:
- "spatial_reasoning_scratchpad": MANDATORY step-by-step geometric calculations
- "actions": array of layout actions
- "explanation": a concise, operational explanation of what you did.

═══════════════════════════════════════════════════
ACTION FORMATS
═══════════════════════════════════════════════════

1. Add standard (from domain palette):
   {"action":"add", "componentType":"<type_from_availableTypes>", "componentName":"<name>", "row":<int>, "col":<int>}

2. Add custom (ANY new real-world object):
   {"action":"add", "componentType":"custom_<snake_case>", "componentName":"<name>", "row":<int>, "col":<int>,
    "isCustom":true, "gridSize":[w,h], "color":"<main_hex_color>", "icon":"<emoji>",
    "mesh3D":{"parts":[ ...array of 3D primitives... ]}}

3. Move:   {"action":"move", "componentId":"<id>", "row":<int>, "col":<int>}
4. Remove: {"action":"remove", "componentId":"<id>"}

═══════════════════════════════════════════════════════════════════════════
RULE #1: COORDINATE SYSTEM & OVERFLOW PREVENTION (CRITICAL — READ CAREFULLY)
═══════════════════════════════════════════════════════════════════════════
The renderer converts your fractional values to world-space like this:
  - Position:  world_pos = [pos_x * W, pos_y * H, pos_z * D]
  - Box size:  world_size = [size_x * W, size_y * H, size_z * D]
  - Cylinder:  world_radius = size[0] * min(W, D),  world_height = size[2] * H
  - Sphere:    world_radius = size[0] * min(W, D)

The component is CENTERED in its grid cell. So the valid fractional space is:
  - X axis:  from -0.5 to +0.5  (0 = center)
  - Z axis:  from -0.5 to +0.5  (0 = center)
  - Y axis:  from  0.0 to  1.0  (0 = ground, 1 = top)

### ABSOLUTE MAXIMUM SIZE VALUES (NEVER EXCEED THESE):
  - BOX size_x: MAX 0.95 (centered part filling the cell). If offset, even smaller.
  - BOX size_z: MAX 0.95
  - CYLINDER/SPHERE/CONE radius: MAX 0.45 (radius, not diameter!)
  - ANY size value ABOVE 1.0 is ALWAYS WRONG. The coordinate system uses fractions of 1.0.
  - The gridSize [2,2] does NOT mean size values should be 2.0! Size values are ALWAYS fractions between 0.0 and 1.0.

### OVERFLOW CHECK (do this for every part):
  For a centered box (pos_x=0): size_x must be <= 1.0 (but prefer 0.95)
  For an offset box (pos_x=0.2): size_x must be <= 0.6 (because 0.2 + 0.3 = 0.5)
  General rule: |pos_x| + size_x/2 must be <= 0.5

If this formula is violated, the part WILL visually overflow into neighboring grid cells!

### VERTICAL STACKING:
  - `pos_y` is the CENTER of the part, NOT the bottom.
  - A part with height 0.2 resting on the ground: pos_y = 0.2 / 2 = 0.1
  - A part stacked on top of a 0.2-high base: pos_y = 0.2 + (own_height / 2)

═══════════════════════════════════════════════════════════════════════
RULE #2: PROFESSIONAL 3D MODELING QUALITY (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════════
You are NOT building a toy. You are building an INDUSTRIAL-GRADE digital twin.

MINIMUM STANDARDS:
1. USE 8 TO 15 PRIMITIVES minimum per component. 5 parts = amateur. 10+ = professional.
2. LAYER your object like a real machine:
   - Heavy metal BASE (dark gray, high metalness)
   - Structural FRAME / BODY (main color, medium metalness)
   - Functional DETAILS: pipes, motors, control panels, sensors, valves, screens
   - ACCENTS: status lights with emissive glow, warning labels, bolts, vents
3. MATERIAL REALISM:
   - Brushed steel:  metalness=0.85, roughness=0.25, color="#9ca3af"
   - Cast iron base:  metalness=0.6, roughness=0.5, color="#374151"
   - Painted metal body: metalness=0.4, roughness=0.35, color=<user's color>
   - Control panel/screen: metalness=0.2, roughness=0.1, emissive="#1e40af", emissiveIntensity=0.5
   - Warning/status light: emissive=<color>, emissiveIntensity=1.5
   - Rubber/belt: metalness=0.05, roughness=0.9, color="#1a1a1a"
4. VISUAL DEPTH: Use slightly different shades for adjacent parts. Never use the same color+material on two adjacent surfaces.
5. FILL THE SPACE: The object must visually occupy at least 80% of its grid cell. Do NOT generate a tiny object in a big cell.

═══════════════════════════════════════════════════
RULE #3: CHAIN-OF-THOUGHT SCRATCHPAD (MANDATORY)
═══════════════════════════════════════════════════
You MUST fill `spatial_reasoning_scratchpad` with your geometric calculations BEFORE generating actions.
For each part, write:
  "Part N (<name>): geo=<type>, size=[...], pos=[...]. Check: |pos_x| + half_width = ... ≤ 0.5 ✓"

═══════════════════════════════════════════════════
EXAMPLE: Industrial CNC Lathe (12 parts, professional)
═══════════════════════════════════════════════════
"parts": [
  {"geo":"box","pos":[0,0.06,0],"size":[0.95,0.12,0.9],"color":"#1f2937","metalness":0.7,"roughness":0.4},
  {"geo":"box","pos":[0,0.22,0],"size":[0.9,0.2,0.85],"color":"#374151","metalness":0.6,"roughness":0.35},
  {"geo":"box","pos":[-0.15,0.5,0],"size":[0.55,0.4,0.75],"color":"#4b5563","metalness":0.5,"roughness":0.3},
  {"geo":"cylinder","pos":[0.2,0.5,0],"size":[0.15,0.15,0.35,24],"color":"#9ca3af","metalness":0.9,"roughness":0.15},
  {"geo":"cylinder","pos":[0.2,0.5,0],"size":[0.08,0.08,0.42,16],"color":"#d1d5db","metalness":0.95,"roughness":0.1},
  {"geo":"cone","pos":[0.2,0.72,0],"size":[0.06,0.12,12],"color":"#e5e7eb","metalness":0.9,"roughness":0.1},
  {"geo":"box","pos":[-0.38,0.5,0.05],"size":[0.1,0.25,0.3],"color":"#111827","metalness":0.2,"roughness":0.1,"emissive":"#1e3a5f","emissiveIntensity":0.4},
  {"geo":"box","pos":[-0.15,0.75,0],"size":[0.5,0.06,0.7],"color":"#6b7280","metalness":0.7,"roughness":0.25},
  {"geo":"cylinder","pos":[-0.3,0.78,0.25],"size":[0.03,0.03,0.08,8],"color":"#374151","metalness":0.8},
  {"geo":"cylinder","pos":[-0.3,0.78,-0.25],"size":[0.03,0.03,0.08,8],"color":"#374151","metalness":0.8},
  {"geo":"sphere","pos":[0.35,0.78,0.3],"size":[0.03],"color":"#22c55e","emissive":"#22c55e","emissiveIntensity":1.5},
  {"geo":"sphere","pos":[0.35,0.78,-0.3],"size":[0.03],"color":"#ef4444","emissive":"#ef4444","emissiveIntensity":1.0}
]

═══════════════════════════════════════════════════
EXAMPLE: Industrial Robotic Arm (10 parts, professional)
═══════════════════════════════════════════════════
"parts": [
  {"geo":"cylinder","pos":[0,0.04,0],"size":[0.4,0.42,0.08,32],"color":"#1f2937","metalness":0.8,"roughness":0.3},
  {"geo":"cylinder","pos":[0,0.12,0],"size":[0.25,0.25,0.08,24],"color":"#374151","metalness":0.7,"roughness":0.25},
  {"geo":"box","pos":[0,0.32,0],"size":[0.12,0.32,0.1],"color":"#f59e0b","metalness":0.45,"roughness":0.35},
  {"geo":"sphere","pos":[0,0.5,0],"size":[0.06],"color":"#9ca3af","metalness":0.9,"roughness":0.15},
  {"geo":"box","pos":[0.08,0.65,0],"size":[0.08,0.25,0.08],"rot":[0,0,-25],"color":"#f59e0b","metalness":0.45,"roughness":0.35},
  {"geo":"sphere","pos":[0.15,0.77,0],"size":[0.04],"color":"#6b7280","metalness":0.85,"roughness":0.2},
  {"geo":"box","pos":[0.22,0.85,0],"size":[0.06,0.15,0.06],"rot":[0,0,-10],"color":"#d97706","metalness":0.5,"roughness":0.3},
  {"geo":"cylinder","pos":[0.28,0.9,0],"size":[0.02,0.02,0.08,12],"rot":[0,0,-90],"color":"#374151","metalness":0.95,"roughness":0.1},
  {"geo":"sphere","pos":[0.32,0.9,0],"size":[0.025],"color":"#60a5fa","emissive":"#3b82f6","emissiveIntensity":2.0},
  {"geo":"box","pos":[-0.25,0.12,0.2],"size":[0.12,0.16,0.12],"color":"#111827","metalness":0.2,"roughness":0.1,"emissive":"#0f172a","emissiveIntensity":0.3}
]

═══════════════════════════════════════════════════
SPATIAL RULES
═══════════════════════════════════════════════════
- Grid: row=0, col=0 (top-left) to row=(gridRows-1), col=(gridCols-1).
- "Top right" -> row=0, col=max.  "Next to X" -> col = X.col + X.width.
- To reposition EXISTING items, use "move" with the exact componentId.

Return ONLY valid JSON.
"""

# ─── Apply actions to state ───────────────────────────────────────────────────
def apply_actions(state_dict: dict, actions: list[dict]) -> dict:
    """Apply a list of actions to the layout state dict and return updated state."""
    components = [c.copy() for c in state_dict.get("components", [])]
    connections = [c.copy() for c in state_dict.get("connections", [])]
    cols = state_dict.get("gridCols", 10)
    rows = state_dict.get("gridRows", 8)

    for action in actions:
        act = action.get("action")

        if act == "add":
            comp_type = action.get("componentType", "unknown")
            is_custom = action.get("isCustom", False)
            
            # Default to palette size if not custom
            g_size = action.get("gridSize", [2, 2])
            clr = action.get("color", "#6395ff")
            if not is_custom:
                domain = state_dict.get("domain", "factory")
                palette = DOMAIN_DEFAULTS.get(domain, DOMAIN_DEFAULTS["factory"])
                if comp_type in palette:
                    g_size = palette[comp_type]["gridSize"]
                    clr = action.get("color", palette[comp_type]["color"]) # Allow llm to override color
            
            # Smart positioning: Anti-collision
            target_row = action.get("row", 0)
            target_col = action.get("col", 0)
            safe_row, safe_col = find_closest_free_cell(components, cols, rows, g_size, target_row, target_col)
            
            new_comp = {
                "id": f"{comp_type}_{uuid.uuid4().hex[:6]}",
                "name": action.get("componentName", comp_type.replace("_", " ").title()),
                "type": comp_type,
                "row": safe_row,
                "col": safe_col,
                "gridSize": g_size,
                "color": clr,
                "kpiIds": [],
                "isCustom": is_custom,
            }
            if is_custom:
                new_comp["icon"] = action.get("icon", "✨")
                new_comp["mesh3D"] = action.get("mesh3D", {"shape": "box"})
                
            components.append(new_comp)

        elif act == "move":
            cid = action.get("componentId")
            for c in components:
                if c["id"] == cid:
                    current_g_size = c.get("gridSize", [2, 2])
                    
                    # Temporarily remove self from collision check
                    temp_components = [tc for tc in components if tc["id"] != cid]
                    
                    target_row = action.get("row", c["row"])
                    target_col = action.get("col", c["col"])
                    safe_row, safe_col = find_closest_free_cell(temp_components, cols, rows, current_g_size, target_row, target_col)
                    
                    c["row"] = safe_row
                    c["col"] = safe_col
                    break

        elif act == "remove":
            cid = action.get("componentId")
            components = [c for c in components if c["id"] != cid]
            connections = [cn for cn in connections
                           if cn.get("sourceId") != cid and cn.get("targetId") != cid]

        elif act == "connect":
            src_id = action.get("sourceId")
            tgt_id = action.get("targetId")
            if src_id and tgt_id:
                existing = any(
                    cn.get("sourceId") == src_id and cn.get("targetId") == tgt_id
                    for cn in connections
                )
                if not existing:
                    connections.append({
                        "id": f"conn_{uuid.uuid4().hex[:6]}",
                        "sourceId": src_id,
                        "targetId": tgt_id,
                        "label": action.get("label", ""),
                        "flowStatus": "green",
                    })

        elif act == "resize":
            cid = action.get("componentId")
            for c in components:
                if c["id"] == cid:
                    c["gridSize"] = action.get("gridSize", c["gridSize"])
                    break

    return {**state_dict, "components": components, "connections": connections}


class LayoutAgentState(TypedDict):
    iterations: int
    feedback: str
    response: LayoutLLMResponse | None
    error: str | None

# ─── Main entry point ─────────────────────────────────────────────────────────
async def run_layout_agent(prompt: str, current_state: LayoutStateSchema) -> LayoutPromptResponse:
    state_dict = current_state.model_dump()
    scratchpad = ""

    if not has_real_llm():
        result = mock_parse_prompt(prompt, state_dict)
        actions_raw = result.get("actions", [])
        explanation = result.get("explanation", "Actions applied (mock).")
        scratchpad = "Mock reasoning."
    else:
        llm = get_llm()
        structured_llm = llm.with_structured_output(LayoutLLMResponse)
        
        context = json.dumps({
            "domain": state_dict["domain"],
            "gridCols": state_dict["gridCols"],
            "gridRows": state_dict["gridRows"],
            "components": [{"id": c["id"], "name": c["name"], "type": c["type"], "row": c["row"], "col": c["col"], "gridSize": c["gridSize"]} for c in state_dict["components"]],
            "connections": [{"id": c["id"], "sourceId": c["sourceId"], "targetId": c["targetId"]} for c in state_dict["connections"]],
            "availableTypes": list(DOMAIN_DEFAULTS.get(state_dict["domain"], DOMAIN_DEFAULTS["factory"]).keys()),
        }, indent=2)
        

        def generator_node(state: LayoutAgentState):
            base_prompt = get_base_system_prompt()
            full_system_prompt = f"{base_prompt}\n\n{LAYOUT_SYSTEM_PROMPT}" if base_prompt else LAYOUT_SYSTEM_PROMPT
            
            msgs = [
                SystemMessage(content=full_system_prompt),
                HumanMessage(content=f"Current layout:\n{context}\n\nInstruction: {prompt}")
            ]
            if state.get("feedback"):
                msgs.append(HumanMessage(content=f"CRITIQUE PREVIOUS ATTEMPT:\n{state['feedback']}\n\nPlease fix the issues and generate a valid layout."))
            try:
                res = structured_llm.invoke(msgs)
                return {"response": res, "iterations": state.get("iterations", 0) + 1, "error": None}
            except Exception as e:
                return {"error": str(e), "iterations": state.get("iterations", 0) + 1}
                
        def critic_node(state: LayoutAgentState):
            res = state.get("response")
            if not res:
                return {"feedback": "No response generated."}
            
            feedback_issues = []
            for i, action in enumerate(res.actions):
                mesh = action.mesh3D
                if mesh and getattr(mesh, "parts", None):
                    for j, part in enumerate(mesh.parts):
                        size = part.size if hasattr(part, "size") else []
                        pos = part.pos if hasattr(part, "pos") else [0,0,0]
                        for dim, p, s in zip(["x", "y", "z"], pos, size):
                            if abs(p) + s / 2.0 > 0.5:
                                feedback_issues.append(f"Action {i} (Part {j}): Overflows grid cell on axis {dim}. |{p}| + {s}/2 = {abs(p) + s/2.0} > 0.5.")
            if feedback_issues:
                return {"feedback": "\n".join(feedback_issues)}
            return {"feedback": "OK"}
            
        def should_loop(state: LayoutAgentState):
            if state.get("error"):
                return END
            if state.get("feedback") == "OK":
                return END
            if state.get("iterations", 0) >= 3:
                return END
            return "generator"
            
        workflow = StateGraph(LayoutAgentState)
        workflow.add_node("generator", generator_node)
        workflow.add_node("critic", critic_node)
        workflow.set_entry_point("generator")
        workflow.add_edge("generator", "critic")
        workflow.add_conditional_edges("critic", should_loop, {"generator": "generator", END: END})
        
        app = workflow.compile()
        try:
            final_state = await app.ainvoke({"iterations": 0, "feedback": "", "response": None, "error": None})
            
            if final_state.get("error"):
                raise ValueError(final_state["error"])
                
            res = final_state.get("response")
            if res:
                actions_raw = [a.model_dump(exclude_unset=True) for a in res.actions]
                explanation = res.explanation
                scratchpad = res.spatial_reasoning_scratchpad
                if final_state.get("feedback") != "OK":
                    scratchpad += "\n[Critic]: Max iterations reached. Applied hard clamps."
            else:
                raise ValueError("Empty response")
                
        except Exception as e:
            error_str = str(e)
            print(f"Error in layout agent reflection loop: {error_str}")
            if "429" in error_str or "rate_limit" in error_str:
                explanation = f"Groq rate limit reached. Please wait a moment and try again."
                actions_raw = []
                scratchpad = f"Rate limit error: {error_str[:200]}"
            else:
                result = mock_parse_prompt(prompt, state_dict)
                actions_raw = result.get("actions", [])
                explanation = result.get("explanation", "Actions applied (fallback).")
                scratchpad = f"Error occurred: {error_str[:200]}"

    # ── Safety net: clamp oversized mesh3D parts ──
    for action in actions_raw:
        mesh = action.get("mesh3D")
        if mesh and isinstance(mesh, dict):
            parts = mesh.get("parts", [])
            for part in parts:
                geo = part.get("geo", "box")
                size = part.get("size", [])
                pos = part.get("pos", [0, 0, 0])
                if geo == "box" and len(size) >= 1:
                    # Clamp box width/depth to stay within bounds
                    max_sx = 2 * (0.5 - abs(pos[0])) if len(pos) > 0 else 1.0
                    max_sz = 2 * (0.5 - abs(pos[2])) if len(pos) > 2 else 1.0
                    size[0] = min(size[0], max(max_sx, 0.1))
                    if len(size) >= 3:
                        size[2] = min(size[2], max(max_sz, 0.1))
                elif geo in ("cylinder", "sphere", "cone") and len(size) >= 1:
                    max_r = 0.5 - max(abs(pos[0]) if len(pos) > 0 else 0, abs(pos[2]) if len(pos) > 2 else 0)
                    size[0] = min(size[0], max(max_r, 0.05))
                    if geo == "cylinder" and len(size) >= 2:
                        size[1] = min(size[1], max(max_r, 0.05))

    new_state_dict = apply_actions(state_dict, actions_raw)

    actions = [LayoutAction(**a) for a in actions_raw]
    new_state = LayoutStateSchema(**new_state_dict)

    return LayoutPromptResponse(
        spatial_reasoning_scratchpad=scratchpad,
        actions=actions, 
        explanation=explanation, 
        newState=new_state
    )


