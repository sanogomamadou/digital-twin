import { useState, useEffect } from 'react';
import useTwinStore, { DOMAINS } from '../store/useTwinStore';
import { Play, Layers, Sparkles, Eye, Pencil, Trash2, Save, RefreshCw, AlertCircle, X, Share2, Copy } from 'lucide-react';
import ConnectionWizard from '../components/ConnectionWizard';

const DOMAIN_ICONS = { factory: '🏭', airport: '✈️', warehouse: '📦' };
const DOMAIN_DESCS = {
    factory: 'Monitor production lines, machines & manufacturing flows in real time',
    airport: 'Track terminals, gates, runways & passenger flows with live KPIs',
    warehouse: 'Manage racks, picking zones, docks & logistics flows efficiently',
};
const DOMAIN_COLORS = { factory: '#f97316', airport: '#06b6d4', warehouse: '#84cc16' };

function ConfirmModal({ twin, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div className="glass" style={{
                padding: '32px', borderRadius: '20px', width: '360px',
                border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={20} color="#ef4444" />
                    </div>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)' }}>Delete Twin</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>This action cannot be undone</div>
                    </div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '24px', lineHeight: 1.6 }}>
                    Are you sure you want to permanently delete <strong style={{ color: 'var(--text-0)' }}>{twin.name}</strong>?
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: '13px' }}>
                        <X size={14} /> Cancel
                    </button>
                    <button className="btn" onClick={onConfirm}
                        style={{ fontSize: '13px', background: '#ef4444', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function TwinCard({ twin, onLoad, onEdit, onDelete, onRename }) {
    const [hovered, setHovered] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(twin.name);
    const color = DOMAIN_COLORS[twin.domain] || '#4865f2';
    const updatedAt = twin.updatedAt ? new Date(twin.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const handleRenameSubmit = async () => {
        if (editName && editName !== twin.name) {
            await onRename(twin.id, editName);
        }
        setIsRenaming(false);
    };

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative', borderRadius: '16px', overflow: 'hidden',
                border: `1px solid ${hovered ? color + '66' : 'var(--border)'}`,
                background: 'var(--surface-1)',
                boxShadow: hovered ? `0 8px 32px ${color}22` : '0 2px 8px rgba(0,0,0,0.12)',
                transition: 'all 0.25s ease',
                transform: hovered ? 'translateY(-4px)' : 'none',
                display: 'flex', flexDirection: 'column',
            }}
        >
            {/* Color band top */}
            <div style={{ height: '4px', background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

            {/* Card body */}
            <div style={{ padding: '20px', flex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px', flexShrink: 0,
                    }}>
                        {DOMAIN_ICONS[twin.domain] || '🏗️'}
                    </div>
                    <span style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: color, background: `${color}18`, padding: '3px 8px', borderRadius: '6px',
                    }}>
                        {twin.domain}
                    </span>
                </div>

                {/* Name */}
                <div style={{ marginBottom: '6px', minHeight: '20px' }}>
                    {isRenaming ? (
                        <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameSubmit();
                                if (e.key === 'Escape') { setEditName(twin.name); setIsRenaming(false); }
                            }}
                            style={{
                                fontSize: '15px', fontWeight: 700, color: 'var(--text-0)',
                                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                                borderRadius: '4px', padding: '2px 6px', width: '100%', outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)', lineHeight: 1.3, wordBreak: 'break-word', paddingRight: '8px' }}>
                                {twin.name}
                            </div>
                            <button
                                onClick={() => setIsRenaming(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 0, flexShrink: 0 }}
                                title="Rename twin"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Metadata */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                        📐 {twin.width}m × {twin.length}m
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                        🔲 {twin.gridCols}×{twin.gridRows}
                    </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <span className="tag" style={{ fontSize: '10px' }}>
                        {twin.componentCount ?? 0} components
                    </span>
                    <span className="tag" style={{ fontSize: '10px' }}>
                        {twin.connectionCount ?? 0} connections
                    </span>
                </div>

                {/* Date */}
                <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                    Updated {updatedAt}
                </div>
            </div>

            {/* Action footer */}
            <div style={{
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)',
            }}>
                <button
                    className="btn btn-primary"
                    onClick={() => onLoad(twin.id)}
                    style={{ flex: 1, fontSize: '12px', padding: '7px 10px', gap: '5px' }}
                >
                    <Eye size={13} /> View
                </button>
                <button
                    className="btn btn-ghost"
                    onClick={() => onEdit(twin.id)}
                    title="Edit twin"
                    style={{ fontSize: '12px', padding: '7px 12px', gap: '5px' }}
                >
                    <Pencil size={13} /> Edit
                </button>
                <button
                    onClick={() => onDelete(twin)}
                    title="Delete twin"
                    style={{
                        padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'transparent', color: '#ef4444', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px',
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
}

export default function HomePage() {
    const { setStep, loadDemo, twins, fetchTwins, loadTwinFromDb, deleteTwinFromDb, renameTwinDb, shareLinks, fetchShareLinks, deleteShareLink } = useTwinStore();
    const [loading, setLoading] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const [copiedLink, setCopiedLink] = useState(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchTwins(), fetchShareLinks()]).finally(() => setLoading(false));
    }, []);

    const handleLoad = async (twinId) => {
        setActionLoading(twinId);
        try {
            await loadTwinFromDb(twinId, 5);
        } catch {
            setError('Failed to load twin. Is the backend running?');
        } finally {
            setActionLoading(null);
        }
    };

    const handleEdit = async (twinId) => {
        setActionLoading(twinId);
        try {
            await loadTwinFromDb(twinId, 2);
        } catch {
            setError('Failed to load twin for editing.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!toDelete) return;
        try {
            await deleteTwinFromDb(toDelete.id);
        } catch {
            setError('Failed to delete twin.');
        } finally {
            setToDelete(null);
        }
    };

    const handleRename = async (id, newName) => {
        setActionLoading(id);
        try {
            await renameTwinDb(id, newName);
        } catch {
            setError('Failed to rename twin.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Confirmation modal */}
            {toDelete && (
                <ConfirmModal
                    twin={toDelete}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setToDelete(null)}
                />
            )}

            {/* Error toast */}
            {error && (
                <div style={{
                    position: 'fixed', top: '80px', right: '24px', zIndex: 999,
                    background: '#ef4444', color: '#fff', padding: '12px 20px',
                    borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px',
                    boxShadow: '0 8px 24px rgba(239,68,68,0.4)',
                }}>
                    <AlertCircle size={16} />
                    {error}
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, marginLeft: '4px' }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Hero */}
            <div style={{
                padding: '80px 60px 60px',
                background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(72,101,242,0.08) 0%, transparent 70%)',
                borderBottom: '1px solid var(--border)',
                textAlign: 'center',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <span className="badge badge-blue" style={{ padding: '6px 16px', fontSize: '12px' }}>
                        <Sparkles size={12} />
                        DXC Technology · Intelligent Analytics
                    </span>
                </div>
                <h1 style={{
                    fontSize: 'clamp(36px,5vw,64px)', fontWeight: 900, lineHeight: 1.05,
                    letterSpacing: '-0.03em', marginBottom: '20px',
                    background: 'linear-gradient(135deg, #f0f4ff 0%, #94a3c8 50%, #4865f2 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                    3D Digital Twin<br />Platform
                </h1>
                <p style={{ fontSize: '18px', color: 'var(--text-1)', maxWidth: '540px', margin: '0 auto 40px', lineHeight: 1.6 }}>
                    Create agnostic real-time 3D digital twins for factories, airports and
                    warehouses — with live KPI monitoring and AI-assisted placement.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-lg" onClick={() => setStep(1)}>
                        <Play size={18} /> Create New Twin
                    </button>
                    <button className="btn btn-ghost btn-lg" onClick={() => { loadDemo(); setStep(5); }}>
                        <Layers size={18} /> View Live Demo
                    </button>
                </div>
            </div>

            {/* Connection Wizard */}
            <div style={{ padding: '48px 60px 0' }}>
                <ConnectionWizard />
            </div>

            {/* Saved twins */}
            <div style={{ padding: '48px 60px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Saved Digital Twins
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                            {loading ? 'Loading…' : twins.length === 0 ? 'No twins saved yet — create your first one above.' : `${twins.length} twin${twins.length > 1 ? 's' : ''} saved`}
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => { setLoading(true); fetchTwins().finally(() => setLoading(false)); }}
                        style={{ fontSize: '12px', gap: '6px' }}
                        disabled={loading}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>

                {twins.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '48px' }}>
                        {twins.map(twin => (
                            <div key={twin.id} style={{ position: 'relative' }}>
                                {actionLoading === twin.id && (
                                    <div style={{
                                        position: 'absolute', inset: 0, zIndex: 10, borderRadius: '16px',
                                        background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <RefreshCw size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                                    </div>
                                )}
                                <TwinCard
                                    twin={twin}
                                    onLoad={handleLoad}
                                    onEdit={handleEdit}
                                    onDelete={setToDelete}
                                    onRename={handleRename}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div className="divider" style={{ marginBottom: '40px' }} />

                {/* Share Links */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Active Share Links
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                            {loading ? 'Loading…' : shareLinks.length === 0 ? 'No active share links.' : `${shareLinks.length} active link${shareLinks.length > 1 ? 's' : ''}`}
                        </div>
                    </div>
                </div>

                {shareLinks.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '48px' }}>
                        {shareLinks.map(link => {
                            const linkUrl = `${window.location.origin}/live/${link.id}`;
                            const isCopied = copiedLink === link.id;
                            const relatedTwin = twins.find(t => t.id === link.twin_id);
                            
                            return (
                                <div key={link.id} style={{ 
                                    padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', 
                                    background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', gap: '12px' 
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-0)' }}>{link.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Twin: {relatedTwin ? relatedTwin.name : 'Unknown'}</div>
                                        </div>
                                        <button 
                                            onClick={() => deleteShareLink(link.id)}
                                            style={{ 
                                                background: 'none', border: 'none', color: '#ef4444', 
                                                cursor: 'pointer', padding: '4px', borderRadius: '6px' 
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            title="Delete Share Link"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    <div style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', 
                                        background: 'var(--bg-0)', borderRadius: '8px', border: '1px solid var(--border)' 
                                    }}>
                                        <div style={{ flex: 1, fontSize: '11px', color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {linkUrl}
                                        </div>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(linkUrl);
                                                setCopiedLink(link.id);
                                                setTimeout(() => setCopiedLink(null), 2000);
                                            }}
                                            style={{ 
                                                background: isCopied ? '#10d98d' : 'transparent', 
                                                color: isCopied ? '#fff' : 'var(--text-2)', 
                                                border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
                                                fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            <Copy size={12} /> {isCopied ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="divider" style={{ marginBottom: '40px' }} />

                {/* Supported domains */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '24px' }}>
                    Supported Domains
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '48px' }}>
                    {Object.entries(DOMAINS).map(([key, domain]) => (
                        <button
                            key={key}
                            className="glass"
                            onClick={() => setStep(1)}
                            style={{
                                padding: '28px', textAlign: 'left', cursor: 'pointer',
                                border: '1px solid var(--border)', borderRadius: '16px',
                                background: 'rgba(255,255,255,0.5)', transition: 'all 0.25s ease',
                                position: 'relative', overflow: 'hidden',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = domain.color + '55';
                                e.currentTarget.style.transform = 'translateY(-3px)';
                                e.currentTarget.style.boxShadow = `0 8px 32px ${domain.color}22`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                                background: `radial-gradient(circle at top right, ${domain.color}22, transparent)`,
                                borderRadius: '0 0 0 80px',
                            }} />
                            <div style={{ fontSize: '36px', marginBottom: '14px' }}>{DOMAIN_ICONS[key]}</div>
                            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '8px' }}>{domain.label}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.5, marginBottom: '16px' }}>{DOMAIN_DESCS[key]}</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {domain.components.slice(0, 3).map(c => (
                                    <span key={c.type} className="tag" style={{ fontSize: '10px' }}>{c.name}</span>
                                ))}
                                <span className="tag" style={{ fontSize: '10px' }}>+{Math.max(0, domain.components.length - 3)} more</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Feature pills */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '20px' }}>
                    Platform Features
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                        '🎯 Drag & Drop Placement',
                        '🤖 AI-Assisted Prompts',
                        '📊 Real-Time KPI Monitoring',
                        '🔗 Component Connections',
                        '⚡ Data Adapters (SQL, REST, MQTT)',
                        '📐 Blueprint Catalog',
                        '🔄 Auto-Save & Versioning',
                        '📸 High-Res Screenshots',
                    ].map(f => (
                        <span key={f} className="glass-subtle" style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-1)', borderRadius: '100px' }}>
                            {f}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
