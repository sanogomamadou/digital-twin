import { useState } from 'react';
import { loginUser, registerUser } from '../services/api';
import { Lock, User, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthOverlay({ onAuthenticated }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isLogin) {
                const res = await loginUser(username, password);
                if (res.access_token) {
                    localStorage.setItem('auth_token', res.access_token);
                    onAuthenticated();
                }
            } else {
                const res = await registerUser(username, password);
                if (res.access_token) {
                    localStorage.setItem('auth_token', res.access_token);
                    onAuthenticated();
                }
            }
        } catch (e) {
            setError(e.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '50vh',
                background: 'radial-gradient(ellipse at top, rgba(72,101,242,0.1) 0%, transparent 70%)', pointerEvents: 'none'
            }} />
            
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                <span className="badge badge-blue" style={{ marginBottom: '16px' }}>
                    <Sparkles size={12} /> Digital Twin Platform
                </span>
                <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-0)' }}>
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: '8px' }}>
                    {isLogin ? 'Sign in to access your digital twins' : 'Sign up to build your first digital twin'}
                </p>
            </div>

            <div className="glass" style={{
                width: '380px', padding: '32px', borderRadius: '24px',
                border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.15)'
            }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
                            USERNAME
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                            <input
                                type="text"
                                className="input"
                                style={{ width: '100%', paddingLeft: '40px' }}
                                placeholder="Enter username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
                            PASSWORD
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                            <input
                                type="password"
                                className="input"
                                style={{ width: '100%', paddingLeft: '40px' }}
                                placeholder="Enter password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '13px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '44px' }} disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-2)' }}>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ background: 'none', border: 'none', color: '#4865f2', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
}
