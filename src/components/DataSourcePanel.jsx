/**
 * DataSourcePanel — unified single-source setup panel.
 * Replaces the old per-component KPI import.
 *
 * Steps:
 *   1. Upload one CSV/Excel file with all columns
 *   2. See discovered columns + min/max/mean stats
 *   3. Assign each column to a component (drag-and-drop or dropdowns)
 *   4. Save → WebSocket starts streaming real data to the plan
 */
import { useState, useRef, useEffect } from 'react';
import useTwinStore from '../store/useTwinStore';
import { Plug, FolderOpen, CheckCircle2, Factory, Plane, Package, Loader2, Search, Check, AlertTriangle, AlertOctagon, Radio, Activity, Edit2, PowerOff, ArrowLeft, Play } from 'lucide-react';

const BASE_URL = '';  // uses Vite proxy

export default function DataSourcePanel() {
  const { components, selectedDomain } = useTwinStore();

  const [step, setStep] = useState('upload');  // upload | assign | live
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schema, setSchema] = useState(null);  // { columns, columnStats, preview, rowCount, timestampColumn }
  const [assignments, setAssignments] = useState({});  // { colName: { component_id, kpi_name, unit, rules } }
  const [saved, setSaved] = useState(false);
  const [sourceStatus, setSourceStatus] = useState(null);
  const fileRef = useRef();

  // Load current source status on mount
  useEffect(() => {
    fetch(`${BASE_URL}/source/status`).then(r => r.json()).then(s => {
      setSourceStatus(s);
      if (s.connected) {
        fetch(`${BASE_URL}/source/schema`).then(r => r.json()).then(schema => {
          setSchema(schema);
          setAssignments(
            Object.fromEntries(
              Object.entries(schema.assignments || {}).map(([col, a]) => [col, a])
            )
          );
          setStep('assign');
        });
      }
    }).catch(() => {});
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files[0] || e.target.files[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE_URL}/source/upload`, { method: 'POST', body: form });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      const data = await res.json();
      setSchema(data);
      // Pre-fill assignments with empty values for all columns
      const init = {};
      data.columns.forEach(col => { init[col] = { component_id: '', kpi_name: formatColName(col), unit: guessUnit(col), rules: {} }; });
      setAssignments(init);
      setStep('assign');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      const assigned = Object.entries(assignments)
        .filter(([_, a]) => a.component_id && a.kpi_name)
        .map(([col, a]) => ({
          column: col,
          component_id: a.component_id,
          component_name: components.find(c => c.id === a.component_id)?.name || a.component_id,
          kpi_name: a.kpi_name,
          unit: a.unit || '',
          rules: a.rules || {},
        }));

      if (assigned.length === 0) { setError('Please assign at least one column to a component.'); setLoading(false); return; }

      const res = await fetch(`${BASE_URL}/source/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assigned }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      setSaved(true);
      setStep('live');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch(`${BASE_URL}/source`, { method: 'DELETE' });
    setStep('upload'); setSchema(null); setAssignments({}); setFile(null); setSaved(false);
  };

  const assignedCount = Object.values(assignments).filter(a => a.component_id && a.kpi_name).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plug size={14} /> Data Source
        </div>
        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {[['upload','1 Upload'],['assign','2 Assign'],['live','3 Live']].map(([s, label]) => (
            <span key={s} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', transition: 'all 0.15s',
              background: step === s ? 'rgba(72,101,242,0.2)' : 'transparent',
              color: step === s ? 'var(--accent)' : 'var(--text-2)',
              border: `1px solid ${step === s ? 'rgba(72,101,242,0.4)' : 'transparent'}` }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <>
            {/* Drop zone */}
            <div onDrop={handleFileDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px', padding: '24px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px',
                background: dragOver ? 'rgba(72,101,242,0.06)' : 'var(--bg-0)', transition: 'all 0.15s' }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileDrop} style={{ display: 'none' }} />
              <div style={{ fontSize: '26px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><FolderOpen size={26} /></div>
              {file
                ? <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><CheckCircle2 size={12} /> {file.name}</div>
                : <>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>Drop your data file here</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>One CSV or Excel with all KPI columns · .csv · .xlsx · .xls</div>
                </>}
            </div>

            {/* Format guide */}
            <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(72,101,242,0.05)', border: '1px solid rgba(72,101,242,0.15)', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', marginBottom: '5px' }}>Expected format</div>
              <div style={{ fontSize: '9px', color: 'var(--text-2)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                timestamp, kpi_col_1, kpi_col_2, kpi_col_3, …<br/>
                2026-03-13 08:00:00, 1240, 22, 78, …<br/>
                2026-03-13 08:05:00, 1315, 28, 82, …
              </div>
            </div>

            {/* Sample files */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '5px', textTransform: 'uppercase' }}>Sample files</div>
              {[
                [<Factory size={10} />, 'Factory', 'factory_data.csv', 'machine_temperature_c, production_throughput, ...'],
                [<Plane size={10} />, 'Airport', 'airport_data.csv', 'passenger_flow, security_wait, gate_util, ...'],
                [<Package size={10} />, 'Warehouse', 'warehouse_data.csv', 'pick_rate, rack_fill, dock_util, ...'],
              ].map(([icon, label, name, cols]) => (
                <div key={name} style={{ padding: '7px 10px', marginBottom: '4px', borderRadius: '7px', background: 'var(--bg-0)', border: '1px solid var(--border)', fontSize: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '4px' }}>{icon} {label}</div>
                  <div style={{ color: 'var(--text-2)', marginTop: '2px' }}>{cols}</div>
                </div>
              ))}
              <div style={{ fontSize: '9px', color: 'var(--text-2)', marginTop: '5px' }}>Files in: <code>digital-twin-backend/sample_data/</code></div>
            </div>

            {error && <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '10px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>{error}</div>}

            <button onClick={handleUpload} disabled={!file || loading}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', background: file ? 'linear-gradient(135deg,#4865f2,#f4723e)' : 'var(--bg-0)', border: '1px solid var(--border)', color: file ? '#fff' : 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: file ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {loading ? <><Loader2 size={12} className="spin" /> Analysing file…</> : <><Search size={12} /> Upload & Discover Columns</>}
            </button>
          </>
        )}

        {/* STEP 2: Column Assignment */}
        {step === 'assign' && schema && (
          <>
            {/* File info */}
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'rgba(16,217,141,0.07)', border: '1px solid rgba(16,217,141,0.2)', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#10d98d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> {schema.fileName || file?.name} — {schema.rowCount} rows · {schema.columns?.length} KPI columns
              </div>
              {schema.timestampColumn && (
                <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '2px' }}>
                  Timestamp: <strong style={{ color: 'var(--text-1)' }}>{schema.timestampColumn}</strong>
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>
              Assign columns to components:
            </div>

            {/* Column list */}
            {schema.columns?.map(col => {
              const stats = schema.columnStats?.[col];
              const a = assignments[col] || {};
              return (
                <div key={col} style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg-0)', border: `1px solid ${a.component_id ? 'rgba(72,101,242,0.3)' : 'var(--border)'}` }}>
                  {/* Column name + stats */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{col}</div>
                      {stats && !stats.error && (
                        <div style={{ fontSize: '9px', color: 'var(--text-2)', marginTop: '1px' }}>
                          min {stats.min} · avg {stats.mean} · max {stats.max} · {stats.count} pts
                        </div>
                      )}
                    </div>
                    {a.component_id && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', background: 'rgba(72,101,242,0.15)', color: 'var(--accent)', border: '1px solid rgba(72,101,242,0.3)', display: 'flex', alignItems: 'center', gap: '2px' }}><Check size={9} /> assigned</span>}
                  </div>

                  {/* Row 1: Component selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-2)', display: 'block', marginBottom: '2px' }}>Component</label>
                      <select value={a.component_id || ''} onChange={e => setAssignments(prev => ({ ...prev, [col]: { ...prev[col], component_id: e.target.value } }))}
                        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', color: 'var(--text-0)', fontSize: '10px' }}>
                        <option value="">— not assigned —</option>
                        {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-2)', display: 'block', marginBottom: '2px' }}>KPI Name</label>
                      <input value={a.kpi_name || ''} onChange={e => setAssignments(prev => ({ ...prev, [col]: { ...prev[col], kpi_name: e.target.value } }))}
                        placeholder="e.g. Temperature"
                        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', color: 'var(--text-0)', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  {/* Row 2: Unit + thresholds */}
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', gap: '5px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-2)', display: 'block', marginBottom: '2px' }}>Unit</label>
                      <input value={a.unit || ''} onChange={e => setAssignments(prev => ({ ...prev, [col]: { ...prev[col], unit: e.target.value } }))}
                        placeholder="°C"
                        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', color: 'var(--text-0)', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    {[[<div style={{display:'flex', alignItems:'center', gap:'4px'}}><AlertTriangle size={10} color="#f59e0b" /> Warn ≥</div>, 'orange'], [<div style={{display:'flex', alignItems:'center', gap:'4px'}}><AlertOctagon size={10} color="#ef4444" /> Critical ≥</div>, 'red']].map(([label, key]) => (
                      <div key={key}>
                        <label style={{ fontSize: '9px', color: 'var(--text-2)', display: 'block', marginBottom: '2px' }}>{label}</label>
                        <input type="number" value={a.rules?.[key]?.[0] || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            const max = key === 'orange' ? (a.rules?.red?.[0] || 9999) : 9999;
                            setAssignments(prev => ({ ...prev, [col]: { ...prev[col], rules: { ...prev[col]?.rules, [key]: [val, max] } } }));
                          }}
                          placeholder="—"
                          style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px', color: 'var(--text-0)', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button onClick={() => setAssignments(prev => ({ ...prev, [col]: { ...prev[col], component_id: '', kpi_name: '', unit: '', rules: {} } }))}
                        style={{ width: '100%', padding: '5px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {error && <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '10px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>{error}</div>}
          </>
        )}

        {/* STEP 3: Live streaming */}
        {step === 'live' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}><Radio size={36} color="#10d98d" /></div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10d98d', marginBottom: '6px' }}>Streaming Live Data</div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '16px' }}>
              {assignedCount} KPI column{assignedCount !== 1 ? 's' : ''} streaming to your digital twin via WebSocket.<br/>
              Values update automatically in the KPI panel.
            </div>
            {/* Live assignments summary */}
            <div style={{ textAlign: 'left', marginBottom: '14px' }}>
              {Object.entries(assignments).filter(([_, a]) => a.component_id).map(([col, a]) => {
                const comp = components.find(c => c.id === a.component_id);
                return (
                  <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', marginBottom: '4px', borderRadius: '7px', background: 'var(--bg-0)', border: '1px solid var(--border)', fontSize: '10px' }}>
                    <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{col}</span>
                    <span style={{ color: 'var(--text-2)' }}>→</span>
                    <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{comp?.name || a.component_id}</span>
                    <span style={{ color: '#10d98d', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={10} /> {a.kpi_name} {a.unit && `(${a.unit})`}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('assign')}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Edit2 size={11} /> Edit Assignments
              </button>
              <button onClick={handleDisconnect}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <PowerOff size={11} /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {(step === 'assign') && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '8px' }}>
          <button onClick={() => setStep('upload')}
            style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={11} /> Re-upload
          </button>
          <button onClick={handleSave} disabled={assignedCount === 0 || loading}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: assignedCount > 0 ? 'linear-gradient(135deg,#4865f2,#f4723e)' : 'var(--bg-0)', border: 'none', color: assignedCount > 0 ? '#fff' : 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: assignedCount > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {loading ? <><Loader2 size={12} className="spin" /> Saving…</> : <><Play size={12} /> Start Streaming ({assignedCount} columns)</>}
          </button>
        </div>
      )}
    </div>
  );
}

function formatColName(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/ Pct$/, ' %').replace(/ C$/, ' °C').replace(/ H$/, '/h');
}

function guessUnit(col) {
  const l = col.toLowerCase();
  if (l.includes('_c')) return '°C';
  if (l.includes('_pct') || l.includes('_rate')) return '%';
  if (l.includes('_h') || l.includes('_per_h')) return '/h';
  if (l.includes('_min')) return 'min';
  if (l.includes('bar')) return 'bar';
  if (l.includes('persons') || l.includes('queue')) return 'persons';
  return '';
}
