import { useState, useEffect } from 'react';
import { ChevronRight, ArrowLeft, Database, Plus, Trash2, Zap, Palette, Focus } from 'lucide-react';
import useTwinStore from '../store/useTwinStore';
import { proposeKpis, getTelemetrySchema, saveTelemetryAssignments } from '../services/api';

const BASE_URL = '';

export default function KpiStep() {
    const { setStep, components, selectedDomain, activeTwinId } = useTwinStore();

    const [columns, setColumns] = useState([]);
    const [assignments, setAssignments] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch DB schema for current domain
        getTelemetrySchema(activeTwinId || 'default')
            .then(data => {
                setColumns(data.columns || []);
                // Prioritize assignments saved in Zustand for this specific Twin
                const zustandAssignments = useTwinStore.getState().kpiAssignments || [];
                if (zustandAssignments.length > 0) {
                    setAssignments(zustandAssignments);
                    return;
                }

                // Fallback: Check if global streaming config happens to match our components
                const savedAssig = data.assignments || {};
                const currentComponentIds = useTwinStore.getState().components.map(c => c.id);
                const arr = Object.entries(savedAssig)
                    .map(([kpi_id, val]) => ({
                        kpi_id,
                        ...val
                    }))
                    .filter(a => currentComponentIds.includes(a.component_id));
                
                if(arr.length > 0) {
                    setAssignments(arr);
                } else {
                    setAssignments([]);
                }
            })
            .catch(e => setError("Failed to connect to PostgreSQL backend: " + e.message));
    }, [selectedDomain, components]);

    const addKpi = () => {
        setAssignments([
            ...assignments, 
            { 
                kpi_id: `kpi_${Date.now()}`, 
                component_id: '', 
                kpi_name: 'New KPI', 
                formula: '', 
                unit: '', 
                rules: { orange: [null, null], red: [null, null], direction: 'asc' },
                interaction: 'pulse'
            }
        ]);
    };

    const handleSuggestKpis = async () => {
        if (!columns.length) return;
        setAiLoading(true);
        setError('');
        try {
            const compList = components.map(c => ({ id: c.id, name: c.name }));
            const data = await proposeKpis(activeTwinId || 'default', selectedDomain, columns, compList);
            if (data && data.kpis) {
                const newAssignments = data.kpis.map(k => {
                    const matchedComponent = components.find(c => c.id === k.target_machine_id) || components[0];
                    return {
                        kpi_id: `kpi_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
                        component_id: matchedComponent?.id || '',
                        kpi_name: k.kpi_name || 'AI KPI',
                        formula: k.formula || '',
                        unit: k.unit || '',
                        rules: { 
                            orange: [k.orange ?? null, null], 
                            red: [k.red ?? null, null], 
                            direction: k.direction || 'asc' 
                        },
                        interaction: k.interaction || 'pulse'
                    };
                });
                setAssignments(prev => [...prev, ...newAssignments]);
            }
        } catch (err) {
            setError('Failed to fetch AI suggestions: ' + err.message);
        } finally {
            setAiLoading(false);
        }
    };

    const updateKpi = (id, field, value) => {
        setAssignments(prev => prev.map(a => a.kpi_id === id ? { ...a, [field]: value } : a));
    };

    const updateRule = (id, level, valueStr) => {
        const val = valueStr === '' ? null : parseFloat(valueStr);
        setAssignments(prev => prev.map(a => {
            if(a.kpi_id === id) {
                const newRules = { ...a.rules };
                newRules[level] = [val, newRules[level]?.[1] || 9999];
                return { ...a, rules: newRules };
            }
            return a;
        }));
    };

    const removeKpi = (id) => {
        setAssignments(prev => prev.filter(a => a.kpi_id !== id));
    };

    const handleLaunch = async () => {
        const valid = assignments.filter(a => a.component_id && a.kpi_name && a.formula);

        setLoading(true); setError('');
        try {
            await saveTelemetryAssignments(activeTwinId || 'default', selectedDomain, valid);
            
            // Clear local KPI cache in Zustand so Live View isn't stale
            useTwinStore.getState().clearKpis();
            // Save the newly defined formulas in Zustand for DB persistence
            useTwinStore.getState().setKpiAssignments(valid);
            
            setStep(5);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ── LEFT PANEL: Database Columns ── */}
                <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.9)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <Database size={15} color="var(--accent)" />
                            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>PostgreSQL</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                            Live schema for <strong style={{color: '#fff'}}>{selectedDomain}_data</strong> table. Use these variable names in your KPI formulas.
                        </p>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                        {columns.length === 0 ? (
                            <div style={{fontSize: '11px', color: 'var(--text-2)'}}>Loading schema...</div>
                        ) : (
                            columns.map(col => (
                                <div key={col} style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: '6px', marginBottom: '8px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent)' }}>
                                    {col}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL: KPI Builder ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-1)', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>KPI Formula Engine</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleSuggestKpis} disabled={aiLoading || columns.length === 0} style={{ padding: '8px 14px', borderRadius: '8px', background: 'linear-gradient(135deg,#4865f2,#f4723e)', color: '#fff', border: 'none', cursor: (aiLoading || columns.length === 0) ? 'not-allowed' : 'pointer', opacity: (aiLoading || columns.length === 0) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                                {aiLoading ? '🔄 Thinking...' : '✨ AI Suggestions'}
                            </button>
                            <button onClick={addKpi} style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(72,101,242,0.1)', color: 'var(--accent)', border: '1px solid rgba(72,101,242,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                <Plus size={14} /> Add New KPI
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '16px', border: '1px solid rgba(239,68,68,0.3)' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {assignments.length === 0 && (
                            <div style={{ margin: 'auto', color: 'var(--text-2)', fontSize: '13px', textAlign: 'center' }}>
                                <Database size={32} opacity={0.5} style={{marginBottom: '12px'}} />
                                <div>No KPIs defined yet.</div>
                                <div style={{marginTop: '4px'}}>Click "Add New KPI" to start building derived metrics.</div>
                            </div>
                        )}

                        {assignments.map((kpi, index) => (
                            <div key={kpi.kpi_id} style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-0)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>KPI Rule #{index + 1}</div>
                                    <button onClick={() => removeKpi(kpi.kpi_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(250px, 2fr) 80px', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Target Component</label>
                                        <select value={kpi.component_id} onChange={e => updateKpi(kpi.kpi_id, 'component_id', e.target.value)} style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}>
                                            <option value="">-- Select --</option>
                                            {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Label</label>
                                        <input value={kpi.kpi_name} onChange={e => updateKpi(kpi.kpi_id, 'kpi_name', e.target.value)} placeholder="e.g. Total Energy" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--accent)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Formula (Math)</label>
                                        <input value={kpi.formula} onChange={e => updateKpi(kpi.kpi_id, 'formula', e.target.value)} placeholder="e.g. temp_1 + temp_2 * 1.5" style={{ width: '100%', background: 'rgba(72,101,242,0.05)', border: '1px solid rgba(72,101,242,0.3)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Unit</label>
                                        <input value={kpi.unit} onChange={e => updateKpi(kpi.kpi_id, 'unit', e.target.value)} placeholder="kWh" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(150px, 1fr)', gap: '12px', marginTop: '4px' }}>
                                    <div>
                                        <label style={{ fontSize: '10px', color: 'var(--text-2)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Direction</label>
                                        <select value={kpi.rules.direction || 'asc'} onChange={e => {
                                            const newRules = { ...kpi.rules, direction: e.target.value };
                                            updateKpi(kpi.kpi_id, 'rules', newRules);
                                        }} style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}>
                                            <option value="asc">Ascending (≥)</option>
                                            <option value="desc">Descending (≤)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: '#f59e0b', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>🟡 Warn {kpi.rules.direction === 'desc' ? '≤' : '≥'}</label>
                                        <input type="number" value={kpi.rules.orange?.[0] ?? ''} onChange={e => updateRule(kpi.kpi_id, 'orange', e.target.value)} placeholder="Threshold" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: '#ef4444', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>🔴 Critical {kpi.rules.direction === 'desc' ? '≤' : '≥'}</label>
                                        <input type="number" value={kpi.rules.red?.[0] ?? ''} onChange={e => updateRule(kpi.kpi_id, 'red', e.target.value)} placeholder="Threshold" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '10px', color: '#10d98d', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>✨ Visual Interaction</label>
                                        <select value={kpi.interaction} onChange={e => updateKpi(kpi.kpi_id, 'interaction', e.target.value)} style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid rgba(16,217,141,0.3)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}>
                                            <option value="transition">Solid Color Transition</option>
                                            <option value="pulse">Luminous Pulse</option>
                                            <option value="glow">Outline Glow</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
                <button className="btn btn-ghost" onClick={() => setStep(3)}>
                    <ArrowLeft size={16} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn btn-ghost" onClick={() => setStep(5)} style={{ fontSize: '12px' }}>
                        Skip for now →
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleLaunch}
                        disabled={loading || assignments.length === 0}
                        style={{ opacity: (loading || assignments.length === 0) ? 0.5 : 1 }}>
                        {loading ? '⏳ Deploying Rules…' : `🚀 Compile & Launch System`}
                        {!loading && <ChevronRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
