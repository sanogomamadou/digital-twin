import { useState } from 'react';
import { Users, Activity, Settings, ArrowLeft, Menu, X } from 'lucide-react';
import AdminUsers from './AdminUsers';
import AdminPerformance from './AdminPerformance';
import AdminLLMOps from './AdminLLMOps';

export default function AdminLayout() {
    const [activeTab, setActiveTab] = useState('performance');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'users': return <AdminUsers />;
            case 'performance': return <AdminPerformance />;
            case 'llmops': return <AdminLLMOps />;
            default: return <AdminPerformance />;
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="admin-layout">
            {/* Mobile Header */}
            <div className="admin-mobile-header">
                <div className="admin-mobile-logo-wrapper">
                    <div className="admin-logo">
                        A
                    </div>
                    <div className="admin-logo-text">Admin</div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="btn btn-icon btn-ghost">
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Sidebar */}
            <div className={`admin-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <div className="admin-logo-large">
                        A
                    </div>
                    <div>
                        <div className="admin-sidebar-title">Admin Deck</div>
                        <div className="admin-sidebar-subtitle">Superuser Access</div>
                    </div>
                </div>

                <div className="admin-tab-list">
                    <TabButton icon={<Activity size={18} />} label="Agent Performance" active={activeTab === 'performance'} onClick={() => handleTabChange('performance')} />
                    <TabButton icon={<Users size={18} />} label="Users Management" active={activeTab === 'users'} onClick={() => handleTabChange('users')} />
                    <TabButton icon={<Settings size={18} />} label="LLM Ops" active={activeTab === 'llmops'} onClick={() => handleTabChange('llmops')} />
                </div>

                <button
                    onClick={() => window.location.href = '/'}
                    className="btn btn-ghost admin-back-btn"
                >
                    <ArrowLeft size={16} />
                    Back to Platform
                </button>
            </div>

            {/* Main Content */}
            <div className="admin-content">
                <div className="admin-content-inner">
                    {renderContent()}
                </div>
            </div>

            {/* Mobile overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="admin-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(30, 41, 59, 0.5)', zIndex: 30,
                        backdropFilter: 'blur(4px)'
                    }}
                />
            )}
        </div>
    );
}

function TabButton({ icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`admin-tab-btn ${active ? 'active' : ''}`}
            style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-1)',
                border: active ? '1px solid var(--border)' : '1px solid transparent', 
                textAlign: 'left', fontWeight: active ? 600 : 500,
                transition: 'all 0.2s ease', fontSize: '14px'
            }}
        >
            {icon}
            {label}
        </button>
    );
}
