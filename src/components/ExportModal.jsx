import React, { useState } from 'react';
import { Download, FileJson, Box, FileText, X } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, onExport, exporting }) {
    if (!isOpen) return null;

    const [exportJson, setExportJson] = useState(true);
    const [export3D, setExport3D] = useState(true);
    const [exportPdf, setExportPdf] = useState(false);

    const handleExport = () => {
        onExport({ exportJson, export3D, exportPdf });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: '16px', width: '400px', padding: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                animation: 'fadeInUp 0.2s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={20} /> Export Digital Twin
                    </h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', background: exportJson ? 'rgba(72,101,242,0.05)' : 'var(--bg-0)' }}>
                        <input type="checkbox" checked={exportJson} onChange={e => setExportJson(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        <FileJson size={20} style={{ color: '#f59e0b' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>JSON Data</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Configuration, components, and KPI states</div>
                        </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', background: export3D ? 'rgba(72,101,242,0.05)' : 'var(--bg-0)' }}>
                        <input type="checkbox" checked={export3D} onChange={e => setExport3D(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        <Box size={20} style={{ color: '#10d98d' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>3D Model</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Standard .glb file of the current 3D scene</div>
                        </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', background: exportPdf ? 'rgba(72,101,242,0.05)' : 'var(--bg-0)' }}>
                        <input type="checkbox" checked={exportPdf} onChange={e => setExportPdf(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                        <FileText size={20} style={{ color: '#ef4444' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>PDF Report (AI Generated)</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Professional PDF summary with AI analysis</div>
                        </div>
                    </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-1)', fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button 
                        onClick={handleExport} 
                        disabled={exporting || (!exportJson && !export3D && !exportPdf)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: (exporting || (!exportJson && !export3D && !exportPdf)) ? 0.6 : 1 }}
                    >
                        {exporting ? <><Download size={16} style={{ animation: 'bounce 1s infinite' }} /> Exporting…</> : 'Export Selection'}
                    </button>
                </div>
            </div>
        </div>
    );
}
