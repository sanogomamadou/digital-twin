import { useState, useEffect } from 'react';
import { verifyShareLink } from '../services/api';
import useTwinStore from '../store/useTwinStore';
import Scene3D from '../components/Scene3D';
import KpiPanel from '../components/KpiPanel';
import KpiCharts from '../components/KpiCharts';
import Chatbot from '../components/Chatbot';
import useKpiWebSocket from '../hooks/useKpiWebSocket';
import { Lock, AlertCircle, Eye, Bell, Activity, LineChart, Bot } from 'lucide-react';

const TABS = [
    { id: 'kpi',    label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Activity size={14} /> KPIs</div> },
    { id: 'charts', label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><LineChart size={14} /> Charts</div> },
    { id: 'chat',   label: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Bot size={14} /> AI</div> },
];

const CAMERA_VIEWS = ['Isometric', 'Top', 'Front', 'Free'];

const WS_LABELS = {
    connecting:   { color: '#f59e0b', dot: '⏳', text: 'Connecting…' },
    live:         { color: '#10d98d', dot: '●',  text: 'Live' },
    reconnecting: { color: '#f97316', dot: '↻',  text: 'Reconnecting' },
    offline:      { color: '#64748b', dot: '○',  text: 'No data source' },
};

export default function SharedTwinView({ shareId }) {
    const {
        loadTwinFromDb, kpis, components, connections,
        updateKpiValues, activePanel, setActivePanel,
        selectedComponentId, selectComponent,
        twinName, selectedDomain
    } = useTwinStore();

    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [cameraView, setCameraView] = useState('Isometric');
    const [alertsOpen, setAlertsOpen] = useState(false);

    // Check if already authenticated in this session
    useEffect(() => {
        const savedPw = sessionStorage.getItem(`share_pw_${shareId}`);
        if (savedPw) {
            setPassword(savedPw);
            handleLogin(null, savedPw);
        }
    }, [shareId]);

    const handleLoadTwin = async (twinId) => {
        setLoading(true);
        try {
            await loadTwinFromDb(twinId, 5); // 5 is TwinView step
            setIsAuthenticated(true);
        } catch (e) {
            setError('Failed to load twin data. The link might be invalid or the twin was deleted.');
            sessionStorage.removeItem(`share_pw_${shareId}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e, forcePassword) => {
        if (e) e.preventDefault();
        const pwToUse = forcePassword || password;
        setLoading(true);
        setError(null);
        try {
            const res = await verifyShareLink(shareId, pwToUse);
            if (res && res.success && res.twin_id) {
                sessionStorage.setItem(`share_pw_${shareId}`, pwToUse);
                await handleLoadTwin(res.twin_id);
            }
        } catch (e) {
            setError(e.message || 'Incorrect password');
            sessionStorage.removeItem(`share_pw_${shareId}`);
        } finally {
            setLoading(false);
        }
    };

    // Poll to check if access was revoked
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(async () => {
            try {
                const savedPw = sessionStorage.getItem(`share_pw_${shareId}`);
                if (!savedPw) throw new Error();
                const res = await verifyShareLink(shareId, savedPw);
                if (!res || !res.success) throw new Error();
            } catch (e) {
                setIsAuthenticated(false);
                sessionStorage.removeItem(`share_pw_${shareId}`);
                setPassword('');
                setError("Accès révoqué : le lien a été supprimé ou le mot de passe a changé.");
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [isAuthenticated, shareId]);

    const { status: wsStatus, lastUpdate, messageCount, STATUS } = useKpiWebSocket(selectedDomain || 'factory');

    useEffect(() => {
        if (!isAuthenticated || wsStatus === STATUS.LIVE) return;
        const t = setInterval(updateKpiValues, 5000);
        return () => clearInterval(t);
    }, [isAuthenticated, wsStatus, STATUS.LIVE]);

    useEffect(() => {
        if (selectedComponentId) {
            setActivePanel('charts');
        }
    }, [selectedComponentId]);

    if (!isAuthenticated) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
                <div className="glass" style={{ width: '360px', padding: '32px', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(72,101,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Lock size={24} color="#4865f2" />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-0)', marginBottom: '8px' }}>Secure Live View</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Enter the password to access this digital twin.</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '20px' }}>
                            <input
                                type="password"
                                className="input"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', fontSize: '14px', textAlign: 'center' }}
                                autoFocus
                            />
                        </div>
                        {error && (
                            <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            {loading ? 'Verifying...' : 'Access View'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>Loading Digital Twin...</div>;
    }

    const critKpis = kpis.filter(k => k.status === 'red');
    const warnKpis = kpis.filter(k => k.status === 'orange');
    const selComp  = components.find(c => c.id === selectedComponentId);
    const wsInfo = WS_LABELS[wsStatus] || WS_LABELS.offline;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>
            {/* ── Top toolbar (Read Only) ─────────────────────────────────────────────── */}
            <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Eye size={16} color="#fff" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-0)' }}>Shared View</span>
                </div>

                <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)' }}>
                        ⬡ {twinName || 'Digital Twin'} — Live
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-2)' }}>
                        {components.length} components · {connections.length} connections
                    </span>
                </div>

                <div style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap',
                    background: `rgba(${wsStatus === 'live' ? '16,217,141' : wsStatus === 'connecting' || wsStatus === 'reconnecting' ? '245,158,11' : '100,116,139'},0.1)`,
                    color: wsInfo.color, border: `1px solid ${wsInfo.color}40` }}>
                    {wsInfo.dot} {wsInfo.text}
                    {wsStatus === 'live' && <span style={{ marginLeft: '6px', opacity: 0.65, fontWeight: 400 }}>· {messageCount} readings</span>}
                </div>

                <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-0)', borderRadius: '8px', padding: '2px' }}>
                    {CAMERA_VIEWS.map(v => (
                        <button key={v} onClick={() => setCameraView(v)}
                            style={{ padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600, transition: 'all 0.15s',
                                background: cameraView === v ? 'var(--accent)' : 'transparent',
                                color: cameraView === v ? '#fff' : 'var(--text-2)' }}>
                            {v}
                        </button>
                    ))}
                </div>

                <button onClick={() => setAlertsOpen(o => !o)}
                    style={{ padding: '4px 10px', borderRadius: '8px', border: `1px solid ${critKpis.length > 0 ? '#ef4444' : 'var(--border)'}`, background: critKpis.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-0)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: critKpis.length > 0 ? '#ef4444' : 'var(--text-2)' }}>
                    <Bell size={13} /> {critKpis.length > 0 ? `${critKpis.length} Critical` : warnKpis.length > 0 ? `${warnKpis.length} Warn` : 'No alerts'}
                </button>
            </div>

            {alertsOpen && critKpis.length > 0 && (
                <div style={{ position: 'absolute', top: '50px', right: '14px', zIndex: 100, width: '290px', background: 'var(--bg-1)', border: '1px solid #ef4444', borderRadius: '10px', padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>🚨 Critical Alerts</div>
                    {critKpis.map(k => (
                        <div key={k.id} style={{ padding: '6px 8px', marginBottom: '5px', borderRadius: '7px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11px' }}>
                            <span style={{ fontWeight: 700, color: '#ef4444' }}>{k.name}</span>
                            <span style={{ color: 'var(--text-2)', marginLeft: '6px' }}>{typeof k.value === 'number' ? k.value.toFixed(1) : k.value} {k.unit}</span>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <Scene3D cameraView={cameraView.toLowerCase()} />

                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'none' }}>
                        {[
                            { icon: '⬡', label: 'Components', value: components.length, color: '#4865f2' },
                            { icon: '✅', label: 'OK', value: kpis.filter(k => k.status === 'green').length, color: '#10d98d' },
                            { icon: '⚠️', label: 'Warnings', value: warnKpis.length, color: '#f59e0b' },
                            { icon: '🚨', label: 'Critical', value: critKpis.length, color: '#ef4444' },
                        ].map(s => (
                            <div key={s.label} style={{ padding: '5px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.88)', border: `1px solid ${s.color}28`, backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px' }}>{s.icon}</span>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '9px', color: 'var(--text-2)' }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selComp && (
                        <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.92)', border: `1px solid ${selComp.color}55`, backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: selComp.color, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)' }}>{selComp.name}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>{selComp.type?.replace(/_/g, ' ')} · {selComp.gridSize?.join('×')} cells</div>
                            </div>
                            {kpis.filter(k => selComp.kpiIds?.includes(k.id)).map(k => (
                                <div key={k.id} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: k.status === 'red' ? '#ef4444' : k.status === 'orange' ? '#f59e0b' : '#10d98d' }}>
                                        {typeof k.value === 'number' ? k.value.toFixed(1) : k.value}
                                    </div>
                                    <div style={{ fontSize: '9px', color: '#64748b' }}>{k.unit || k.name}</div>
                                </div>
                            ))}
                            <button onClick={() => selectComponent(null)} style={{ pointerEvents: 'all', fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(72,101,242,0.12)', border: '1px solid rgba(72,101,242,0.3)', color: '#4865f2', cursor: 'pointer' }}>✕</button>
                        </div>
                    )}
                </div>

                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--bg-1)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-0)', flexShrink: 0 }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setActivePanel(t.id)}
                                style={{ flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s',
                                    borderBottom: `2px solid ${activePanel === t.id ? 'var(--accent)' : 'transparent'}`,
                                    background: 'transparent',
                                    color: activePanel === t.id ? 'var(--accent)' : 'var(--text-2)' }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {activePanel === 'kpi'    && <KpiPanel />}
                        {activePanel === 'charts' && <KpiCharts />}
                        {activePanel === 'chat'   && <Chatbot />}
                    </div>
                </div>
            </div>
        </div>
    );
}
