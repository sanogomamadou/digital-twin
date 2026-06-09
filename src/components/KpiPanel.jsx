import { useState } from 'react';
import useTwinStore from '../store/useTwinStore';
import { Activity, FolderOpen, Loader2, Link2 } from 'lucide-react';

const STATUS_COLOR = { green: '#10d98d', orange: '#f59e0b', red: '#ef4444' };
const STATUS_LABEL = { green: 'NORMAL', orange: 'WARNING', red: 'CRITICAL' };

export default function KpiPanel() {
  const { kpis, kpiAssignments, components, selectedComponentId, selectComponent, setStep } = useTwinStore();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const hasAssignments = kpiAssignments && kpiAssignments.length > 0;

  const selectedComp = components.find(c => c.id === selectedComponentId);

  // Filter KPIs — if component selected show only its KPIs
  const baseKpis = selectedComp
    ? kpis.filter(k => selectedComp.kpiIds?.includes(k.id))
    : kpis;

  const filteredKpis = baseKpis.filter(k => {
    const matchFilter = filter === 'all' || k.status === filter;
    const matchSearch = !search || k.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const critCount = kpis.filter(k => k.status === 'red').length;
  const warnCount = kpis.filter(k => k.status === 'orange').length;
  const okCount   = kpis.filter(k => k.status === 'green').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} color="var(--accent)" /> KPI Monitor</span>
          {selectedComp && (
            <button onClick={() => selectComponent(null)}
              style={{ fontSize: '10px', color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ✕ {selectedComp.name}
            </button>
          )}
        </div>

        {/* Summary badges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
          {[['green', okCount, 'Normal'], ['orange', warnCount, 'Warning'], ['red', critCount, 'Critical']].map(([status, count, label]) => (
            <div key={status} onClick={() => setFilter(filter === status ? 'all' : status)}
              style={{ padding: '6px', textAlign: 'center', border: `1px solid ${STATUS_COLOR[status]}${filter === status ? '80' : '30'}`, borderRadius: '8px', background: `${STATUS_COLOR[status]}${filter === status ? '20' : '10'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: STATUS_COLOR[status], lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search KPIs…"
          style={{ width: '100%', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '7px', padding: '6px 10px', color: 'var(--text-0)', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Selected component info bar */}
      {selectedComp && (
        <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(72,101,242,0.05)', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>{selectedComp.name}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
            {selectedComp.type?.replace(/_/g, ' ')} · {selectedComp.kpiIds?.length || 0} KPI{selectedComp.kpiIds?.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* KPI list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>

        {/* Empty state — waiting for live data (has assignments) */}
        {kpis.length === 0 && hasAssignments && (
          <div style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Loader2 size={28} color="var(--accent)" className="spin" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px' }}>Waiting for live data…</div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '12px' }}>
              {kpiAssignments.length} KPI assignment{kpiAssignments.length !== 1 ? 's' : ''} configured. Connecting to the data stream…
            </div>
          </div>
        )}

        {/* Empty state — no assignments at all */}
        {kpis.length === 0 && !hasAssignments && (
          <div style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <FolderOpen size={28} color="var(--text-3)" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px' }}>No data source connected</div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '12px' }}>
              Upload a file and assign KPI columns to components in the KPI Setup step.
            </div>
            <button onClick={() => setStep(4)}
              style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg,#4865f2,#f4723e)', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              ← Go to KPI Setup
            </button>
          </div>
        )}

        {/* Component has no assigned KPIs */}
        {kpis.length > 0 && selectedComp && baseKpis.length === 0 && (
          <div style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Link2 size={22} color="var(--text-3)" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>{selectedComp.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '10px' }}>
              No KPI columns were assigned to this component.
            </div>
            <button onClick={() => setStep(4)}
              style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(72,101,242,0.15)', border: '1px solid rgba(72,101,242,0.3)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              ← KPI Setup to assign
            </button>
          </div>
        )}

        {/* KPI cards with live pulse on critical */}
        {filteredKpis.map(kpi => {
          const color = STATUS_COLOR[kpi.status] || '#4865f2';
          const compNames = components.filter(c => c.kpiIds?.includes(kpi.id)).map(c => c.name);
          return (
            <div key={kpi.id}
              style={{ marginBottom: '8px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-0)', border: `1px solid ${color}25`, position: 'relative', overflow: 'hidden' }}>
              {kpi.status === 'red' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.04)', animation: 'pulse-kpi 1.5s ease-in-out infinite', pointerEvents: 'none' }} />
              )}

              {/* Name + status badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-0)' }}>{kpi.name}</div>
                  {compNames.length > 0 && (
                    <div style={{ fontSize: '9px', color: 'var(--text-2)', marginTop: '1px' }}>{compNames.join(', ')}</div>
                  )}
                </div>
                <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '10px', background: `${color}20`, color, fontWeight: 700, flexShrink: 0, border: `1px solid ${color}40` }}>
                  {STATUS_LABEL[kpi.status] || kpi.status}
                </span>
              </div>

              {/* Value */}
              <div style={{ fontSize: '22px', fontWeight: 800, color, lineHeight: 1, marginBottom: '6px' }}>
                {typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value}
                <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '4px', color: 'var(--text-2)' }}>{kpi.unit}</span>
              </div>

              {/* Threshold bar */}
              <KpiBar value={kpi.value} rules={kpi.rules} color={color} />

              {/* Threshold legend */}
              {kpi.rules && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' }}>
                  {Object.entries(kpi.rules)
                    .filter(([, range]) => Array.isArray(range) && range.length >= 2 && range[0] != null)
                    .map(([s, [lo, hi]]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'var(--text-2)' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '1px', background: STATUS_COLOR[s] || '#888' }} />
                      {lo}{hi !== 9999 ? `–${hi}` : '+'} {kpi.unit}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* No filter match */}
        {kpis.length > 0 && filteredKpis.length === 0 && baseKpis.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-2)', fontSize: '12px' }}>
            No KPIs match the current filter.
          </div>
        )}
      </div>

      <style>{`@keyframes pulse-kpi{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}

function KpiBar({ value, rules, color }) {
  // Safely get threshold bounds, skip null entries
  const validRanges = Object.values(rules || {})
    .filter(r => Array.isArray(r) && r[0] != null);
  if (validRanges.length === 0) return null;

  const allVals = validRanges.flat().filter(v => v != null && v !== 9999);
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals, value, 1);
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div style={{ height: '4px', background: 'var(--bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
    </div>
  );
}
