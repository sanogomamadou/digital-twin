import { useState, useRef, useEffect } from 'react';
import useTwinStore from '../store/useTwinStore';
import useAuthStore from '../store/useAuthStore';
import { logoutUser } from '../services/api';
import { LogOut, User, Settings, ChevronDown, Check } from 'lucide-react';

const STEPS = [
    { id: 1, label: 'Configure' },
    { id: 2, label: 'Layout' },
    { id: 3, label: 'Connections' },
    { id: 4, label: 'KPIs' },
    { id: 5, label: 'Live View' },
];

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export default function Navbar() {
    const { currentStep, setStep } = useTwinStore();
    const { user, logout } = useAuthStore();
    const isInWizard = currentStep >= 1;
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    useOnClickOutside(dropdownRef, () => setIsDropdownOpen(false));

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (e) {
            console.error(e);
        }
        logout();
    };

    return (
        <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', height: '60px', flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            position: 'relative', zIndex: 100,
        }}>
            {/* Left: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: '240px' }}>
                <button
                    onClick={() => setStep(0)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        cursor: 'pointer', background: 'none', border: 'none', padding: '6px',
                        borderRadius: '10px', transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-0)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: 900, color: 'white',
                    }}>
                        ⬡
                    </div>
                    <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.02em' }}>
                            DXC Digital Twin
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-2)', fontWeight: 500 }}>
                            Intelligent Analytics
                        </div>
                    </div>
                </button>
            </div>

            {/* Center: Wizard Breadcrumb */}
            {isInWizard ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {STEPS.map((step, i) => {
                            const isPast = currentStep > step.id;
                            const isActive = currentStep === step.id;
                            
                            return (
                                <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                                    <button
                                        onClick={() => isPast && setStep(step.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            background: isActive ? 'var(--bg-0)' : 'transparent',
                                            border: 'none', padding: '6px 12px', borderRadius: '8px',
                                            cursor: isPast ? 'pointer' : 'default',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={e => isPast && (e.currentTarget.style.background = 'var(--bg-0)')}
                                        onMouseLeave={e => isPast && (e.currentTarget.style.background = isActive ? 'var(--bg-0)' : 'transparent')}
                                    >
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 700,
                                            background: isActive ? 'var(--text-0)' : (isPast ? 'rgba(72,101,242,0.1)' : 'var(--bg-2)'),
                                            color: isActive ? '#fff' : (isPast ? 'var(--accent)' : 'var(--text-2)'),
                                            border: isActive ? '1px solid var(--text-0)' : (isPast ? '1px solid rgba(72,101,242,0.2)' : '1px solid transparent'),
                                            boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                                            transition: 'all 0.2s ease'
                                        }}>
                                            {isPast ? <Check size={12} strokeWidth={3} /> : step.id}
                                        </div>
                                        <span style={{ 
                                            fontSize: '13px', 
                                            fontWeight: isActive ? 600 : 500, 
                                            color: isActive ? 'var(--text-0)' : (isPast ? 'var(--text-1)' : 'var(--text-2)'),
                                            display: window.innerWidth > 900 ? 'block' : (isActive ? 'block' : 'none'),
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {step.label}
                                        </span>
                                    </button>
                                    {i < STEPS.length - 1 && (
                                        <div style={{ 
                                            width: '16px', height: '1px', 
                                            background: isPast ? 'var(--accent)' : 'var(--bg-2)', 
                                            margin: '0 4px', opacity: isPast ? 0.3 : 1
                                        }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1 }} />
            )}

            {/* Right: User Menu */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: '240px', justifyContent: 'flex-end' }}>
                {user ? (
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: isDropdownOpen ? 'var(--bg-0)' : 'transparent',
                                padding: '6px 12px', borderRadius: '10px',
                                border: '1px solid', borderColor: isDropdownOpen ? 'var(--border)' : 'transparent',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => !isDropdownOpen && (e.currentTarget.style.background = 'var(--bg-0)')}
                            onMouseLeave={e => !isDropdownOpen && (e.currentTarget.style.background = 'transparent')}
                        >
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #e2e4e9, #cbd5e1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-1)'
                            }}>
                                <User size={16} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)' }}>
                                {user.username}
                            </span>
                            <ChevronDown size={14} color="var(--text-2)" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                        </button>

                        {isDropdownOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                width: '220px', background: 'var(--bg-1)',
                                border: '1px solid var(--border)', borderRadius: '12px',
                                boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
                                padding: '8px', zIndex: 1000,
                                animation: 'fadeIn 0.15s ease-out'
                            }}>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>Signed in as</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)' }}>{user.username}</div>
                                </div>
                                
                                {user.role === 'admin' && (
                                    <button
                                        onClick={() => window.location.href = '/admin'}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                            padding: '8px 12px', border: 'none', background: 'transparent',
                                            cursor: 'pointer', borderRadius: '6px', color: 'var(--text-0)',
                                            fontSize: '13px', fontWeight: 500, textAlign: 'left',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-0)'; e.currentTarget.style.color = 'var(--accent)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-0)'; }}
                                    >
                                        <Settings size={16} />
                                        Admin Dashboard
                                    </button>
                                )}
                                
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                        padding: '8px 12px', border: 'none', background: 'transparent',
                                        cursor: 'pointer', borderRadius: '6px', color: 'var(--text-0)',
                                        fontSize: '13px', fontWeight: 500, textAlign: 'left',
                                        marginTop: '4px'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-0)'; }}
                                >
                                    <LogOut size={16} />
                                    Déconnexion
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div />
                )}
            </div>
        </nav>
    );
}
