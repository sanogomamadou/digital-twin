import { useState, useEffect } from 'react';
import useTwinStore, { DOMAINS } from '../store/useTwinStore';
import { Play, Layers, Sparkles, Eye, Pencil, Trash2, RefreshCw, AlertCircle, X, Share2, Copy, Search, LayoutGrid, Monitor } from 'lucide-react';
import ConnectionWizard from '../components/ConnectionWizard';

const DOMAIN_ICONS = { factory: '🏭', airport: '✈️', warehouse: '📦' };
const DOMAIN_DESCS = {
    factory: 'Monitor production lines, machines & manufacturing flows in real time',
    airport: 'Track terminals, gates, runways & passenger flows with live KPIs',
    warehouse: 'Manage racks, picking zones, docks & logistics flows efficiently',
};
const DOMAIN_COLORS = { factory: '#f4723e', airport: '#4865f2', warehouse: '#10d98d' };

function ConfirmModal({ twin, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: 'var(--bg-1)', padding: '32px', borderRadius: '16px', width: '400px',
                border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ 
                        width: '40px', height: '40px', borderRadius: '10px', 
                        background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <AlertCircle size={20} color="#ef4444" />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '4px' }}>Delete Twin</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.5 }}>
                            Are you sure you want to permanently delete <strong>{twin.name}</strong>? This action cannot be undone.
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="btn" onClick={onConfirm}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 500 }}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function TwinListItem({ twin, onLoad, onEdit, onDelete, onRename }) {
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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: '12px',
                background: hovered ? 'var(--bg-0)' : 'transparent',
                border: '1px solid',
                borderColor: hovered ? 'rgba(72,101,242,0.15)' : 'transparent',
                transition: 'all 0.15s ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0, border: `1px solid ${color}30`
                }}>
                    {DOMAIN_ICONS[twin.domain] || '🏗️'}
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                                fontSize: '14px', fontWeight: 600, color: 'var(--text-0)',
                                background: 'var(--bg-1)', border: '1px solid var(--border)',
                                borderRadius: '6px', padding: '4px 8px', width: '240px', outline: 'none'
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-0)' }}>
                                {twin.name}
                            </span>
                            <button
                                onClick={() => setIsRenaming(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 0, opacity: hovered ? 1 : 0 }}
                                title="Rename twin"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: color, textTransform: 'capitalize' }}>{twin.domain}</span>
                        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-2)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-1)' }}>{twin.width}m × {twin.length}m</span>
                        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-2)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-1)' }}>{twin.componentCount ?? 0} components</span>
                        <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-2)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-1)' }}>Updated {updatedAt}</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s ease' }}>
                <button className="btn btn-ghost" onClick={() => onLoad(twin.id)} style={{ padding: '6px 12px', fontSize: '13px', height: '32px' }}>
                    <Eye size={14} /> View
                </button>
                <button className="btn btn-ghost" onClick={() => onEdit(twin.id)} style={{ padding: '6px 12px', fontSize: '13px', height: '32px' }}>
                    <Pencil size={14} /> Edit
                </button>
                <button 
                    onClick={() => onDelete(twin)}
                    style={{ 
                        background: 'none', border: '1px solid transparent', color: 'var(--text-2)', 
                        padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'none'; }}
                >
                    <Trash2 size={16} />
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
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)' }}>

            {toDelete && (
                <ConfirmModal
                    twin={toDelete}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setToDelete(null)}
                />
            )}

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

            {/* Application Header - Clean, Left-aligned */}
            <div style={{
                padding: '40px 60px 32px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-1)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Monitor size={20} color="var(--accent)" />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                            Intelligent Analytics Deck
                        </span>
                    </div>
                    <h1 style={{
                        fontSize: '32px', fontWeight: 700, color: 'var(--text-0)',
                        letterSpacing: '-0.02em', margin: 0,
                    }}>
                        3D Digital Twin Platform
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-ghost" onClick={() => { loadDemo(); setStep(5); }} style={{ padding: '10px 16px' }}>
                        <Layers size={16} /> View Demo
                    </button>
                    <button className="btn btn-primary" onClick={() => setStep(1)} style={{ padding: '10px 20px' }}>
                        <Play size={16} /> Create Twin
                    </button>
                </div>
            </div>

            {/* Main Bento Box Grid */}
            <div style={{ 
                padding: '40px 60px', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(12, 1fr)', 
                gap: '24px',
                alignItems: 'start'
            }}>
                
                {/* Left Column (8 cols) */}
                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Bento Box: Saved Twins */}
                    <div style={{
                        background: 'var(--bg-1)', borderRadius: '16px',
                        border: '1px solid rgba(72,101,242,0.15)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ 
                            padding: '24px', borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Saved Twins</h2>
                                <p style={{ fontSize: '13px', color: 'var(--text-1)', margin: 0 }}>
                                    {loading ? 'Loading database...' : `${twins.length} active instances`}
                                </p>
                            </div>
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setLoading(true); fetchTwins().finally(() => setLoading(false)); }}
                                disabled={loading}
                                style={{ padding: '8px', height: 'auto' }}
                                title="Refresh data"
                            >
                                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '12px', minHeight: '200px', position: 'relative' }}>
                            {twins.length === 0 && !loading && (
                                <div style={{ 
                                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', 
                                    alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' 
                                }}>
                                    <LayoutGrid size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                    <p style={{ fontSize: '14px', margin: 0 }}>No twins saved yet.</p>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {twins.map(twin => (
                                    <div key={twin.id} style={{ position: 'relative' }}>
                                        {actionLoading === twin.id && (
                                            <div style={{
                                                position: 'absolute', inset: 0, zIndex: 10, borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <RefreshCw size={20} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
                                            </div>
                                        )}
                                        <TwinListItem
                                            twin={twin}
                                            onLoad={handleLoad}
                                            onEdit={handleEdit}
                                            onDelete={setToDelete}
                                            onRename={handleRename}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bento Box: Supported Domains */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {Object.entries(DOMAINS).map(([key, domain]) => (
                            <div key={key} style={{
                                background: 'var(--bg-1)', borderRadius: '16px', padding: '24px',
                                border: '1px solid var(--border)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                                display: 'flex', flexDirection: 'column'
                            }}>
                                <div style={{ fontSize: '28px', marginBottom: '16px' }}>{DOMAIN_ICONS[key]}</div>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '8px' }}>{domain.label}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.5 }}>{DOMAIN_DESCS[key]}</div>
                            </div>
                        ))}
                    </div>

                </div>

                {/* Right Column (4 cols) */}
                <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Bento Box: Connection Wizard */}
                    <div style={{
                        background: 'var(--bg-1)', borderRadius: '16px',
                        border: '1px solid rgba(72,101,242,0.15)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ 
                            padding: '20px 24px', borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-0)'
                        }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)', margin: 0 }}>Data Connections</h2>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <ConnectionWizard />
                        </div>
                    </div>

                    {/* Bento Box: Active Share Links */}
                    <div style={{
                        background: 'var(--bg-1)', borderRadius: '16px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Active Share Links</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-1)', margin: 0 }}>
                                {shareLinks.length} active connection{shareLinks.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div style={{ padding: '16px' }}>
                            {shareLinks.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-2)', textAlign: 'center', margin: '20px 0' }}>No active shared views.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {shareLinks.map(link => {
                                        const linkUrl = `${window.location.origin}/live/${link.id}`;
                                        const isCopied = copiedLink === link.id;
                                        
                                        return (
                                            <div key={link.id} style={{ 
                                                padding: '12px', borderRadius: '10px', 
                                                background: 'var(--bg-0)', border: '1px solid var(--border)' 
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)' }}>{link.name}</span>
                                                    <button 
                                                        onClick={() => deleteShareLink(link.id)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                                        title="Revoke access"
                                                    ><X size={14} /></button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                                            background: isCopied ? '#10d98d' : 'var(--bg-1)', 
                                                            color: isCopied ? '#fff' : 'var(--text-1)', 
                                                            border: '1px solid', borderColor: isCopied ? '#10d98d' : 'var(--border)',
                                                            cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
                                                            fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px',
                                                            fontWeight: 500
                                                        }}
                                                    >
                                                        {isCopied ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
