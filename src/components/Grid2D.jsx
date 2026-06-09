import { useState, useRef, useEffect } from 'react';
import { Trash2, RotateCcw, Monitor, DoorClosed, Plane, Briefcase, Lock, BaggageClaim, Settings, Package, PenTool, Search, Box, Truck, Inbox, ArrowUpSquare } from 'lucide-react';
import useTwinStore from '../store/useTwinStore';

const CELL_PX = 40;
const STATUS_COLORS = { green: '#10d98d', orange: '#f59e0b', red: '#ef4444' };

export default function Grid2D() {
    const { currentStep, components, connections, kpis, gridCols, gridRows, selectedComponentId, hoveredComponentId, selectComponent, hoverComponent, moveComponent, removeComponent, addConnection, rotateComponent, resizeComponent } = useTwinStore();
    const cols = gridCols || 10;
    const rows = gridRows || 8;
    const isConnectionStep = currentStep === 3;
    const [dragging, setDragging] = useState(null); // { id, offsetCol, offsetRow }
    const [ghostPos, setGhostPos] = useState(null);  // { col, row }
    const [linkingFrom, setLinkingFrom] = useState(null);
    const [mousePos, setMousePos] = useState(null);
    const gridRef = useRef(null);

    const getCenter = (comp) => {
        const [cw, ch] = comp.gridSize;
        const w = CELL_PX * cw + (cw - 1);
        const h = CELL_PX * ch + (ch - 1);
        const left = comp.col * CELL_PX + comp.col;
        const top = comp.row * CELL_PX + comp.row;
        return { x: left + w / 2, y: top + h / 2 };
    };

    const handleMouseMove = (e) => {
        if (!linkingFrom || !gridRef.current) return;
        const rect = gridRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    // Build occupied map
    const cellMap = {};
    components.forEach(comp => {
        const [cw, ch] = comp.gridSize;
        for (let r = comp.row; r < comp.row + ch; r++)
            for (let c = comp.col; c < comp.col + cw; c++)
                cellMap[`${r}-${c}`] = comp;
    });

    const getKpi = comp => {
        if (!comp?.kpiIds || comp.kpiIds.length === 0) return null;
        const compKpis = kpis.filter(k => comp.kpiIds.includes(k.id));
        if (compKpis.length === 0) return null;
        
        const priority = { red: 3, orange: 2, green: 1 };
        return compKpis.reduce((mostCritical, current) => {
            const p1 = priority[mostCritical.status] || 0;
            const p2 = priority[current.status] || 0;
            return p2 > p1 ? current : mostCritical;
        }, compKpis[0]);
    };

    const handleMouseDown = (e, comp) => {
        e.preventDefault();
        if (isConnectionStep) {
            setLinkingFrom(comp.id);
        } else {
            setDragging({ id: comp.id, gridSize: comp.gridSize });
        }
        selectComponent(comp.id);
    };

    const handleCellEnter = (col, row) => {
        if (!dragging) return;
        setGhostPos({ col, row });
    };

    const handleMouseUp = () => {
        if (dragging && ghostPos) {
            moveComponent(dragging.id, ghostPos.col, ghostPos.row);
        }
        setDragging(null);
        setGhostPos(null);
        setLinkingFrom(null);
        setMousePos(null);
    };

    // Check if ghost fits
    const ghostOk = () => {
        if (!dragging || !ghostPos) return false;
        const comp = components.find(c => c.id === dragging.id);
        if (!comp) return false;
        const [w, h] = comp.gridSize;
        const { col, row } = ghostPos;
        if (col < 0 || row < 0 || col + w > cols || row + h > rows) return false;
        for (let r = row; r < row + h; r++)
            for (let c = col; c < col + w; c++) {
                const occupant = cellMap[`${r}-${c}`];
                if (occupant && occupant.id !== dragging.id) return false;
            }
        return true;
    };

    return (
        <div style={{ position: 'relative', overflow: 'auto', flex: 1, userSelect: 'none' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            {/* Column headers */}
            <div style={{ display: 'flex', paddingLeft: '24px', marginBottom: '2px', position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 5 }}>
                {Array.from({ length: cols }).map((_, c) => (
                    <div key={c} style={{ width: CELL_PX, textAlign: 'center', fontSize: '8px', color: 'var(--text-2)', flexShrink: 0 }}>{c + 1}</div>
                ))}
            </div>

            <div style={{ display: 'flex', padding: '4px 8px' }}>
                {/* Row numbers */}
                <div style={{ display: 'flex', flexDirection: 'column', marginRight: '4px' }}>
                    {Array.from({ length: rows }).map((_, r) => (
                        <div key={r} style={{ height: CELL_PX, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--text-2)', width: '16px', flexShrink: 0 }}>{r + 1}</div>
                    ))}
                </div>

                {/* Grid */}
                <div
                    ref={gridRef}
                    style={{
                        position: 'relative',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`,
                        gridTemplateRows: `repeat(${rows}, ${CELL_PX}px)`,
                        gap: '1px',
                        cursor: dragging ? 'grabbing' : isConnectionStep && linkingFrom ? 'crosshair' : 'default',
                    }}
                    onMouseMove={isConnectionStep && linkingFrom ? handleMouseMove : undefined}
                >
                    {isConnectionStep && (
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20, overflow: 'visible' }}>
                            {connections.map(conn => {
                                const src = components.find(c => c.id === conn.sourceId);
                                const tgt = components.find(c => c.id === conn.targetId);
                                if (!src || !tgt) return null;
                                const p1 = getCenter(src);
                                const p2 = getCenter(tgt);
                                const color = STATUS_COLORS[conn.flowStatus] || '#10d98d';
                                return <line key={conn.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="3" strokeLinecap="round" opacity={0.6} />
                            })}
                            {linkingFrom && mousePos && (() => {
                                const src = components.find(c => c.id === linkingFrom);
                                if (!src) return null;
                                const p1 = getCenter(src);
                                return <line x1={p1.x} y1={p1.y} x2={mousePos.x} y2={mousePos.y} stroke="#4865f2" strokeWidth="2" strokeDasharray="4" strokeLinecap="round" />
                            })()}
                        </svg>
                    )}
                    {Array.from({ length: rows }).map((_, row) =>
                        Array.from({ length: cols }).map((_, col) => {
                            const comp = cellMap[`${row}-${col}`];
                            const isOrigin = comp && comp.row === row && comp.col === col;
                            const [cw, ch] = comp?.gridSize || [1, 1];
                            const kpi = comp ? getKpi(comp) : null;
                            const isSelected = comp && selectedComponentId === comp.id;
                            const isHovered = comp && hoveredComponentId === comp.id;
                            const isDraggingThis = dragging?.id === comp?.id;
                            const statusColor = kpi ? STATUS_COLORS[kpi.status] : null;

                            // Ghost display
                            const isGhost = dragging && ghostPos && ghostPos.col === col && ghostPos.row === row;
                            const ghostFits = ghostOk();

                            if (comp && !isOrigin) return null;

                            const w = CELL_PX * cw + (cw - 1);
                            const h = CELL_PX * ch + (ch - 1);

                            return (
                                <div
                                    key={`${row}-${col}`}
                                    style={{
                                        gridColumn: comp ? `span ${cw}` : undefined,
                                        gridRow: comp ? `span ${ch}` : undefined,
                                        width: comp ? `${w}px` : `${CELL_PX}px`,
                                        height: comp ? `${h}px` : `${CELL_PX}px`,
                                        background: comp
                                            ? isDraggingThis
                                                ? 'rgba(72,101,242,0.08)'
                                                : isSelected
                                                    ? `rgba(72,101,242,0.18)`
                                                    : isHovered
                                                        ? `rgba(72,101,242,0.1)`
                                                        : `rgba(${hexRgb(comp.color)},0.12)`
                                            : isGhost
                                                ? ghostFits ? 'rgba(72,101,242,0.15)' : 'rgba(239,68,68,0.15)'
                                                : 'rgba(72,101,242,0.03)',
                                        border: comp
                                            ? isDraggingThis
                                                ? '1.5px dashed #4865f2'
                                                : isSelected
                                                    ? '1.5px solid #4865f2'
                                                    : isHovered
                                                        ? `1.5px solid rgba(${hexRgb(comp.color)},0.8)`
                                                        : `1px solid rgba(${hexRgb(comp.color)},0.35)`
                                            : isGhost
                                                ? ghostFits ? '1.5px dashed #4865f2' : '1.5px dashed #ef4444'
                                                : '1px dashed rgba(72,101,242,0.25)',
                                        borderRadius: comp ? '5px' : '2px',
                                        cursor: comp ? (dragging ? 'grabbing' : isConnectionStep ? 'crosshair' : 'grab') : isGhost ? 'crosshair' : 'default',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: isSelected && !isDraggingThis ? 'visible' : 'hidden',
                                        position: 'relative',
                                        transition: isDraggingThis ? 'none' : 'all 0.15s ease',
                                        opacity: isDraggingThis ? 0.4 : 1,
                                        boxShadow: isSelected && !isDraggingThis ? '0 0 10px rgba(72,101,242,0.2)' : 'none',
                                        zIndex: isSelected && !isDraggingThis ? 10 : 1,
                                    }}
                                    onMouseDown={comp ? (e) => handleMouseDown(e, comp) : undefined}
                                    onMouseUp={(e) => {
                                        if (isConnectionStep && linkingFrom && comp && linkingFrom !== comp.id) {
                                            e.stopPropagation();
                                            addConnection(linkingFrom, comp.id);
                                            setLinkingFrom(null);
                                            setMousePos(null);
                                        }
                                    }}
                                    onMouseEnter={() => {
                                        if (comp) hoverComponent(comp.id);
                                        handleCellEnter(col, row);
                                    }}
                                    onMouseLeave={() => hoverComponent(null)}
                                    onClick={() => !dragging && comp && selectComponent(comp.id)}
                                >
                                    {comp && (
                                        <>
                                            {/* KPI status strip */}
                                            {statusColor && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: statusColor, opacity: 0.9 }} />
                                            )}
                                            {/* Component type icon */}
                                            <div style={{ transform: `rotate(${comp.rotation || 0}deg)`, transition: 'transform 0.2s', fontSize: CELL_PX > 36 ? '14px' : '10px', lineHeight: 1, marginBottom: '2px' }}>
                                                {getTypeIcon(comp.type)}
                                            </div>
                                            {/* Name */}
                                            <span style={{ fontSize: '8px', fontWeight: 600, color: isSelected ? '#4865f2' : '#94a3c8', textAlign: 'center', lineHeight: 1.1, padding: '0 2px' }}>
                                                {comp.name.replace(/\s+\d+$/, '')}
                                            </span>
                                            {/* KPI value */}
                                            {kpi && (
                                                <span style={{ fontSize: '8px', fontWeight: 700, color: statusColor, marginTop: '1px' }}>
                                                    {typeof kpi.value === 'number' ? kpi.value.toFixed(0) : kpi.value}{kpi.unit}
                                                </span>
                                            )}
                                            {/* KPI Dynamic Interaction Layer */}
                                            {kpi && kpi.status !== 'green' && (
                                                <div style={{ 
                                                    position: 'absolute', inset: 0, borderRadius: '5px', pointerEvents: 'none',
                                                    ...(kpi.interaction === 'pulse' ? { background: `rgba(${hexRgb(statusColor)},0.15)`, animation: 'pulse-bg 1s ease-in-out infinite' } : {}),
                                                    ...(kpi.interaction === 'transition' ? { background: `rgba(${hexRgb(statusColor)},0.25)` } : {}),
                                                    ...(kpi.interaction === 'glow' ? { boxShadow: `inset 0 0 12px ${statusColor}, 0 0 8px ${statusColor}`, border: `2px solid ${statusColor}` } : {})
                                                }} />
                                            )}
                                            {/* Rotate button */}
                                            {isSelected && !isDraggingThis && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        rotateComponent(comp.id);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        left: '4px',
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(72,101,242,0.15)',
                                                        border: '1px solid rgba(72,101,242,0.3)',
                                                        color: '#4865f2',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        zIndex: 10,
                                                        padding: 0,
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(72,101,242,0.25)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(72,101,242,0.15)'; }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    title="Rotate Component"
                                                >
                                                    <RotateCcw size={10} />
                                                </button>
                                            )}
                                            {/* Delete button */}
                                            {isSelected && !isDraggingThis && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeComponent(comp.id);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        width: '18px',
                                                        height: '18px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(239,68,68,0.15)',
                                                        border: '1px solid rgba(239,68,68,0.3)',
                                                        color: '#ef4444',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        zIndex: 10,
                                                        padding: 0,
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    title="Delete Component"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                            {/* Resize controls */}
                                            {isSelected && !isDraggingThis && (
                                                <>
                                                    {/* Width controls (Right) */}
                                                    <div style={{ position: 'absolute', right: '-24px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100 }} onMouseDown={e => e.stopPropagation()}>
                                                        <button onClick={(e) => { e.stopPropagation(); resizeComponent(comp.id, cw + 1, ch); }} style={{ width: '20px', height: '20px', fontSize: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Increase Width">+</button>
                                                        <button onClick={(e) => { e.stopPropagation(); resizeComponent(comp.id, cw - 1, ch); }} style={{ width: '20px', height: '20px', fontSize: '12px', background: 'var(--bg-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Decrease Width">-</button>
                                                    </div>
                                                    {/* Height controls (Bottom) */}
                                                    <div style={{ position: 'absolute', bottom: '-24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', zIndex: 100 }} onMouseDown={e => e.stopPropagation()}>
                                                        <button onClick={(e) => { e.stopPropagation(); resizeComponent(comp.id, cw, ch + 1); }} style={{ width: '20px', height: '20px', fontSize: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Increase Height">+</button>
                                                        <button onClick={(e) => { e.stopPropagation(); resizeComponent(comp.id, cw, ch - 1); }} style={{ width: '20px', height: '20px', fontSize: '12px', background: 'var(--bg-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Decrease Height">-</button>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {/* Ghost cell */}
                                    {!comp && isGhost && (
                                        <div style={{ width: '60%', height: '60%', borderRadius: '3px', background: ghostFits ? 'rgba(72,101,242,0.3)' : 'rgba(239,68,68,0.3)' }} />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <style>{`
        @keyframes pulse-bg { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>
        </div>
    );
}

function getTypeIcon(type) {
    const size = 14;
    switch (type) {
        case 'terminal': return <Monitor size={size} />;
        case 'gate': return <DoorClosed size={size} />;
        case 'runway': return <Plane size={size} />;
        case 'checkin_desk': return <Briefcase size={size} />;
        case 'security_zone': return <Lock size={size} />;
        case 'baggage_claim': return <BaggageClaim size={size} />;
        case 'hydraulic_press': return <Settings size={size} />;
        case 'conveyor_belt': return <Package size={size} />;
        case 'cnc_machine': return <Settings size={size} />;
        case 'assembly_station': return <PenTool size={size} />;
        case 'quality_control': return <Search size={size} />;
        case 'warehouse_rack':
        case 'storage_rack': return <Box size={size} />;
        case 'picking_zone': return <Truck size={size} />;
        case 'reception_dock': return <Inbox size={size} />;
        case 'shipping_dock': return <ArrowUpSquare size={size} />;
        case 'conveyor': return <Package size={size} />;
        case 'sorter': return <Settings size={size} />;
        default: return <Box size={size} />;
    }
}

function hexRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : '99,149,255';
}
