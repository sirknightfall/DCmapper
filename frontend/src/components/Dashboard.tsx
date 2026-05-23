import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDatacenters, createDatacenter } from '../api';
import type { Datacenter } from '../types';
import { MapPin, Info, Plus } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newDC, setNewDC] = useState({ 
    name: '', 
    address: '', 
    description: '', 
    width: 10, 
    height: 10 
  });

  const fetchDatacenters = () => {
    setLoading(true);
    getDatacenters()
      .then(setDatacenters)
      .catch(err => {
        console.error("Failed to fetch datacenters:", err);
        setError("Failed to connect to the backend server.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDatacenters();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    createDatacenter(newDC)
      .then(() => {
        setIsModalOpen(false);
        setNewDC({ name: '', address: '', description: '', width: 10, height: 10 });
        fetchDatacenters();
      })
      .catch(err => {
        console.error("Failed to create datacenter:", err);
        const msg = err.response?.data?.detail || err.message || "Unknown error";
        setError(`Failed to create location: ${msg}`);
      })
      .finally(() => setIsSubmitting(false));
  };

  if (loading && datacenters.length === 0) return <div className="text-center py-10">Loading locations...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Datacenter Locations</h1>
        {isAdmin && (
          <button 
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span>Add Location</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {datacenters.map(dc => (
          <Link 
            key={dc.id} 
            to={`/datacenter/${dc.id}`}
            className="block bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <MapPin className="text-blue-500" size={20} />
              {dc.name}
            </h2>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              {dc.address}
            </p>
            <div className="flex justify-between items-center">
              {dc.description ? (
                <p className="text-slate-500 text-xs flex items-center gap-1">
                  <Info size={14} />
                  {dc.description}
                </p>
              ) : <div />}
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
                {dc.width}x{dc.height} Grid
              </span>
            </div>
          </Link>
        ))}
        {datacenters.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white border border-dashed rounded-lg">
            No datacenters configured yet.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Location">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={newDC.name}
              onChange={e => setNewDC({...newDC, name: e.target.value})}
              placeholder="e.g. Birmingham Data Centre"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={newDC.address}
              onChange={e => setNewDC({...newDC, address: e.target.value})}
              placeholder="Street address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea 
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={newDC.description}
              onChange={e => setNewDC({...newDC, description: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Grid Width</label>
              <input 
                type="number"
                min="1"
                max="50"
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={newDC.width}
                onChange={e => setNewDC({...newDC, width: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grid Height</label>
              <input 
                type="number"
                min="1"
                max="50"
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={newDC.height}
                onChange={e => setNewDC({...newDC, height: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? 'Creating...' : 'Create Location'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
