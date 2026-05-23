import { useEffect, useState } from 'react';
import { getUsers, createUser, resetPassword, deleteUser } from '../api';
import { User, Shield, UserPlus, Key, Trash2, AlertCircle, CheckCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

interface UserData {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
}

const UserManagement: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Form states
  const [newUser, setNewUser] = useState({ username: '', password: '', confirm: '', role: 'viewer' });
  const [resetData, setResetData] = useState({ password: '', confirm: '' });

  const fetchUsers = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newUser.password !== newUser.confirm) {
      setMessage({ text: "Passwords do not match.", type: 'error' });
      return;
    }

    createUser({
      username: newUser.username,
      password: newUser.password,
      role: newUser.role
    })
      .then(() => {
        setIsAddModalOpen(false);
        setNewUser({ username: '', password: '', confirm: '', role: 'viewer' });
        setMessage({ text: `User ${newUser.username} created successfully.`, type: 'success' });
        fetchUsers();
      })
      .catch(err => {
        setMessage({ text: err.response?.data?.detail || "Failed to create user.", type: 'error' });
      });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setMessage(null);

    if (resetData.password !== resetData.confirm) {
      setMessage({ text: "Passwords do not match.", type: 'error' });
      return;
    }

    resetPassword(selectedUser.id, { new_password: resetData.password })
      .then(() => {
        setIsResetModalOpen(false);
        setResetData({ password: '', confirm: '' });
        setMessage({ text: `Password reset for ${selectedUser.username} successfully.`, type: 'success' });
      })
      .catch(err => {
        setMessage({ text: err.response?.data?.detail || "Failed to reset password.", type: 'error' });
      });
  };

  const handleDeleteUser = (user: UserData) => {
    if (user.username === currentUser?.username) {
      alert("You cannot delete your own account.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete user '${user.username}'?`)) {
      setMessage(null);
      deleteUser(user.id)
        .then(() => {
          setMessage({ text: `User ${user.username} deleted.`, type: 'success' });
          fetchUsers();
        })
        .catch(err => {
          setMessage({ text: err.response?.data?.detail || "Failed to delete user.", type: 'error' });
        });
    }
  };

  if (!isAdmin) {
    return <div className="text-center py-20 text-red-600 font-bold underline">Access Denied: Administrator role required.</div>;
  }

  if (loading && users.length === 0) return <div className="text-center py-10">Loading users...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-4">
        <Link to="/config" className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
          <ChevronLeft size={16} />
          Back to Settings
        </Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <User size={28} className="text-slate-700" />
          <h1 className="text-2xl font-bold">User Management</h1>
        </div>
        <button 
          onClick={() => { setMessage(null); setIsAddModalOpen(true); }}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={18} />
          <span>Add User</span>
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded text-sm mb-6 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-200 p-2 rounded-full text-slate-600">
                      <User size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{u.username}</span>
                      {u.username === currentUser?.username && (
                        <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">YOU</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    {u.role === 'admin' ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        <Shield size={12} />
                        EDITOR
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        VIEWER
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { 
                        setSelectedUser(u); 
                        setMessage(null); 
                        setResetData({ password: '', confirm: '' });
                        setIsResetModalOpen(true); 
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Reset Password"
                    >
                      <Key size={16} />
                    </button>
                    {u.username !== currentUser?.username && (
                      <button 
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New User">
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
            <input 
              required
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              placeholder="Username"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Initial Password</label>
              <input 
                required
                type="password"
                className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Confirm Password</label>
              <input 
                required
                type="password"
                className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={newUser.confirm}
                onChange={e => setNewUser({...newUser, confirm: e.target.value})}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
            <select 
              className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value})}
            >
              <option value="viewer">Viewer (Read Only)</option>
              <option value="admin">Editor (Full Access)</option>
            </select>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition-colors"
          >
            Create User
          </button>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={`Reset Password: ${selectedUser?.username}`}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-slate-500 italic">
            Enter a new password for <strong>{selectedUser?.username}</strong>. They will need to use this to log in immediately.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
              <input 
                required
                type="password"
                className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={resetData.password}
                onChange={e => setResetData({...resetData, password: e.target.value})}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Confirm Password</label>
              <input 
                required
                type="password"
                className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={resetData.confirm}
                onChange={e => setResetData({...resetData, confirm: e.target.value})}
                placeholder="••••••••"
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 transition-colors"
          >
            Confirm Password Reset
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default UserManagement;
