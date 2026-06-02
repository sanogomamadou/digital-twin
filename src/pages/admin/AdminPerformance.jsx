import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Clock, Target, DollarSign, ExternalLink } from 'lucide-react';
import { getAdminMetrics } from '../../services/api';

export default function AdminPerformance() {
    const [metrics, setMetrics] = useState({
        avgLatency: 0,
        successRate: 0,
        totalTokens: 0,
        timeSeries: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await getAdminMetrics();
                setMetrics(data);
            } catch (error) {
                console.error("Failed to fetch metrics", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    const estCost = ((metrics.totalTokens / 1000000) * 0.5).toFixed(4); // rough estimate $0.5 per 1M tokens

    if (loading) return <div>Loading metrics...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Agent Performance & Observability</h1>
                    <p style={{ color: 'var(--text-2)' }}>Powered by Langfuse. Monitor LLM latency, costs, and user satisfaction.</p>
                </div>
                <button 
                    onClick={() => window.open('https://cloud.langfuse.com', '_blank')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 16px', background: 'var(--bg-1)', border: '1px solid var(--border)',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-1)'
                    }}
                >
                    <ExternalLink size={16} />
                    Open Langfuse Console
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <MetricCard icon={<Clock />} label="Avg Latency" value={`${metrics.avgLatency} ms`} trend="Last 7 days" positive />
                <MetricCard icon={<Target />} label="API Success" value={`${metrics.successRate}%`} trend="Last 7 days" positive={metrics.successRate > 90} />
                <MetricCard icon={<Activity />} label="Satisfaction" value={metrics.userSatisfaction !== undefined ? `${metrics.userSatisfaction}%` : "N/A"} trend="Last 7 days" positive={metrics.userSatisfaction >= 80} />
                <MetricCard icon={<DollarSign />} label="Est. Cost" value={`$${estCost}`} trend="Last 7 days" positive={false} />
                <MetricCard icon={<Activity />} label="Total Calls" value={metrics.totalCalls !== undefined ? metrics.totalCalls : "N/A"} trend="Last 7 days" positive />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Response Latency (ms)</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Last 12 hours</span>
                    </div>
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.timeSeries}>
                                <defs>
                                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                />
                                <Area type="monotone" dataKey="latency" stroke="#f43f5e" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Token Usage</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Last 12 hours</span>
                    </div>
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.timeSeries}>
                                <defs>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                />
                                <Area type="monotone" dataKey="tokens" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTokens)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, trend, positive }) {
    return (
        <div style={{ background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-2)', marginBottom: '12px' }}>
                <div style={{ padding: '8px', background: 'var(--bg-2)', borderRadius: '8px', color: 'var(--text-1)' }}>
                    {icon}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-0)' }}>
                {value}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: positive ? '#10b981' : '#f43f5e' }}>
                {trend}
            </div>
        </div>
    );
}
