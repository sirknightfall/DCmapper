import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDatacenters, createDatacenter, deleteDatacenter } from '../api';
import type { Datacenter, DatacenterWithRacks } from '../types';
import { MapPin, Info, Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const [datacenters, setDatacenters] = useState<DatacenterWithRacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const handleDelete = (e: React.MouseEvent, dc: Datacenter) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdmin && window.confirm(`DANGER: Are you sure you want to delete ${dc.name}? This will delete ALL racks and devices in this location.`)) {
      deleteDatacenter(dc.id)
        .then(() => {
          fetchDatacenters();
        })
        .catch(err => {
          console.error("Failed to delete datacenter:", err);
          alert("Failed to delete location.");
        });
    }
  };

  if (loading && datacenters.length === 0) return <div className="text-center py-10">Loading locations...</div>;

  const matchesDevice = (device: any, term: string) => {
    if (device.name && device.name.toLowerCase().includes(term)) return true;
    if (device.description && device.description.toLowerCase().includes(term)) return true;
    if (device.vendor_model && device.vendor_model.toLowerCase().includes(term)) return true;
    if (device.ip_addresses && device.ip_addresses.toLowerCase().includes(term)) return true;
    if (device.management_ip && device.management_ip.toLowerCase().includes(term)) return true;
    if (device.management_link && device.management_link.toLowerCase().includes(term)) return true;
    if (device.network_ports && device.network_ports.toLowerCase().includes(term)) return true;
    if (device.owner && device.owner.toLowerCase().includes(term)) return true;
    if (device.custom_values && typeof device.custom_values === 'object') {
      return Object.values(device.custom_values).some(val => 
        String(val).toLowerCase().includes(term)
      );
    }
    return false;
  };

  const getMatchingDevices = (dc: DatacenterWithRacks) => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const matches: any[] = [];
    if (dc.racks) {
      dc.racks.forEach(rack => {
        if (rack.devices) {
          rack.devices.forEach(device => {
            if (matchesDevice(device, term)) {
              matches.push(device);
            }
          });
        }
      });
    }
    return matches;
  };

  const filteredDCs = datacenters.filter(dc => {
    const term = searchTerm.toLowerCase();
    
    // 1. Match datacenter details
    const dcMatches = dc.name.toLowerCase().includes(term) ||
                      dc.address.toLowerCase().includes(term) ||
                      (dc.description && dc.description.toLowerCase().includes(term));
    if (dcMatches) return true;
    
    // 2. Match any device within this datacenter
    if (dc.racks) {
      return dc.racks.some(rack => 
        rack.devices && rack.devices.some(device => matchesDevice(device, term))
      );
    }
    
    return false;
  });

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

      {/* Location Search Bar */}
      <div className="mb-6 bg-slate-50 border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 w-full md:max-w-md relative">
          <input
            type="text"
            placeholder="🔍 Search locations or devices (Name, IP, type, custom...)"
            className="w-full pl-4 pr-10 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Clear
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {searchTerm ? (
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-100 animate-pulse">
              Found {filteredDCs.length} matching locations
            </span>
          ) : (
            <span>Type above to search through locations, racks, or device attributes globally.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDCs.map(dc => (
          <Link 
            key={dc.id} 
            to={`/datacenter/${dc.id}`}
            className="group block bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 relative"
          >
            {isAdmin && (
              <button 
                onClick={(e) => handleDelete(e, dc)}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Location"
              >
                <Trash2 size={18} />
              </button>
            )}
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 pr-8">
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

            {/* Matching Devices Section */}
            {searchTerm && getMatchingDevices(dc).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block">
                  Matching Devices ({getMatchingDevices(dc).length})
                </span>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {getMatchingDevices(dc).map(device => (
                    <div 
                      key={device.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `/rack/${device.rack_id}`;
                      }}
                      className="flex justify-between items-center bg-slate-50 hover:bg-blue-50 border border-slate-100 rounded px-2 py-1 text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          device.status === 'Online' ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 
                          device.status === 'Offline' ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]' : 'bg-slate-400'
                        }`} />
                        <span className="font-semibold text-slate-700 truncate">{device.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Link>
        ))}
        {filteredDCs.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white border border-dashed rounded-lg">
            {searchTerm ? "No locations found matching your search query." : "No datacenters configured yet."}
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
