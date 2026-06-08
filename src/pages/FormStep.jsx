import { useState } from 'react';
import useTwinStore, { DOMAINS } from '../store/useTwinStore';
import { ChevronRight, ArrowLeft, Check, Factory, Plane, Package, AlertTriangle } from 'lucide-react';

const DOMAIN_ICONS = { 
    factory: <Factory size={32} strokeWidth={1.5} />, 
    airport: <Plane size={32} strokeWidth={1.5} />, 
    warehouse: <Package size={32} strokeWidth={1.5} /> 
};

export default function FormStep() {
    const { setStep, setDomain, setTwinName, setDimensions, selectedDomain, twinName, width, length, initScene, createTwin, cellSize } = useTwinStore();
    const [localName, setLocalName] = useState(twinName || '');
    const [localDomain, setLocalDomain] = useState(selectedDomain || '');
    const [localWidth, setLocalWidth] = useState(width || 60);
    const [localLength, setLocalLength] = useState(length || 40);
    const gridCols = Math.ceil(localWidth / cellSize);
    const gridRows = Math.ceil(localLength / cellSize);
    const adjustedW = gridCols * cellSize;
    const adjustedL = gridRows * cellSize;

    const widthError = localWidth < 12;
    const lengthError = localLength < 12;
    const canProceed = localDomain && localName.trim() && !widthError && !lengthError;

    const handleNext = () => {
        setDomain(localDomain);
        setTwinName(localName);
        setDimensions(localWidth, localLength);
        initScene();
        createTwin();
        setStep(2);
    };

    const panelStyle = {
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '32px',
        width: '100%'
    };

    return (
        <div style={{ flex: 1, overflow: 'auto', padding: '40px 24px' }}>
            <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
                
                <div className="bento-grid animate-fade">
                    {/* LEFT COLUMN */}
                    <div className="bento-left-col">
                        
                        {/* Header Panel */}
                        <div style={{ ...panelStyle, padding: '32px 40px' }}>
                            <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px', color: 'var(--text-0)' }}>
                                Configure Your Twin
                            </h2>
                            <p style={{ color: 'var(--text-1)', fontSize: '15px' }}>
                                Set the domain and spatial parameters to begin building your digital twin.
                            </p>
                        </div>

                        {/* Identity Panel */}
                        <div style={panelStyle}>
                            <label className="label">Twin Name</label>
                            <input
                                className="input"
                                placeholder="e.g. Main Production Floor"
                                value={localName}
                                onChange={e => setLocalName(e.target.value)}
                                style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '14px 16px' }}
                            />
                        </div>

                        {/* Domain Panel */}
                        <div style={panelStyle}>
                            <label className="label">Primary Domain</label>
                            <p style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '20px' }}>Select the environment type to load appropriate components and KPIs.</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                {Object.entries(DOMAINS).map(([key, domain]) => (
                                    <button
                                        key={key}
                                        className={`domain-card ${localDomain === key ? 'selected' : ''}`}
                                        onClick={() => setLocalDomain(key)}
                                        style={{
                                            borderColor: localDomain === key ? domain.color : undefined,
                                            borderWidth: localDomain === key ? '2px' : undefined,
                                            background: localDomain === key ? `rgba(${hexToRgb(domain.color)},0.05)` : undefined,
                                        }}
                                    >
                                        {localDomain === key && (
                                            <div style={{
                                                position: 'absolute', top: '12px', right: '12px',
                                                width: '20px', height: '20px', borderRadius: '50%',
                                                background: domain.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Check size={12} color="#fff" strokeWidth={3} />
                                            </div>
                                        )}
                                        <div style={{ color: localDomain === key ? domain.color : 'var(--text-2)', transition: 'color 0.2s' }}>
                                            {DOMAIN_ICONS[key]}
                                        </div>
                                        <span style={{ fontSize: '15px', fontWeight: 600, color: localDomain === key ? 'var(--text-0)' : 'var(--text-1)' }}>
                                            {domain.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="bento-right-col">
                        
                        {/* Dimensions Panel */}
                        <div style={panelStyle}>
                            <label className="label" style={{ marginBottom: '16px' }}>Spatial Dimensions</label>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '8px', fontWeight: 500 }}>Width (meters)</div>
                                    <input
                                        className={`input ${widthError ? 'error' : ''}`}
                                        type="number"
                                        min={12}
                                        value={localWidth}
                                        onChange={e => setLocalWidth(Number(e.target.value))}
                                        style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '14px 16px' }}
                                    />
                                    {widthError && <div className="error-text"><AlertTriangle size={12} /> Minimum 12m</div>}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '8px', fontWeight: 500 }}>Length (meters)</div>
                                    <input
                                        className={`input ${lengthError ? 'error' : ''}`}
                                        type="number"
                                        min={12}
                                        value={localLength}
                                        onChange={e => setLocalLength(Number(e.target.value))}
                                        style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '14px 16px' }}
                                    />
                                    {lengthError && <div className="error-text"><AlertTriangle size={12} /> Minimum 12m</div>}
                                </div>
                            </div>
                        </div>

                        {/* Grid Summary Panel */}
                        <div style={{ ...panelStyle, background: 'var(--bg-0)', border: 'none' }}>
                            <label className="label" style={{ marginBottom: '20px' }}>Simulation Grid</label>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Adjusted Area</div>
                                    <div style={{ 
                                        fontSize: '28px', 
                                        fontWeight: 900, 
                                        background: 'linear-gradient(135deg, var(--accent), var(--orange))',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        letterSpacing: '-0.02em',
                                        display: 'inline-block'
                                    }}>
                                        {adjustedW}m × {adjustedL}m
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                    <div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Grid Size</div>
                                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-0)' }}>
                                            {gridCols} × {gridRows}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Resolution</div>
                                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-0)' }}>{cellSize * cellSize}m² / cell</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Actions Footer */}
                <div className="animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-ghost" onClick={() => setStep(0)}>
                        <ArrowLeft size={18} />
                        Back to Home
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleNext}
                        disabled={!canProceed}
                        style={{ 
                            opacity: canProceed ? 1 : 0.5, 
                            cursor: canProceed ? 'pointer' : 'not-allowed',
                            fontSize: '15px',
                            padding: '16px 32px'
                        }}
                    >
                        Save & Place Components
                        <ChevronRight size={18} />
                    </button>
                </div>

            </div>
        </div>
    );
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
        : '99,149,255';
}
