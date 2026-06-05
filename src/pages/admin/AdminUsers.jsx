import { useState, useEffect } from 'react';
import { getAdminUsers, updateAdminUserRole, deleteAdminUser, resetAdminUserPassword, createAdminUser } from '../../services/api';
import { Trash2, Shield, ShieldAlert, KeyRound, UserPlus } from 'lucide-react';
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

    if (loading) return <div>Loading users...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Users Management</h1>
                <button onClick={() => setShowCreate(!showCreate)} style={{ ...actionBtnStyle, background: 'var(--accent)', color: 'white' }}>
                    <UserPlus size={16} style={{ marginRight: '6px' }} /> Add User
                </button>
            </div>
            <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>Manage platform access, roles, and security.</p>

            {showCreate && (
                <div style={{ background: 'var(--bg-1)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create New User</h3>
                    <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-2)', marginBottom: '6px' }}>Username</label>
                            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-2)', marginBottom: '6px' }}>Password</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inputStyle} />
                        </div>
                        <div style={{ width: '150px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-2)', marginBottom: '6px' }}>Role</label>
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={inputStyle}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button type="submit" style={{ ...actionBtnStyle, background: 'var(--accent)', color: 'white', padding: '10px 20px', height: '40px' }}>
                            Create
                        </button>
                    </form>
                </div>
            )}
            <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>Manage platform access, roles, and security.</p>

            <div style={{ background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>ID</th>
                            <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>Username</th>
                            <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>Role</th>
                            <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 600 }}>Created At</th>
                            <th style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px', fontSize: '14px' }}>#{u.id}</td>
                                <td style={{ padding: '16px', fontSize: '14px', fontWeight: 500 }}>
                                    {u.username}
                                    {u.id === currentUser?.id && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: u.role === 'admin' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        color: u.role === 'admin' ? '#10b981' : '#3b82f6',
                                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
                                    }}>
                                        {u.role === 'admin' ? <Shield size={12} /> : <ShieldAlert size={12} />}
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-2)' }}>
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        {u.role === 'user' ? (
                                            <button onClick={() => handleRoleChange(u.id, 'admin')} style={actionBtnStyle}>
                                                Promote to Admin
                                            </button>
                                        ) : (
                                            <button onClick={() => handleRoleChange(u.id, 'user')} style={actionBtnStyle} disabled={u.id === currentUser?.id}>
                                                Demote to User
                                            </button>
                                        )}
                                        <button onClick={() => handlePasswordReset(u.id)} style={actionBtnStyle} title="Reset Password">
                                            <KeyRound size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(u.id)} style={{ ...actionBtnStyle, color: 'var(--red)' }} disabled={u.id === currentUser?.id} title="Delete User">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-2)' }}>No users found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const actionBtnStyle = {
    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px',
    padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--text-1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
};

const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-1)',
    fontSize: '14px',
    outline: 'none'
};
