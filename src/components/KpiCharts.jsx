import { useMemo, useState, Component } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend, ReferenceLine
} from 'recharts';
import { FolderOpen, Link2, TrendingUp } from 'lucide-react';
import useTwinStore from '../store/useTwinStore';

class ChartErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { error: false }; }
    static getDerivedStateFromError() { return { error: true }; }
    componentDidCatch() { this.setState({ error: false }); } // auto-reset on next render
    render() {
        if (this.state.error) return (
            <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: '11px' }}>
                Chart unavailable
            </div>
        );
        return this.props.children;
    }
}

const PALETTE = ['#4865f2', '#10d98d', '#f59e0b', '#f4723e', '#ef4444', '#06b6d4', '#f472b6', '#a3e635'];
const STATUS_COLOR = { green: '#10d98d', orange: '#f59e0b', red: '#ef4444' };

const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0d1117', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '8px 12px', fontSize: '11px' }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </div>
            ))}
        </div>
    );
};

export default function KpiCharts() {
    const { kpis, kpiHistory, selectedComponentId, components } = useTwinStore();
    const [chartType, setChartType] = useState('area'); // area | line | bar

    const selectedComp = components.find(c => c.id === selectedComponentId);

    // Filter KPIs: if a component is selected, show only its KPIs; otherwise show all
    const displayKpis = useMemo(() => {
        if (selectedComp) {
            const ids = selectedComp.kpiIds || [];
            return kpis.filter(k => ids.includes(k.id));
        }
        return kpis;
    }, [kpis, selectedComp]);

    // Last 60 history points
    const chartData = kpiHistory.slice(-60);

    // ── Empty states ─────────────────────────────────────────────────────────
    if (kpis.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px', padding: '20px', textAlign: 'center' }}>
                <FolderOpen size={32} color="var(--text-3)" />
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>No data source connected</div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    Go to ← KPI Setup<br />upload your file and assign KPI columns to components.
                </div>
            </div>
        );
    }

    if (selectedComp && displayKpis.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '20px', textAlign: 'center' }}>
                <Link2 size={28} color="var(--text-3)" />
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)' }}>{selectedComp.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    No KPI columns were assigned to this component.<br />
                    Go to ← KPI Setup and assign a column to <strong style={{ color: 'var(--text-1)' }}>{selectedComp.name}</strong>.
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={14} color="var(--accent)" /> KPI Trends
                        {selectedComp && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>— {selectedComp.name}</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                        {chartData.length} readings · {displayKpis.length} KPI{displayKpis.length !== 1 ? 's' : ''}
                        {!selectedComp && <span style={{ marginLeft: '4px', color: 'var(--accent)' }}>↑ click component to filter</span>}
                    </div>
                </div>
                {/* Chart type toggle */}
                <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-0)', borderRadius: '7px', padding: '2px' }}>
                    {['area', 'line', 'bar'].map(t => (
                        <button key={t} onClick={() => setChartType(t)}
                            style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600, textTransform: 'capitalize',
                                background: chartType === t ? 'var(--accent)' : 'transparent',
                                color: chartType === t ? '#fff' : 'var(--text-2)' }}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '7px', flexShrink: 0 }}>
                {displayKpis.map(kpi => {
                    const sc = STATUS_COLOR[kpi.status] || '#4865f2';
                    return (
                        <div key={kpi.id} style={{ padding: '8px', background: 'var(--bg-0)', border: `1px solid ${sc}30`, borderTop: `2px solid ${sc}`, borderRadius: '8px' }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-2)', marginBottom: '3px', lineHeight: 1.3 }}>{kpi.name}</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: sc }}>
                                {typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value}
                                <span style={{ fontSize: '9px', fontWeight: 400, marginLeft: '2px', color: 'var(--text-2)' }}>{kpi.unit}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: sc, textTransform: 'uppercase', fontWeight: 700 }}>{kpi.status}</div>
                        </div>
                    );
                })}
            </div>

            {/* Per-KPI charts */}
            {displayKpis.map((kpi, i) => {
                const color = PALETTE[i % PALETTE.length];
                const sc    = STATUS_COLOR[kpi.status] || color;
                const orangeThreshold = kpi.rules?.orange?.[0];
                const redThreshold    = kpi.rules?.red?.[0];

                // Determine which chart component to use
                let chartElement = null;

                const commonAxes = (
                    <>
                        <CartesianGrid strokeDasharray="2 4" stroke="#1e3a5f" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<Tip />} />
                        {orangeThreshold != null && (
                            <ReferenceLine y={orangeThreshold} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1}
                                label={{ value: `! ${orangeThreshold}`, fontSize: 8, fill: '#f59e0b', position: 'right' }} />
                        )}
                        {redThreshold != null && (
                            <ReferenceLine y={redThreshold} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1}
                                label={{ value: `● ${redThreshold}`, fontSize: 8, fill: '#ef4444', position: 'right' }} />
                        )}
                    </>
                );

                if (chartType === 'bar') {
                    chartElement = (
                        <BarChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                            {commonAxes}
                            <Bar dataKey={kpi.id} name={kpi.name} fill={color} isAnimationActive={false} />
                        </BarChart>
                    );
                } else if (chartType === 'line') {
                    chartElement = (
                        <LineChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                            {commonAxes}
                            <Line type="monotone" dataKey={kpi.id} name={kpi.name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: color }} />
                        </LineChart>
                    );
                } else {
                    chartElement = (
                        <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`g_${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            {commonAxes}
                            <Area type="monotone" dataKey={kpi.id} name={kpi.name} stroke={color} strokeWidth={2} fill={`url(#g_${kpi.id})`} dot={false} activeDot={{ r: 3, fill: color }} />
                        </AreaChart>
                    );
                }

                return (
                    <div key={kpi.id} style={{ background: 'var(--bg-0)', border: `1px solid ${sc}22`, borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
                        {/* Chart header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)' }}>{kpi.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: sc }}>
                                    {typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value}
                                    <span style={{ fontSize: '10px', fontWeight: 400, marginLeft: '2px', color: 'var(--text-2)' }}>{kpi.unit}</span>
                                </span>
                                <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '10px', background: `${sc}1a`, color: sc, fontWeight: 700, textTransform: 'uppercase' }}>
                                    {kpi.status}
                                </span>
                            </div>
                        </div>

                        {chartData.length < 2 ? (
                            <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: '11px' }}>
                                Waiting for data…
                            </div>
                        ) : (
                            <ChartErrorBoundary>
                                <ResponsiveContainer width="100%" height={100}>
                                    {chartElement}
                                </ResponsiveContainer>
                            </ChartErrorBoundary>
                        )}

                        {/* Threshold legend */}
                        {(orangeThreshold != null || redThreshold != null) && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                {orangeThreshold != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#f59e0b' }}>
                                        <div style={{ width: '16px', height: '2px', background: '#f59e0b', borderRadius: '1px' }} />
                                        Warn ≥ {orangeThreshold} {kpi.unit}
                                    </div>
                                )}
                                {redThreshold != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#ef4444' }}>
                                        <div style={{ width: '16px', height: '2px', background: '#ef4444', borderRadius: '1px' }} />
                                        Critical ≥ {redThreshold} {kpi.unit}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Combined overview chart when no component selected */}
            {!selectedComp && displayKpis.length > 1 && chartData.length >= 2 && (
                <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>All KPIs (normalized)</div>
                    <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="2 4" stroke="#1e3a5f" vertical={false} />
                            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} axisLine={false} />
                            <Tooltip content={<Tip />} />
                            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '4px' }} />
                            {displayKpis.map((kpi, i) => (
                                <Line key={kpi.id} type="monotone" dataKey={kpi.id} name={kpi.name}
                                    stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
