import { useEffect, useState } from 'react';
import { getConfig, updateConfig, updateOwnPassword } from '../api';
import { Settings, Save, AlertCircle, CheckCircle, Database, Lock, Users, Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Config: React.FC = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // System Config State
  const [interval, setIntervalValue] = useState(60);
  const [retention, setRetention] = useState(365);

  // Self-service Password State
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });
  const [passMessage, setPassMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  useEffect(() => {
    getConfig()
      .then(data => {
        setIntervalValue(data.check_interval_seconds);
        setRetention(data.retention_days);
      })
      .catch(err => {
        console.error("Failed to fetch config:", err);
        setMessage({ text: "Failed to load system configuration.", type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    setIsSubmitting(true);
    setMessage(null);

    updateConfig({ 
      check_interval_seconds: interval,
      retention_days: retention
    })
      .then(() => {
        setMessage({ text: "Settings saved successfully.", type: 'success' });
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
      })
      .catch(err => {
        setPassMessage({ text: err.response?.data?.detail || "Failed to update password.", type: 'error' });
      })
      .finally(() => setIsUpdatingPass(false));
  };

  if (loading) return <div className="text-center py-10">Loading system settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
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
      </div>

      {/* Self-service Password Change */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Key size={28} className="text-slate-700" />
          <h1 className="text-2xl font-bold">Personal Security</h1>
        </div>

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
      </div>

      <div className="mt-8 bg-slate-50 border border-dashed rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-2">Security Notice</h3>
        <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
          <li>Passwords are stored securely using one-way cryptographic hashing.</li>
          <li>For security reasons, your current session will remain active after changing your password.</li>
          <li>If you forget your password, please contact a system administrator (Editor) to reset it.</li>
        </ul>
      </div>
    </div>
  );
};

export default Config;
