import { useState } from 'react';
import { Share2, Copy, Check, X, AlertCircle } from 'lucide-react';
import useTwinStore from '../store/useTwinStore';

export default function ShareModal({ twinId, onClose }) {
    const { createShareLink } = useTwinStore();
    
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedLink, setGeneratedLink] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        if (!name.trim() || !password.trim()) {
            setError('Name and password are required');
            return;
        }
        if (!twinId) {
            setError('Please save the Twin first before sharing.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const link = await createShareLink({ twin_id: twinId, name, password });
            const url = `${window.location.origin}/live/${link.id}`;
            setGeneratedLink(url);
        } catch (e) {
            setError('Failed to create share link: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
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
                        <Share2 size={20} /> Share Digital Twin
                    </h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}>
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {!generatedLink ? (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>Share Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Manager View"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-1)', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>Password</label>
                            <input
                                type="password"
                                placeholder="Set a secure password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-1)', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-1)', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreate} 
                                disabled={loading}
                                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.6 : 1 }}
                            >
                                {loading ? 'Creating...' : 'Create Link'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: '14px', color: 'var(--text-1)', marginBottom: '16px' }}>
                            Your share link is ready. Anyone with this link and the password can view the digital twin.
                        </p>
                        
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                            background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '8px',
                            marginBottom: '24px'
                        }}>
                            <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {generatedLink}
                            </div>
                            <button 
                                onClick={handleCopy}
                                style={{ 
                                    padding: '8px 12px', borderRadius: '6px', border: 'none', 
                                    background: copied ? '#10d98d' : 'var(--accent)', color: '#fff', 
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '13px', fontWeight: 600
                                }}
                            >
                                {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-1)', fontWeight: 600, cursor: 'pointer' }}>
                                Close
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
