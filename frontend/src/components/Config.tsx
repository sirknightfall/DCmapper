import { useEffect, useState } from 'react';
import { getConfig, updateConfig } from '../api';
import { Settings, Save, AlertCircle, CheckCircle, Database } from 'lucide-react';

const Config: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [interval, setIntervalValue] = useState(60);
  const [retention, setRetention] = useState(365);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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

  if (loading) return <div className="text-center py-10">Loading system settings...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={28} className="text-slate-700" />
        <h1 className="text-2xl font-bold">System Configuration</h1>
      </div>

      <div className="bg-white border rounded-lg shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-8">
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
                  className="w-full border rounded px-3 py-2 text-lg font-mono"
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
              These servers will appear in CSV exports until pruned.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs font-medium text-slate-500 mb-1">Retention Period (Days)</label>
                <input 
                  type="number" 
                  min="1"
                  max="3650"
                  required
                  className="w-full border rounded px-3 py-2 text-lg font-mono"
                  value={retention}
                  onChange={e => setRetention(parseInt(e.target.value))}
                />
              </div>
              <span className="mt-5 text-slate-400 text-sm">days</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              Range: 1 to 3650 days (10 years). Default: 365.
            </p>
          </section>

          {message && (
            <div className={`flex items-center gap-2 p-3 rounded text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {message.text}
            </div>
          )}

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
        </form>
      </div>

      <div className="mt-8 bg-slate-50 border border-dashed rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-2">Background Maintenance</h3>
        <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
          <li>The status monitor runs based on the interval configured above.</li>
          <li>The cleanup task runs once every 24 hours to prune old deleted servers.</li>
          <li>Pruning is permanent and cannot be undone.</li>
        </ul>
      </div>
    </div>
  );
};

export default Config;
