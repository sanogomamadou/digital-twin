import { useState } from 'react';
import useTwinStore, { DOMAINS } from '../store/useTwinStore';
import { ChevronRight, ArrowLeft, Check, Factory, Plane, Package } from 'lucide-react';

const DOMAIN_ICONS = { 
    factory: <Factory size={28} strokeWidth={1.5} />, 
    airport: <Plane size={28} strokeWidth={1.5} />, 
    warehouse: <Package size={28} strokeWidth={1.5} /> 
};

export default function FormStep() {
    const { setStep, setDomain, setTwinName, setDimensions, selectedDomain, twinName, width, length, initScene, createTwin } = useTwinStore();
    const [localName, setLocalName] = useState(twinName || '');
    const [localDomain, setLocalDomain] = useState(selectedDomain || '');
    const [localWidth, setLocalWidth] = useState(width || 60);
    const [localLength, setLocalLength] = useState(length || 40);

    const cellSize = 6;
    const gridCols = Math.ceil(localWidth / cellSize);
    const gridRows = Math.ceil(localLength / cellSize);
    const adjustedW = gridCols * cellSize;
    const adjustedL = gridRows * cellSize;

    const canProceed = localDomain && localName.trim() && localWidth > 0 && localLength > 0;

    const handleNext = () => {
        setDomain(localDomain);
        setTwinName(localName);
        setDimensions(localWidth, localLength);
        initScene();
        createTwin();
        setStep(2);
    };

    return (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
            <div style={{ width: '100%', maxWidth: '680px' }}>
                <div
                    className="animate-fade"
                    style={{ 
                        padding: '48px',
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-xl)',
                        boxShadow: 'var(--shadow-lg)'
                    }}
                >
                    <div style={{ marginBottom: '36px', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px', color: 'var(--text-0)' }}>
                            Configure Your Twin
                        </h2>
                        <p style={{ color: 'var(--text-1)', fontSize: '15px' }}>
                            Set the domain and spatial parameters to begin building your digital twin.
                        </p>
                    </div>

                    {/* Twin name */}
                    <div style={{ marginBottom: '28px' }}>
                        <label className="label">Twin Name</label>
                        <input
                            className="input"
                            placeholder="e.g. Main Production Floor"
                            value={localName}
                            onChange={e => setLocalName(e.target.value)}
                            style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '12px 16px' }}
                        />
                    </div>

                    {/* Domain selection */}
                    <div style={{ marginBottom: '28px' }}>
                        <label className="label">Domain</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {Object.entries(DOMAINS).map(([key, domain]) => (
                                <button
                                    key={key}
                                    onClick={() => setLocalDomain(key)}
                                    style={{
                                        padding: '20px 12px',
                                        borderRadius: '12px',
                                        border: localDomain === key
                                            ? `2px solid ${domain.color}`
                                            : '1px solid var(--border)',
                                        background: localDomain === key
                                            ? `rgba(${hexToRgb(domain.color)},0.05)`
                                            : 'var(--bg-1)',
                                        boxShadow: localDomain === key 
                                            ? `0 4px 24px rgba(${hexToRgb(domain.color)},0.15)` 
                                            : 'var(--shadow-sm)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s ease',
                                        position: 'relative',
                                    }}
                                >
                                    {localDomain === key && (
                                        <div style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            width: '20px', height: '20px', borderRadius: '50%',
                                            background: domain.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Check size={12} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                    <div style={{ color: localDomain === key ? domain.color : 'var(--text-2)' }}>
                                        {DOMAIN_ICONS[key]}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: localDomain === key ? 'var(--text-0)' : 'var(--text-1)' }}>
                                        {domain.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dimensions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                        <div>
                            <label className="label">Width (meters)</label>
                            <input
                                className="input"
                                type="number"
                                min={12}
                                value={localWidth}
                                onChange={e => setLocalWidth(Number(e.target.value))}
                                style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '12px 16px' }}
                            />
                        </div>
                        <div>
                            <label className="label">Length (meters)</label>
                            <input
                                className="input"
                                type="number"
                                min={12}
                                value={localLength}
                                onChange={e => setLocalLength(Number(e.target.value))}
                                style={{ background: 'var(--bg-3)', fontSize: '15px', padding: '12px 16px' }}
                            />
                        </div>
                    </div>

                    {/* Grid summary */}
                    {localWidth > 0 && localLength > 0 && (
                        <div
                            className="animate-fade"
                            style={{
                                padding: '16px 20px',
                                borderRadius: '12px',
                                background: 'rgba(72,101,242,0.05)',
                                border: '1px solid rgba(72,101,242,0.15)',
                                marginBottom: '32px',
                                display: 'flex',
                                gap: '32px',
                                flexWrap: 'wrap',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Adjusted Area</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)' }}>
                                    {adjustedW}m × {adjustedL}m
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Grid</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)' }}>
                                    {gridCols} × {gridRows} cells
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px', fontWeight: 500 }}>Cell Size</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)' }}>6m²</div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-ghost" onClick={() => setStep(0)} style={{ marginTop: '16px' }}>
                            <ArrowLeft size={18} />
                            Back
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleNext}
                            disabled={!canProceed}
                            style={{ 
                                marginTop: '16px',
                                opacity: canProceed ? 1 : 0.5, 
                                cursor: canProceed ? 'pointer' : 'not-allowed',
                                fontSize: '15px'
                            }}
                        >
                            Next: Place Components
                            <ChevronRight size={18} />
                        </button>
                    </div>
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
