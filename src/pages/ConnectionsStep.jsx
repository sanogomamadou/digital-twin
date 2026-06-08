import { useState, Suspense } from 'react';
import useTwinStore from '../store/useTwinStore';
import Scene3D from '../components/Scene3D';
import Grid2D from '../components/Grid2D';
import { ChevronRight, ArrowLeft, Link2, Zap, Wifi, Trash2, Settings, Plane, Package, MousePointerClick } from 'lucide-react';

const VIEWS = ['2D Grid', '3D Preview'];

const STATUS_COLORS = { green: '#10d98d', orange: '#f59e0b', red: '#ef4444' };
const FLOW_LABELS = { green: 'Fluid', orange: 'Congested', red: 'Bottleneck' };

export default function ConnectionsStep() {
    const { setStep, components, connections, selectedDomain, removeConnection } = useTwinStore();
    const [hoveredConn, setHoveredConn] = useState(null);
    const [view, setView] = useState('2D Grid');

    const DOMAIN_LINK_TYPES = {
        factory: { label: 'Production Flow', desc: 'Parts pass from machine A to B', icon: <Settings size={14} /> },
        airport: { label: 'Passenger Flow', desc: 'Terminal → Gate → Runway', icon: <Plane size={14} /> },
        warehouse: { label: 'Picking Route', desc: 'Reception → Rack → Shipping', icon: <Package size={14} /> },
    };
    const linkType = DOMAIN_LINK_TYPES[selectedDomain] || DOMAIN_LINK_TYPES.factory;

    const getComp = (id) => components.find(c => c.id === id);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Split */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>

                {/* Left — connection panel */}
                <div style={{
                    borderRight: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    background: 'var(--bg-1)',
                }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Link2 size={15} color="var(--accent)" />
                            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>Connections</span>
                        </div>
                        <div style={{
                            padding: '12px', borderRadius: '8px',
                            background: 'rgba(72,101,242,0.06)', border: '1px solid rgba(72,101,242,0.15)',
                        }}>
                            <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px' }}>
                                {linkType.icon} {linkType.label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-1)' }}>{linkType.desc}</div>
                        </div>
                    </div>

                    {/* Connection list */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                        {connections.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '13px', padding: '40px 20px' }}>
                                No connections yet.<br />They will be auto-detected from your layout.
                            </div>
                        ) : (
                            connections.map((conn, i) => {
                                const src = getComp(conn.sourceId);
                                const tgt = getComp(conn.targetId);
                                const color = STATUS_COLORS[conn.flowStatus];
                                return (
                                    <div
                                        key={conn.id}
                                        onMouseEnter={() => setHoveredConn(conn.id)}
                                        onMouseLeave={() => setHoveredConn(null)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '10px',
                                            marginBottom: '8px',
                                            border: hoveredConn === conn.id ? `1px solid ${color}55` : '1px solid var(--border)',
                                            background: hoveredConn === conn.id ? `rgba(${hexToRgb(color)},0.06)` : 'var(--bg-3)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 600 }}>LINK {i + 1}</span>
                                            <span className={`badge badge-${conn.flowStatus}`} style={{ marginLeft: 'auto' }}>
                                                <span className={`dot dot-${conn.flowStatus}`} />
                                                {FLOW_LABELS[conn.flowStatus]}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeConnection(conn.id);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-3)',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '4px',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}
                                                title="Delete Connection"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{
                                                padding: '4px 8px', borderRadius: '6px',
                                                background: 'var(--bg-4)', fontSize: '11px',
                                                fontWeight: 600, color: 'var(--text-0)', flex: 1,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {src?.name || conn.sourceId}
                                            </div>
                                            <div style={{ color: color, flexShrink: 0 }}>→</div>
                                            <div style={{
                                                padding: '4px 8px', borderRadius: '6px',
                                                background: 'var(--bg-4)', fontSize: '11px',
                                                fontWeight: 600, color: 'var(--text-0)', flex: 1,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {tgt?.name || conn.targetId}
                                            </div>
                                        </div>

                                        {/* Flow visualization */}
                                        <div style={{ marginTop: '8px', height: '3px', borderRadius: '2px', background: 'var(--bg-4)', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: conn.flowStatus === 'green' ? '80%' : conn.flowStatus === 'orange' ? '50%' : '20%',
                                                background: `linear-gradient(90deg, ${color}, transparent)`,
                                                transition: 'width 0.5s',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Legend */}
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.06em' }}>
                            FLOW LEGEND
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                            {[
                                { status: 'green', label: 'Fluid Flow', icon: '●' },
                                { status: 'orange', label: 'Congested', icon: '●' },
                                { status: 'red', label: 'Bottleneck', icon: '●' },
                            ].map(l => (
                                <div key={l.status} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    <span style={{ color: STATUS_COLORS[l.status] }}>{l.icon}</span>
                                    <span style={{ color: 'var(--text-1)' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right — View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {/* View toggle */}
                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: '4px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px' }}>
                        {VIEWS.map(v => (
                            <button key={v} onClick={() => setView(v)} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s', background: view === v ? 'var(--bg-1)' : 'transparent', color: view === v ? 'var(--text-0)' : 'var(--text-2)', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{v}</button>
                        ))}
                    </div>

                    {view === '2D Grid' ? (
                        <Grid2D />
                    ) : (
                        <Suspense fallback={<div style={{ color: 'var(--text-2)', padding: '40px', textAlign: 'center' }}>Loading…</div>}>
                            <Scene3D />
                        </Suspense>
                    )}
                    {/* Hint overlay */}
                    <div style={{
                        position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                        padding: '8px 16px', borderRadius: '100px',
                        background: 'var(--bg-1)', border: '1px solid var(--border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px', color: 'var(--text-1)', fontWeight: 500,
                        zIndex: 10,
                        pointerEvents: 'none',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        {view === '2D Grid' ? <><MousePointerClick size={14} color="var(--accent)" /> Drag from one component to another to link them</> : <><Link2 size={14} color="var(--accent)" /> Connections rendered as animated tubes — hover for details</>}
                    </div>
                </div>
            </div>

            {/* Footer nav */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '12px 20px',
                borderTop: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0,
            }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>
                    <ArrowLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={() => setStep(4)}>
                    Next: Configure KPIs <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
        : '99,149,255';
}
