import { useState, useEffect } from 'react';
import useTwinStore, { DOMAINS } from '../store/useTwinStore';
import Grid2D from '../components/Grid2D';
import Scene3D from '../components/Scene3D';
import { layoutPrompt, saveLayoutState, checkBackendHealth, getLayoutSuggestions } from '../services/api';
import { Bot, Plus, Minus, Monitor, DoorClosed, Plane, Briefcase, Lock, BaggageClaim, Settings, Package, PenTool, Search, Box, Truck, Inbox, ArrowUpSquare, Loader2, Play, AlertTriangle, CheckCircle2, Sparkles, LayoutGrid, Hexagon } from 'lucide-react';

const VIEWS = ['2D Grid', '3D Preview', 'Split'];

export default function GridStep() {
  const { selectedDomain, components, connections, kpis, gridCols, gridRows, minCols, minRows, cellSize,
          setStep, addComponent, moveComponent, twinName, selectComponent, resizeGrid } = useTwinStore();

  const [view, setView] = useState('Split');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);
  const [showAiBar, setShowAiBar] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const domain = DOMAINS[selectedDomain];
  const blueprints = domain?.components || [];

  const [aiSuggestions, setAiSuggestions] = useState([]);

  useEffect(() => {
    checkBackendHealth().then(online => {
      setBackendOnline(online);
      if (online) {
        getLayoutSuggestions(selectedDomain).then(setAiSuggestions).catch(() => {});
      }
    });
  }, [selectedDomain]);

  const handleAdd = (type) => {
    addComponent(type);
    setJustAdded(type);
    setTimeout(() => setJustAdded(null), 1200);
  };

  const handleAiPrompt = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResult(null);

    const currentState = {
      id: 'default',
      name: twinName || 'Digital Twin',
      domain: selectedDomain || 'factory',
      gridCols: gridCols || 10,
      gridRows: gridRows || 8,
      components: components.map(c => ({ id: c.id, name: c.name, type: c.type, row: c.row, col: c.col, gridSize: c.gridSize, color: c.color, kpiIds: c.kpiIds || [] })),
      connections: connections.map(c => ({ id: c.id, sourceId: c.sourceId, targetId: c.targetId, label: c.label || '', flowStatus: c.flowStatus || 'green' })),
    };

    try {
      const result = await layoutPrompt(aiPrompt, currentState);
      const store = useTwinStore.getState();
      let customCount = 0;

      result.newState.components.forEach(comp => {
        const existing = components.find(c => c.id === comp.id);
        if (!existing) {
          const isStandard = blueprints.some(b => b.type === comp.type);
          // Pass ALL extra fields for custom components
          store.addComponent(comp.type, {
            row: comp.row, col: comp.col,
            name: isStandard ? undefined : comp.name, 
            color: isStandard ? undefined : comp.color,
            gridSize: isStandard ? undefined : comp.gridSize,
            isCustom: comp.isCustom || false,
            icon: comp.icon || '',
            description: comp.description || '',
            mesh3D: comp.mesh3D || null,
          });
          if (comp.isCustom) customCount++;
        } else if (existing.row !== comp.row || existing.col !== comp.col) {
          store.moveComponent(comp.id, comp.col, comp.row);
        }
      });

      // Remove deleted components
      components.forEach(c => {
        if (!result.newState.components.find(nc => nc.id === c.id)) {
          useTwinStore.getState().removeComponent?.(c.id);
        }
      });

      setAiResult({
        explanation: result.explanation,
        actionsCount: result.actions.length,
        customCount,
      });
      setAiPrompt('');
    } catch (e) {
      // Fallback: basic offline parsing for palette types only
      const p = aiPrompt.toLowerCase();
      blueprints.forEach(bp => {
        if (p.includes(bp.type.replace('_', ' ')) || p.includes(bp.name.toLowerCase())) {
          const count = parseInt(p.match(/(\d+)/)?.[1] || '1');
          for (let i = 0; i < Math.min(count, 4); i++) handleAdd(bp.type);
        }
      });
      setAiResult({ explanation: `Backend offline — offline parsing applied.`, actionsCount: 0, error: true });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
        
        {/* Component palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap', paddingRight: '16px', borderRight: '1px solid var(--border)' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>+ Add</span>
          {blueprints.map(bp => (
            <button key={bp.type} onClick={() => handleAdd(bp.type)} title={`Add ${bp.name}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.2s ease',
                background: justAdded === bp.type ? `${bp.color}15` : 'var(--bg-0)',
                border: `1px solid ${justAdded === bp.type ? bp.color : 'var(--border)'}`,
                color: justAdded === bp.type ? bp.color : 'var(--text-1)',
                transform: justAdded === bp.type ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background=`${bp.color}15`; e.currentTarget.style.borderColor=bp.color; e.currentTarget.style.color=bp.color; }}
              onMouseLeave={e => { if(justAdded!==bp.type){ e.currentTarget.style.background='var(--bg-0)'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-1)'; }}}>
              <span style={{ display: 'flex', alignItems: 'center' }}>{getIcon(bp.type)}</span>{bp.name}
            </button>
          ))}
        </div>

        {/* Tools container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-2)', borderRadius: '6px', padding: '3px', flexShrink: 0 }}>
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s', background: view === v ? 'var(--bg-1)' : 'transparent', color: view === v ? 'var(--text-0)' : 'var(--text-2)', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{v}</button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          {/* AI Prompt toggle */}
          <button onClick={() => setShowAiBar(p => !p)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease',
            background: showAiBar ? 'var(--accent-dim)' : 'var(--bg-0)',
            color: showAiBar ? 'var(--accent)' : 'var(--text-1)' }}>
            <Bot size={16} /> AI Layout
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: backendOnline === true ? 'rgba(16,217,141,0.15)' : backendOnline === null ? 'transparent' : 'rgba(245,158,11,0.15)', color: backendOnline === true ? '#10d98d' : backendOnline === null ? 'var(--text-2)' : '#f59e0b' }}>
              {backendOnline === true ? 'live' : backendOnline === null ? '...' : 'mock'}
            </span>
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          <div style={{ padding: '5px 10px', borderRadius: '6px', background: 'var(--accent-dim)', border: '1px solid rgba(72,101,242,0.2)', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
            {components.length} components
          </div>
        </div>
      </div>

      {/* AI Prompt Bar */}
      {showAiBar && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(72,101,242,0.03)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ paddingTop: '4px', color: 'var(--accent)' }}><Bot size={18} /></div>
            <div style={{ flex: 1 }}>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiPrompt(); }}}
                placeholder='Describe layout changes, e.g. "Add 3 conveyor belts next to the shipping dock" or "Move Assembly Station to row 2, col 5"'
                rows={2}
                style={{ width: '100%', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text-0)', fontSize: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              {/* Quick example prompts */}
              <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                {(aiSuggestions.length > 0 ? aiSuggestions : [
                  `Add a component`,
                  `Connect all components in sequence`,
                ]).map(ex => (
                  <button key={ex} onClick={() => setAiPrompt(ex)}
                    style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(72,101,242,0.07)', border: '1px solid rgba(72,101,242,0.15)', color: 'var(--text-2)', cursor: 'pointer' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAiPrompt} disabled={!aiPrompt.trim() || aiLoading}
              style={{ padding: '9px 18px', borderRadius: '8px', background: 'linear-gradient(135deg,#4865f2,#f4723e)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: aiPrompt.trim() ? 'pointer' : 'not-allowed', opacity: aiPrompt.trim() ? 1 : 0.5, flexShrink: 0 }}>
              {aiLoading ? <Loader2 size={12} className="spin" /> : <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={12} /> Run</div>}
            </button>
          </div>
          {aiResult && (
            <div style={{ marginTop: '6px', padding: '7px 12px', borderRadius: '7px', fontSize: '11px',
              background: aiResult.error ? 'rgba(245,158,11,0.08)' : 'rgba(16,217,141,0.08)',
              border: `1px solid ${aiResult.error ? 'rgba(245,158,11,0.25)' : 'rgba(16,217,141,0.25)'}`,
              color: aiResult.error ? '#f59e0b' : '#10d98d' }}>
              {aiResult.error ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {aiResult.explanation}
              {aiResult.actionsCount > 0 && ` (${aiResult.actionsCount} action${aiResult.actionsCount > 1 ? 's' : ''} applied)`}
              {aiResult.customCount > 0 && (
                <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '8px', background: 'rgba(168,85,247,0.2)', color: '#a855f7', fontSize: '10px', fontWeight: 700 }}>
                  <Sparkles size={10} /> {aiResult.customCount} custom 3D component{aiResult.customCount > 1 ? 's' : ''} generated
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* 2D Grid pane */}
        {(view === '2D Grid' || view === 'Split') && (
          <div style={{ flex: view === 'Split' ? '0 0 50%' : '1', borderRight: view === 'Split' ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '4px' }}><LayoutGrid size={12} /> 2D EDITOR</span>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span>Drag to reposition</span>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>Area Size:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Width 
                    <button onClick={() => resizeGrid(gridCols - 1, gridRows)} disabled={gridCols <= minCols} style={{ background: 'var(--bg-1)', opacity: gridCols <= minCols ? 0.5 : 1, border: '1px solid var(--border)', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: gridCols <= minCols ? 'not-allowed' : 'pointer', color: 'var(--text-0)', padding: 0, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease' }} onMouseEnter={e => {if(gridCols>minCols) e.currentTarget.style.borderColor='var(--accent)'}} onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)'}}><Minus size={12} /></button>
                    <span style={{ fontWeight: 600, color: 'var(--text-0)', minWidth: '16px', textAlign: 'center' }}>{gridCols}</span>
                    <button onClick={() => resizeGrid(gridCols + 1, gridRows)} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-0)', padding: 0, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease' }} onMouseEnter={e => {e.currentTarget.style.borderColor='var(--accent)'}} onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)'}}><Plus size={12} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Height
                    <button onClick={() => resizeGrid(gridCols, gridRows - 1)} disabled={gridRows <= minRows} style={{ background: 'var(--bg-1)', opacity: gridRows <= minRows ? 0.5 : 1, border: '1px solid var(--border)', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: gridRows <= minRows ? 'not-allowed' : 'pointer', color: 'var(--text-0)', padding: 0, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease' }} onMouseEnter={e => {if(gridRows>minRows) e.currentTarget.style.borderColor='var(--accent)'}} onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)'}}><Minus size={12} /></button>
                    <span style={{ fontWeight: 600, color: 'var(--text-0)', minWidth: '16px', textAlign: 'center' }}>{gridRows}</span>
                    <button onClick={() => resizeGrid(gridCols, gridRows + 1)} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-0)', padding: 0, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease' }} onMouseEnter={e => {e.currentTarget.style.borderColor='var(--accent)'}} onMouseLeave={e => {e.currentTarget.style.borderColor='var(--border)'}}><Plus size={12} /></button>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}><Grid2D /></div>
          </div>
        )}

        {/* 3D Preview pane */}
        {(view === '3D Preview' || view === 'Split') && (
          <div style={{ flex: view === 'Split' ? '0 0 50%' : '1', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '4px' }}><Hexagon size={12} /> 3D PREVIEW</span>
              <span style={{ fontSize: '10px', color: 'var(--text-2)' }}>Orbit · Scroll zoom · Ctrl+drag to move</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}><Scene3D /></div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
        <button className="btn btn-primary" onClick={() => setStep(3)}>Next: Connections →</button>
      </div>
    </div>
  );
}

function getIcon(type) {
  const size = 14;
  switch (type) {
    case 'terminal': return <Monitor size={size} />;
    case 'gate': return <DoorClosed size={size} />;
    case 'runway': return <Plane size={size} />;
    case 'checkin_desk': return <Briefcase size={size} />;
    case 'security_zone': return <Lock size={size} />;
    case 'baggage_claim': return <BaggageClaim size={size} />;
    case 'hydraulic_press': return <Settings size={size} />;
    case 'conveyor_belt': return <Package size={size} />;
    case 'cnc_machine': return <Settings size={size} />;
    case 'assembly_station': return <PenTool size={size} />;
    case 'quality_control': return <Search size={size} />;
    case 'warehouse_rack':
    case 'storage_rack': return <Box size={size} />;
    case 'picking_zone': return <Truck size={size} />;
    case 'reception_dock': return <Inbox size={size} />;
    case 'shipping_dock': return <ArrowUpSquare size={size} />;
    case 'conveyor': return <Package size={size} />;
    case 'sorter': return <Settings size={size} />;
    default: return <Box size={size} />;
  }
}
