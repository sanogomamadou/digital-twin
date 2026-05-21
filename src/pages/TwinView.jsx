/**
 * TwinView — Final Live View (Step 5)
 *
 * This page is ONLY for monitoring and analysis:
 *   - 3D Digital Twin visualization (left, main area)
 *   - Right sidebar with 3 tabs:
 *       📊 KPIs  — live real-time values from connected source
 *       📈 Charts — dynamic visualizations of KPI history
 *       🦙 AI    — NLQ chatbot for analytical questions
 *
 * Data source setup is done in Step 4 (KpiStep), not here.
 */
import { useEffect, useState } from 'react';
import useTwinStore from '../store/useTwinStore';
import { Save, CheckCircle, Download } from 'lucide-react';
import Scene3D from '../components/Scene3D';
import KpiPanel from '../components/KpiPanel';
import KpiCharts from '../components/KpiCharts';
import Chatbot from '../components/Chatbot';
import useKpiWebSocket from '../hooks/useKpiWebSocket';
import ShareModal from '../components/ShareModal';
import { Share2 } from 'lucide-react';
import ExportModal from '../components/ExportModal';

const TABS = [
    { id: 'kpi',    label: '📊 KPIs' },
    { id: 'charts', label: '📈 Charts' },
    { id: 'chat',   label: '🦙 AI' },
];

const CAMERA_VIEWS = ['Isometric', 'Top', 'Front', 'Free'];

const WS_LABELS = {
    connecting:   { color: '#f59e0b', dot: '⏳', text: 'Connecting…' },
    live:         { color: '#10d98d', dot: '●',  text: 'Live' },
    reconnecting: { color: '#f97316', dot: '↻',  text: 'Reconnecting' },
    offline:      { color: '#64748b', dot: '○',  text: 'No data source' },
};

export default function TwinView() {
    const {
        kpis, kpiAssignments, components, connections,
        updateKpiValues, setStep,
        activePanel, setActivePanel,
        selectedComponentId, selectComponent,
        twinName, selectedDomain, activeTwinId,
        saveTwinToDb, exportDigitalTwin,
    } = useTwinStore();

    const [cameraView, setCameraView] = useState('Isometric');
    const [alertsOpen, setAlertsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveOk, setSaveOk] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveTwinToDb();
            setSaveOk(true);
            showToast('success', `"${twinName || 'Digital Twin'}" saved successfully`);
            setTimeout(() => setSaveOk(false), 2500);
        } catch {
            showToast('error', 'Save failed — check that the backend is running');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (options) => {
        setExportModalOpen(false);
        setExporting(true);
        try {
            await exportDigitalTwin(options);
            showToast('success', 'Digital Twin exported successfully');
        } catch (e) {
            showToast('error', 'Export failed: ' + e.message);
        } finally {
            setExporting(false);
        }
    };

    // Real-time KPI stream from backend file connector via WebSocket
    const { status: wsStatus, lastUpdate, messageCount, STATUS } = useKpiWebSocket(selectedDomain || 'airport');

    // Fallback local timer only when WebSocket is not live
    useEffect(() => {
        if (wsStatus === STATUS.LIVE) return;
        const t = setInterval(updateKpiValues, 5000);
        return () => clearInterval(t);
    }, [wsStatus, STATUS.LIVE]);

    // Auto-switch to Charts tab when user clicks a component
    useEffect(() => {
        if (selectedComponentId) {
            setActivePanel('charts');
        }
    }, [selectedComponentId]);

    // Alert detection
    const critKpis = kpis.filter(k => k.status === 'red');
    const warnKpis = kpis.filter(k => k.status === 'orange');
    const selComp  = components.find(c => c.id === selectedComponentId);

    // WS status badge
    const wsInfo = WS_LABELS[wsStatus] || WS_LABELS.offline;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

            <ExportModal 
                isOpen={exportModalOpen} 
                onClose={() => setExportModalOpen(false)} 
                onExport={handleExport} 
                exporting={exporting} 
            />

            {/* ── Save toast notification ─────────────────────────────────── */}
            {shareModalOpen && <ShareModal twinId={activeTwinId} onClose={() => setShareModalOpen(false)} />}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '13px 22px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    background: toast.type === 'success' ? '#0d2e1f' : '#2d1212',
                    border: `1px solid ${toast.type === 'success' ? '#10d98d55' : '#ef444455'}`,
                    color: toast.type === 'success' ? '#10d98d' : '#ef4444',
                    animation: 'fadeInUp 0.25s ease',
                    whiteSpace: 'nowrap',
                }}>
                    {toast.type === 'success'
                        ? <CheckCircle size={16} />
                        : <span style={{ fontSize: '15px' }}>⚠</span>}
                    {toast.msg}
                </div>
            )}

            {/* ── Top toolbar ─────────────────────────────────────────────── */}
            <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>

                {/* Twin name */}
                <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)' }}>
                        ⬡ {twinName || 'Digital Twin'} — Live
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-2)' }}>
                        {components.length} components · {connections.length} connections
                    </span>
                </div>

                {/* WebSocket / source status */}
                <div style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '8px', fontWeight: 600, whiteSpace: 'nowrap',
                    background: `rgba(${wsStatus === 'live' ? '16,217,141' : wsStatus === 'connecting' || wsStatus === 'reconnecting' ? '245,158,11' : '100,116,139'},0.1)`,
                    color: wsInfo.color, border: `1px solid ${wsInfo.color}40` }}>
                    {wsInfo.dot} {wsInfo.text}
                    {wsStatus === 'live' && <span style={{ marginLeft: '6px', opacity: 0.65, fontWeight: 400 }}>· {messageCount} readings</span>}
                    {lastUpdate && wsStatus === 'live' && <span style={{ marginLeft: '6px', opacity: 0.5, fontWeight: 400 }}>{lastUpdate.toLocaleTimeString()}</span>}
                </div>

                {/* Camera views */}
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

                {/* Alerts bell */}
                <button onClick={() => setAlertsOpen(o => !o)}
                    style={{ padding: '4px 10px', borderRadius: '8px', border: `1px solid ${critKpis.length > 0 ? '#ef4444' : 'var(--border)'}`, background: critKpis.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-0)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: critKpis.length > 0 ? '#ef4444' : 'var(--text-2)' }}>
                    🔔 {critKpis.length > 0 ? `${critKpis.length} Critical` : warnKpis.length > 0 ? `${warnKpis.length} Warn` : 'No alerts'}
                </button>

                {/* Share Twin */}
                <button
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', gap: '5px' }}
                    onClick={() => {
                        if (!activeTwinId) {
                            showToast('error', 'Please save the twin first before sharing.');
                            return;
                        }
                        setShareModalOpen(true);
                    }}
                >
                    <Share2 size={13} /> Share
                </button>

                {/* Export */}
                <button
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', gap: '5px' }}
                    onClick={() => setExportModalOpen(true)}
                    disabled={exporting}
                >
                    {exporting ? <><Download size={13} style={{ animation: 'bounce 1s infinite' }} /> Packaging…</> : <><Download size={13} /> Export</>}
                </button>

                {/* Save twin */}
                <button
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', gap: '5px', color: saveOk ? '#10d98d' : undefined, borderColor: saveOk ? '#10d98d55' : undefined }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saveOk ? <><CheckCircle size={13} /> Saved!</> : saving ? <><Save size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><Save size={13} /> Save Twin</>}
                </button>

                {/* Back to KPI setup */}
                <button className="btn btn-ghost" style={{ fontSize: '11px' }} onClick={() => setStep(4)}>
                    ← KPI Setup
                </button>
            </div>

            {/* ── Alert dropdown ─────────────────────────────────────────── */}
            {alertsOpen && critKpis.length > 0 && (
                <div style={{ position: 'absolute', top: '90px', right: '14px', zIndex: 100, width: '290px', background: 'var(--bg-1)', border: '1px solid #ef4444', borderRadius: '10px', padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>🚨 Critical Alerts</div>
                    {critKpis.map(k => (
                        <div key={k.id} style={{ padding: '6px 8px', marginBottom: '5px', borderRadius: '7px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11px' }}>
                            <span style={{ fontWeight: 700, color: '#ef4444' }}>{k.name}</span>
                            <span style={{ color: 'var(--text-2)', marginLeft: '6px' }}>{typeof k.value === 'number' ? k.value.toFixed(1) : k.value} {k.unit}</span>
                        </div>
                    ))}
                    <button onClick={() => setAlertsOpen(false)} style={{ width: '100%', marginTop: '6px', padding: '5px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '10px', color: 'var(--text-2)' }}>Dismiss</button>
                </div>
            )}

            {/* ── Main content ──────────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                {/* 3D Scene */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <Scene3D cameraView={cameraView.toLowerCase()} />

                    {/* Stats overlay — top left */}
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

                    {/* No data overlay */}
                    {kpis.length === 0 && (
                        <div style={{ position: 'absolute', bottom: '50px', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(72,101,242,0.3)', backdropFilter: 'blur(8px)', textAlign: 'center', pointerEvents: 'none' }}>
                            {wsStatus === STATUS.CONNECTING || wsStatus === STATUS.RECONNECTING || (wsStatus === STATUS.LIVE && kpiAssignments.length > 0) ? (
                                <>
                                    <div style={{ fontSize: '18px', marginBottom: '4px', animation: 'pulse 1.5s infinite' }}>⏳</div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>
                                        {wsStatus === STATUS.LIVE ? 'Waiting for live data…' : 'Connecting to data stream...'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                                        {kpiAssignments.length > 0
                                            ? `${kpiAssignments.length} KPI assignment${kpiAssignments.length !== 1 ? 's' : ''} configured`
                                            : 'Waiting for real-time KPIs to arrive from the backend'}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>📂</div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>No data source connected</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>Go to ← KPI Setup to upload and assign your data</div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Selected component tooltip */}
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

                {/* ── Right sidebar ─────────────────────────────────────── */}
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--bg-1)', overflow: 'hidden' }}>

                    {/* Tabs */}
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

                    {/* Panel content */}
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
