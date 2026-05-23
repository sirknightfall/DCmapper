import { useEffect, useState } from 'react';
import { getConfig, updateConfig } from '../api';
import { Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';

const Config: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [interval, setIntervalValue] = useState(60);

  useEffect(() => {
    getConfig()
      .then(data => {
        setIntervalValue(data.check_interval_seconds);
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

    updateConfig({ check_interval_seconds: interval })
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
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Status Check Interval (Seconds)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              How often the system should ping devices to update their Online/Offline status. 
              Lower values provide more real-time data but increase network traffic.
            </p>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                min="5"
                max="3600"
                required
                className="w-32 border rounded px-3 py-2 text-lg font-mono"
                value={interval}
                onChange={e => setIntervalValue(parseInt(e.target.value))}
              />
              <span className="text-slate-500">seconds</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              Range: 5s to 3600s (1 hour). Default: 60s.
            </p>
          </div>

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
        <h3 className="text-sm font-bold text-slate-600 mb-2">Background Monitoring Info</h3>
        <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
          <li>The status monitor runs as a persistent background task on the server.</li>
          <li>Changing the interval will take effect after the current wait cycle completes.</li>
          <li>Pings are performed sequentially for all devices with an IP address.</li>
        </ul>
      </div>
    </div>
  );
};

export default Config;
