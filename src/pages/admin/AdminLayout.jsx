import { useState } from 'react';
import { Users, Activity, Settings, ArrowLeft } from 'lucide-react';
import AdminUsers from './AdminUsers';
import AdminPerformance from './AdminPerformance';
import AdminLLMOps from './AdminLLMOps';

export default function AdminLayout() {
    const [activeTab, setActiveTab] = useState('users');

    const renderContent = () => {
        switch (activeTab) {
            case 'users': return <AdminUsers />;
            case 'performance': return <AdminPerformance />;
            case 'llmops': return <AdminLLMOps />;
            default: return <AdminUsers />;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-0)' }}>
            {/* Sidebar */}
            <div style={{
                width: '260px', background: 'var(--bg-1)', borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', padding: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 'bold'
                    }}>
                        A
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>Admin Dashboard</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Superuser Access</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <TabButton icon={<Users size={18} />} label="Users Management" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
                    <TabButton icon={<Activity size={18} />} label="Agent Performance" active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} />
                    <TabButton icon={<Settings size={18} />} label="LLM Ops" active={activeTab === 'llmops'} onClick={() => setActiveTab('llmops')} />
                </div>

                <button
                    onClick={() => window.location.href = '/'}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px', background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: '8px', cursor: 'pointer', color: 'var(--text-1)',
                        justifyContent: 'center', transition: 'background 0.2s',
                        marginTop: 'auto'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                    <ArrowLeft size={16} />
                    Back to Application
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                {renderContent()}
            </div>
        </div>
    );
}

function TabButton({ icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-1)',
                border: 'none', textAlign: 'left', fontWeight: active ? 600 : 500,
                transition: 'all 0.2s'
            }}
            onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
        >
            {icon}
            {label}
        </button>
    );
}
