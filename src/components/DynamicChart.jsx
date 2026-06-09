import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    PieChart, Pie, Cell, ScatterChart, Scatter,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Lightbulb } from 'lucide-react';

const COLORS = ['#4865f2', '#10d98d', '#f59e0b', '#f4723e', '#ef4444', '#06b6d4', '#f97316'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0d1117', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '8px 14px', fontSize: '11px' }}>
            {label && <div style={{ color: '#94a3c8', marginBottom: '4px' }}>{label}</div>}
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </div>
            ))}
        </div>
    );
};

const axisStyle = { fontSize: 9, fill: '#64748b' };
const gridStyle = { strokeDasharray: '2 4', stroke: '#1e3a5f', vertical: false };

/**
 * DynamicChart — renders ANY Recharts chart type from a server-generated config.
 * config shape:
 *   { chartType, title, xKey, series:[{key,name,color}], referenceLines:[{y,label,stroke}],
 *     data, insight, stacked, gradient }
 */
export default function DynamicChart({ config, height = 220 }) {
    if (!config || !config.data?.length) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>
                No chart data available
            </div>
        );
    }

    const { chartType = 'AreaChart', xKey = 'timestamp', series = [], referenceLines = [], data, stacked = false, gradient = true } = config;

    const commonProps = {
        data,
        margin: { top: 4, right: 8, left: -12, bottom: 0 },
    };

    const xAxis = <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} interval="preserveStartEnd" />;
    const yAxis = <YAxis tick={axisStyle} tickLine={false} axisLine={false} />;
    const grid = <CartesianGrid {...gridStyle} />;
    const tips = <Tooltip content={<CustomTooltip />} />;
    const leg = series.length > 1 ? <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3c8' }} /> : null;

    const refLines = referenceLines.map((rl, i) => (
        <ReferenceLine key={i} y={rl.y} x={rl.x}
            label={{ value: rl.label, fill: rl.stroke || '#ef4444', fontSize: 9 }}
            stroke={rl.stroke || '#ef4444'} strokeDasharray={rl.strokeDasharray || '5 5'} />
    ));

    const gradDefs = gradient ? (
        <defs>
            {series.map((s, i) => (
                <linearGradient key={s.key} id={`dg_${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color || COLORS[i % COLORS.length]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={s.color || COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
            ))}
        </defs>
    ) : null;

    let chart = null;

    switch (chartType) {
        case 'AreaChart':
            chart = (
                <AreaChart {...commonProps}>
                    {gradDefs}{grid}{xAxis}{yAxis}{tips}{leg}
                    {series.map((s, i) => (
                        <Area key={s.key} type={s.type || 'monotone'} dataKey={s.key} name={s.name}
                            stroke={s.color || COLORS[i % COLORS.length]} strokeWidth={2}
                            fill={gradient ? `url(#dg_${s.key})` : 'none'}
                            stackId={stacked ? 'stack' : undefined} dot={false} activeDot={{ r: 3 }} />
                    ))}
                    {refLines}
                </AreaChart>
            );
            break;

        case 'LineChart':
            chart = (
                <LineChart {...commonProps}>
                    {grid}{xAxis}{yAxis}{tips}{leg}
                    {series.map((s, i) => (
                        <Line key={s.key} type={s.type || 'monotone'} dataKey={s.key} name={s.name}
                            stroke={s.color || COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    ))}
                    {refLines}
                </LineChart>
            );
            break;

        case 'BarChart':
            chart = (
                <BarChart {...commonProps}>
                    {grid}{xAxis}{yAxis}{tips}{leg}
                    {series.map((s, i) => (
                        <Bar key={s.key} dataKey={s.key} name={s.name}
                            fill={s.color || COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]}
                            stackId={stacked ? 'stack' : undefined} />
                    ))}
                    {refLines}
                </BarChart>
            );
            break;

        case 'PieChart': {
            const pieKey = series[0]?.key || 'value';
            const nameKey = xKey === 'timestamp' ? 'name' : xKey;
            chart = (
                <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3c8' }} />
                    <Pie data={data} dataKey={pieKey} nameKey={nameKey} cx="50%" cy="50%"
                        outerRadius={height * 0.34} innerRadius={height * 0.16}
                        paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                </PieChart>
            );
            break;
        }

        case 'ScatterChart':
            chart = (
                <ScatterChart {...commonProps}>
                    {grid}{xAxis}{yAxis}{tips}{leg}
                    {series.map((s, i) => (
                        <Scatter key={s.key} name={s.name} data={data}
                            fill={s.color || COLORS[i % COLORS.length]} />
                    ))}
                </ScatterChart>
            );
            break;

        case 'RadarChart': {
            const radarKey = xKey === 'timestamp' ? (data[0] ? Object.keys(data[0])[0] : 'name') : xKey;
            chart = (
                <RadarChart data={data} cx="50%" cy="50%" outerRadius={height * 0.36}>
                    <PolarGrid stroke="#1e3a5f" />
                    <PolarAngleAxis dataKey={radarKey} tick={{ fontSize: 9, fill: '#94a3c8' }} />
                    <PolarRadiusAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    {series.map((s, i) => (
                        <Radar key={s.key} name={s.name} dataKey={s.key}
                            stroke={s.color || COLORS[i % COLORS.length]} fill={s.color || COLORS[i % COLORS.length]} fillOpacity={0.25} />
                    ))}
                    {leg}
                </RadarChart>
            );
            break;
        }

        case 'ComposedChart':
        default:
            chart = (
                <ComposedChart {...commonProps}>
                    {gradDefs}{grid}{xAxis}{yAxis}{tips}{leg}
                    {series.map((s, i) => {
                        const color = s.color || COLORS[i % COLORS.length];
                        return i % 2 === 0
                            ? <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} fill={`url(#dg_${s.key})`} dot={false} />
                            : <Bar key={s.key} dataKey={s.key} name={s.name} fill={color} radius={[3, 3, 0, 0]} />;
                    })}
                    {refLines}
                </ComposedChart>
            );
    }

    return (
        <div>
            {config.title && (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{config.title}</span>
                    <span style={{ fontSize: '9px', color: '#64748b', padding: '2px 6px', background: 'var(--bg-0)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        {chartType.replace('Chart', '')} · {data.length} pts
                    </span>
                </div>
            )}
            <ResponsiveContainer width="100%" height={height}>
                {chart}
            </ResponsiveContainer>
            {config.insight && (
                <div style={{ marginTop: '6px', fontSize: '10px', color: '#94a3c8', padding: '5px 10px', background: 'rgba(72,101,242,0.06)', borderRadius: '5px', borderLeft: '2px solid #4865f2', display: 'flex', alignItems: 'center' }}>
                    <Lightbulb size={12} style={{ marginRight: '6px', color: 'var(--accent)' }} /> {config.insight}
                </div>
            )}
        </div>
    );
}
