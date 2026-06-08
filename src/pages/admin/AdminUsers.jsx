import { useState, useEffect } from 'react';
import { getAdminUsers, updateAdminUserRole, deleteAdminUser, resetAdminUserPassword, createAdminUser } from '../../services/api';
import { Trash2, Shield, ShieldAlert, KeyRound, UserPlus, Search } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('user');
    
    const { user: currentUser } = useAuthStore();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await getAdminUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await createAdminUser(newUsername, newPassword, newRole);
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            setShowCreate(false);
            fetchUsers();
        } catch (e) {
            alert('Error creating user: ' + e.message);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await updateAdminUserRole(userId, newRole);
            fetchUsers();
        } catch (e) {
            alert('Error updating role: ' + e.message);
        }
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await deleteAdminUser(userId);
            fetchUsers();
        } catch (e) {
            alert('Error deleting user: ' + e.message);
        }
    };

    const handlePasswordReset = async (userId) => {
        const newPwd = window.prompt('Enter new password for this user:');
        if (!newPwd) return;
        try {
            await resetAdminUserPassword(userId, newPwd);
            alert('Password updated successfully.');
        } catch (e) {
            alert('Error updating password: ' + e.message);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '4px', letterSpacing: '-0.02em' }}>Users Management</h1>
                    <p style={{ color: 'var(--text-2)', fontSize: '15px' }}>Manage platform access, roles, and security.</p>
                </div>
                <button 
                    onClick={() => setShowCreate(!showCreate)} 
                    className="btn btn-primary"
                >
                    <UserPlus size={16} /> 
                    {showCreate ? 'Cancel' : 'Add User'}
                </button>
            </div>

            {showCreate && (
                <div className="animate-slide" style={{ 
                    background: 'var(--bg-1)', 
                    padding: '32px', 
                    borderRadius: 'var(--r-xl)', 
                    border: '1px solid var(--border)', 
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '4px' }}>Create New User</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>Add a new account to the platform.</p>
                    </div>

                    <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'end' }}>
                        <div>
                            <label className="label">Username</label>
                            <input 
                                type="text" 
                                value={newUsername} 
                                onChange={e => setNewUsername(e.target.value)} 
                                required 
                                className="input"
                                placeholder="Enter username"
                            />
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                required 
                                className="input"
                                placeholder="Secure password"
                            />
                        </div>
                        <div>
                            <label className="label">Role</label>
                            <select 
                                value={newRole} 
                                onChange={e => setNewRole(e.target.value)} 
                                className="input"
                                style={{ appearance: 'none', cursor: 'pointer' }}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px', justifyContent: 'center' }}>
                                Create Account
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ 
                background: 'var(--bg-1)', 
                borderRadius: 'var(--r-xl)', 
                border: '1px solid var(--border)', 
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Search/Filter Bar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', background: 'var(--bg-0)' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }} />
                        <input type="text" placeholder="Search users..." className="input" style={{ paddingLeft: '36px', height: '36px' }} />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>User</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Role</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Created At</th>
                                <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ 
                                                width: '36px', height: '36px', borderRadius: '50%', 
                                                background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 600, color: 'var(--text-1)'
                                            }}>
                                                {u.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-0)' }}>
                                                    {u.username}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>ID: #{u.id}</div>
                                            </div>
                                            {u.id === currentUser?.id && (
                                                <span className="badge badge-blue" style={{ marginLeft: '8px' }}>You</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {u.role === 'admin' ? (
                                            <span className="badge badge-green">
                                                <Shield size={12} /> ADMIN
                                            </span>
                                        ) : (
                                            <span className="badge" style={{ background: 'var(--bg-2)' }}>
                                                <ShieldAlert size={12} /> USER
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-1)' }}>
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            {u.role === 'user' ? (
                                                <button onClick={() => handleRoleChange(u.id, 'admin')} className="btn btn-ghost btn-sm">
                                                    Make Admin
                                                </button>
                                            ) : (
                                                <button onClick={() => handleRoleChange(u.id, 'user')} className="btn btn-ghost btn-sm" disabled={u.id === currentUser?.id}>
                                                    Demote
                                                </button>
                                            )}
                                            <button onClick={() => handlePasswordReset(u.id)} className="btn btn-icon btn-ghost" title="Reset Password">
                                                <KeyRound size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(u.id)} className="btn btn-icon btn-danger" disabled={u.id === currentUser?.id} title="Delete User">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '64px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '48px', height: '48px', background: 'var(--bg-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                                                <Users size={24} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-0)', marginBottom: '4px' }}>No users found</h3>
                                                <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>Get started by creating a new user account.</p>
                                            </div>
                                            <button onClick={() => setShowCreate(true)} className="btn btn-ghost">
                                                <UserPlus size={16} /> Add First User
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
