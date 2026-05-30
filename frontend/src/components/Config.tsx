import { useEffect, useState } from 'react';
import { getConfig, updateConfig, updateOwnPassword, getDeviceFields, createDeviceField, updateDeviceField, deleteDeviceField, getActivityLogs } from '../api';
import { Settings, Save, AlertCircle, CheckCircle, Database, Lock, Users, Plus, Trash2, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { DeviceField } from '../types';

const Config: React.FC = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // System Config State
  const [interval, setIntervalValue] = useState(60);
  const [retention, setRetention] = useState(365);

  // Device Fields State
  const [deviceFields, setDeviceFields] = useState<DeviceField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [fieldMessage, setFieldMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);

  // Self-service Password State
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });
  const [passMessage, setPassMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Tabs & Audit Logs
  const [activeTab, setActiveTab] = useState<'settings' | 'fields' | 'security' | 'logs'>('settings');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  const fetchLogs = () => {
    getActivityLogs()
      .then(setActivityLogs)
      .catch(err => console.error("Failed to fetch activity logs:", err));
  };

  useEffect(() => {
    Promise.all([getConfig(), getDeviceFields(), getActivityLogs()])
      .then(([configData, fieldsData, logsData]) => {
        setIntervalValue(configData.check_interval_seconds);
        setRetention(configData.retention_days);
        setDeviceFields(fieldsData);
        setActivityLogs(logsData);
      })
      .catch(err => {
        console.error("Failed to fetch config or fields:", err);
        setMessage({ text: "Failed to load system configuration.", type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    if (!isAdmin) return;
    e.preventDefault();
    
    setIsSubmitting(true);
    setMessage(null);

    updateConfig({ 
      check_interval_seconds: interval,
      retention_days: retention
    })
      .then(() => {
        setMessage({ text: "Settings saved successfully.", type: 'success' });
        fetchLogs();
      })
      .catch(err => {
        console.error("Failed to update config:", err);
        setMessage({ text: "Failed to save settings.", type: 'error' });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (passwordData.new !== passwordData.confirm) {
      setPassMessage({ text: "Passwords do not match.", type: 'error' });
      return;
    }

    if (passwordData.new.length < 4) {
      setPassMessage({ text: "Password must be at least 4 characters.", type: 'error' });
      return;
    }

    setIsUpdatingPass(true);
    updateOwnPassword({ new_password: passwordData.new })
      .then(() => {
        setPassMessage({ text: "Password updated successfully.", type: 'success' });
        setPasswordData({ new: '', confirm: '' });
        fetchLogs();
      })
      .catch(err => {
        setPassMessage({ text: err.response?.data?.detail || "Failed to update password.", type: 'error' });
      })
      .finally(() => setIsUpdatingPass(false));
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    setIsAddingField(true);
    setFieldMessage(null);

    createDeviceField({
      label: newFieldLabel.trim(),
      field_type: newFieldType,
      required: newFieldRequired
    })
      .then(newField => {
        setDeviceFields(prev => [...prev, newField]);
        setNewFieldLabel('');
        setNewFieldType('text');
        setNewFieldRequired(false);
        setFieldMessage({ text: "Custom field added successfully.", type: 'success' });
        fetchLogs();
      })
      .catch(err => {
        console.error("Failed to create field:", err);
        setFieldMessage({ text: err.response?.data?.detail || "Failed to create field.", type: 'error' });
      })
      .finally(() => setIsAddingField(false));
  };

  const handleToggleActive = (field: DeviceField) => {
    if (!isAdmin) return;
    const newActive = !field.is_active;
    updateDeviceField(field.id, { is_active: newActive })
      .then(updated => {
        setDeviceFields(prev => prev.map(f => f.id === field.id ? updated : f));
        fetchLogs();
      })
      .catch(err => {
        console.error("Failed to update active state:", err);
      });
  };

  const handleToggleRequired = (field: DeviceField) => {
    if (!isAdmin) return;
    const newReq = !field.required;
    updateDeviceField(field.id, { required: newReq })
      .then(updated => {
        setDeviceFields(prev => prev.map(f => f.id === field.id ? updated : f));
        fetchLogs();
      })
      .catch(err => {
        console.error("Failed to update required state:", err);
      });
  };

  const handleDeleteField = (field: DeviceField) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to delete/deactivate "${field.label}"?`)) return;

    deleteDeviceField(field.id)
      .then(() => {
        if (field.is_custom) {
          setDeviceFields(prev => prev.filter(f => f.id !== field.id));
        } else {
          setDeviceFields(prev => prev.map(f => f.id === field.id ? { ...f, is_active: false } : f));
        }
        setFieldMessage({ text: `Field "${field.label}" removed successfully.`, type: 'success' });
        fetchLogs();
      })
      .catch(err => {
        console.error("Failed to delete field:", err);
        setFieldMessage({ text: "Failed to remove field.", type: 'error' });
      });
  };

  if (loading) return <div className="text-center py-10">Loading system settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Title & User Actions Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={28} className="text-slate-700" />
          <h1 className="text-2xl font-bold">System Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link 
              to="/users" 
              className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              <Users size={12} />
              MANAGE USERS
            </Link>
          )}
          {!isAdmin && (
            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
              <Lock size={12} />
              READ ONLY
            </div>
          )}
        </div>
      </div>

      {/* Modern Glassmorphic Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2 px-4 text-sm font-semibold transition-all border-b-2 rounded-t-lg -mb-[2px] ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`py-2 px-4 text-sm font-semibold transition-all border-b-2 rounded-t-lg -mb-[2px] ${
            activeTab === 'fields'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          📋 Fields Config
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`py-2 px-4 text-sm font-semibold transition-all border-b-2 rounded-t-lg -mb-[2px] ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          🔑 Security
        </button>
        <button
          onClick={() => {
            fetchLogs();
            setActiveTab('logs');
          }}
          className={`py-2 px-4 text-sm font-semibold transition-all border-b-2 rounded-t-lg -mb-[2px] flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardList size={16} />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* Tab 1: System Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSaveConfig} className="space-y-8">
            {/* Status Check Section */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Settings size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Monitoring</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Configure how often the system pings devices to update their Online/Offline status.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Check Interval (Seconds)</label>
                  <input 
                    type="number" 
                    min="5"
                    max="3600"
                    required
                    disabled={!isAdmin || isSubmitting}
                    className="w-full border rounded px-3 py-2 text-lg font-mono disabled:bg-slate-50"
                    value={interval}
                    onChange={e => setIntervalValue(parseInt(e.target.value))}
                  />
                </div>
                <span className="mt-5 text-slate-400 text-sm">seconds</span>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Retention Section */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Data Retention</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                How long should "soft-deleted" servers be kept in the database before being permanently removed?
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Retention Period (Days)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="3650"
                    required
                    disabled={!isAdmin || isSubmitting}
                    className="w-full border rounded px-3 py-2 text-lg font-mono disabled:bg-slate-50"
                    value={retention}
                    onChange={e => setRetention(parseInt(e.target.value))}
                  />
                </div>
                <span className="mt-5 text-slate-400 text-sm">days</span>
              </div>
            </section>

            {message && (
              <div className={`flex items-center gap-2 p-3 rounded text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            {isAdmin && (
              <div className="pt-4 border-t">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400 transition-colors w-full md:w-auto"
                >
                  <Save size={18} />
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tab 2: Fields Config */}
      {activeTab === 'fields' && (
        <div className="bg-white border rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Configure Server Fields</h2>
            <p className="text-xs text-slate-500 mb-4">
              Toggle which fields are active, configure if they are required or optional, or add/remove completely custom attributes for server devices.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-medium">
                  <th className="py-2">Field Label</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Active</th>
                  <th className="py-2">Required</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deviceFields.map((field) => (
                  <tr key={field.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-medium text-slate-800">
                      {field.label}
                      {!field.is_custom && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                          BUILT-IN
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-500 font-mono text-xs uppercase">{field.field_type}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => handleToggleActive(field)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                          field.is_active
                            ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {field.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => handleToggleRequired(field)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                          field.required
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {field.required ? 'Required' : 'Optional'}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteField(field)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all animate-pulse"
                          title={field.is_custom ? 'Delete Custom Field' : 'Deactivate Built-In Field'}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Custom Field Section */}
          {isAdmin && (
            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Add Custom Field</h3>
              <form onSubmit={handleAddField} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Field Label / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Serial Number, Asset Tag"
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Field Type</label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="url">URL Link</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                    />
                    Required Field
                  </label>
                  <button
                    type="submit"
                    disabled={isAddingField || !newFieldLabel.trim()}
                    className="ml-auto bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded transition-colors flex items-center justify-center gap-1 font-bold text-xs"
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {fieldMessage && (
            <div className={`flex items-center gap-2 p-3 rounded text-sm ${
              fieldMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {fieldMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {fieldMessage.text}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Personal Security */}
      {activeTab === 'security' && (
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Lock size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Change Password</h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Update your account password. You will need to use the new password on your next login.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">New Password</label>
                  <input 
                    type="password"
                    required
                    disabled={isUpdatingPass}
                    className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    value={passwordData.new}
                    onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Confirm New Password</label>
                  <input 
                    type="password"
                    required
                    disabled={isUpdatingPass}
                    className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    value={passwordData.confirm}
                    onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {passMessage && (
              <div className={`flex items-center gap-2 p-3 rounded text-sm ${
                passMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {passMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {passMessage.text}
              </div>
            )}

            <div className="pt-4 border-t">
              <button 
                type="submit" 
                disabled={isUpdatingPass}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 disabled:bg-slate-400 transition-colors w-full md:w-auto"
              >
                <Save size={18} />
                {isUpdatingPass ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-xs text-slate-500 uppercase tracking-wider font-bold">
            <span>Relational Activity Audit Trail</span>
            <button
              onClick={fetchLogs}
              className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-2.5 py-1 rounded transition-all shadow-sm"
            >
              Refresh Logs
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1">
            {activityLogs.map((log: any) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      @{log.username}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 break-words font-medium">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="py-20 text-center text-slate-500 bg-slate-50/50 border border-dashed m-4 rounded-lg text-sm">
                No activity logs recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Notices */}
      {activeTab !== 'logs' && (
        <div className="bg-slate-50 border border-dashed rounded-lg p-4">
          <h3 className="text-sm font-bold text-slate-600 mb-2">Security Notice</h3>
          <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
            <li>Passwords are stored securely using one-way cryptographic hashing.</li>
            <li>For security reasons, your current session will remain active after changing your password.</li>
            <li>If you forget your password, please contact a system administrator (Editor) to reset it.</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Config;
