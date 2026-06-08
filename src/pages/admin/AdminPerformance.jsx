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

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Agent Performance</h1>
                    <p style={{ color: 'var(--text-2)', fontSize: '15px' }}>Powered by Langfuse. Monitor LLM latency, costs, and user satisfaction.</p>
                </div>
                <button 
                    onClick={() => window.open('https://cloud.langfuse.com', '_blank')}
                    className="btn btn-ghost"
                >
                    <ExternalLink size={16} />
                    Open Langfuse
                </button>
            </div>

            {/* KPI Cards - Bento Grid */}
            <div className="admin-bento-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', 
                gap: '16px' 
            }}>
                <MetricCard icon={<Clock />} label="Avg Latency" value={`${metrics.avgLatency} ms`} trend="Last 7 days" positive={true} />
                <MetricCard icon={<Target />} label="API Success" value={`${metrics.successRate}%`} trend="Last 7 days" positive={metrics.successRate > 90} />
                <MetricCard icon={<Activity />} label="Satisfaction" value={metrics.userSatisfaction !== undefined ? `${metrics.userSatisfaction}%` : "N/A"} trend="Last 7 days" positive={metrics.userSatisfaction >= 80} />
                <MetricCard icon={<DollarSign />} label="Est. Cost" value={`$${estCost}`} trend="Last 7 days" positive={false} />
                <MetricCard icon={<Activity />} label="Total Calls" value={metrics.totalCalls !== undefined ? metrics.totalCalls : "N/A"} trend="Last 7 days" positive={true} />
            </div>

            {/* Charts */}
            <div className="admin-bento-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                gap: '20px' 
            }}>
                <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 className="label" style={{ marginBottom: 0 }}>Response Latency (ms)</h3>
                        <span className="tag">Last 12 hours</span>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.timeSeries} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--orange)" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="var(--orange)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', fontSize: '13px' }}
                                />
                                <Area type="monotone" dataKey="latency" stroke="var(--orange)" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 className="label" style={{ marginBottom: 0 }}>Token Usage</h3>
                        <span className="tag">Last 12 hours</span>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.timeSeries} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--text-2)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', fontSize: '13px' }}
                                />
                                <Area type="monotone" dataKey="tokens" stroke="var(--accent)" fillOpacity={1} fill="url(#colorTokens)" strokeWidth={2} />
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
        <div style={{ 
            background: 'var(--bg-1)', 
            borderRadius: 'var(--r-lg)', 
            border: '1px solid var(--border)', 
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                    padding: '6px', 
                    background: 'var(--bg-0)', 
                    borderRadius: 'var(--r-md)', 
                    color: 'var(--text-1)',
                    border: '1px solid var(--border)'
                }}>
                    {icon}
                </div>
                <span className="label" style={{ marginBottom: 0, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </div>
            <div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {value}
                </div>
            </div>
            <div style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: positive ? 'var(--green)' : 'var(--orange)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span style={{ 
                    display: 'inline-block', 
                    width: '6px', height: '6px', 
                    borderRadius: '50%', 
                    background: positive ? 'var(--green)' : 'var(--orange)' 
                }} />
                {trend}
            </div>
        </div>
    );
}
