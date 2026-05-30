import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDatacenter, createRack, updateRack, deleteRack, updateDatacenter, deleteDatacenter, downloadDatacenterExport, analyzeImport, commitImport } from '../api';
import type { DatacenterWithRacks, Rack } from '../types';
import { ChevronLeft, Plus, Download, Settings, Trash2, Upload } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const GridView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [dc, setDc] = useState<DatacenterWithRacks | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDcModalOpen, setIsDcModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAnalysis, setImportAnalysis] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newRack, setNewRack] = useState({ name: '', x_coord: 0, y_coord: 0, height_u: 42 });
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [editRackData, setEditRackData] = useState({ name: '', x: 0, y: 0, h: 42 });
  const [dcData, setDcData] = useState({ name: '', address: '', description: '', width: 10, height: 10 });

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImportFile(file);
      setImportAnalysis(null);
      setImportError(null);
      setImportSuccess(false);
      
      if (id) {
        setIsSubmitting(true);
        analyzeImport(parseInt(id), file)
          .then(data => {
            setImportAnalysis(data);
            if (!data.valid) {
              setImportError("Validation errors found in file. Please correct them below before executing.");
            }
          })
          .catch(err => {
            const msg = err.response?.data?.detail || err.message || "Failed to analyze import file.";
            setImportError(msg);
          })
          .finally(() => {
            setIsSubmitting(false);
          });
      }
    }
  };

  const executeImport = () => {
    if (!id || !importAnalysis || !importAnalysis.valid) return;
    setIsSubmitting(true);
    setImportError(null);
    commitImport(parseInt(id), importAnalysis)
      .then(() => {
        setImportSuccess(true);
        fetchDC();
      })
      .catch(err => {
        const msg = err.response?.data?.detail || err.message || "Failed to execute import.";
        setImportError(msg);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const fetchDC = () => {
    if (id) {
      setLoading(true);
      getDatacenter(parseInt(id))
        .then(data => {
          setDc(data);
          setDcData({
            name: data.name,
            address: data.address,
            description: data.description || '',
            width: data.width,
            height: data.height
          });
        })
        .catch(err => {
          console.error("Failed to fetch datacenter:", err);
          setError("Failed to load floor plan.");
        })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchDC();
  }, [id]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (id && isAdmin) {
      setIsSubmitting(true);
      setError(null);
      createRack({ ...newRack, datacenter_id: parseInt(id) })
        .then(() => {
          setIsModalOpen(false);
          setNewRack({ name: '', x_coord: 0, y_coord: 0, height_u: 42 });
          fetchDC();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to place rack: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const openEditModal = (rack: Rack) => {
    setSelectedRack(rack);
    setEditRackData({ name: rack.name, x: rack.x_coord, y: rack.y_coord, h: rack.height_u });
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateRack = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRack && isAdmin) {
      setIsSubmitting(true);
      setError(null);
      updateRack(selectedRack.id, { 
        name: editRackData.name,
        x_coord: editRackData.x, 
        y_coord: editRackData.y,
        height_u: editRackData.h
      })
        .then(() => {
          setIsEditModalOpen(false);
          fetchDC();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to update rack: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const handleDeleteRack = () => {
    if (selectedRack && isAdmin && window.confirm(`Are you sure you want to delete rack ${selectedRack.name} and all its devices?`)) {
      setIsSubmitting(true);
      deleteRack(selectedRack.id)
        .then(() => {
          setIsEditModalOpen(false);
          fetchDC();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to delete rack: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const handleUpdateDC = (e: React.FormEvent) => {
    e.preventDefault();
    if (dc && isAdmin) {
      setIsSubmitting(true);
      setError(null);
      updateDatacenter(dc.id, dcData)
        .then(() => {
          setIsDcModalOpen(false);
          fetchDC();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to update location: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const handleDeleteDC = () => {
    if (dc && isAdmin && window.confirm(`DANGER: Are you sure you want to delete ${dc.name}? This will delete ALL racks and devices in this location.`)) {
      setIsSubmitting(true);
      deleteDatacenter(dc.id)
        .then(() => {
          navigate('/');
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to delete location: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  const matchesSearch = (rack: any) => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    
    // Match rack name
    if (rack.name.toLowerCase().includes(term)) return true;
    
    // Match any device attribute
    if (rack.devices && Array.isArray(rack.devices)) {
      return rack.devices.some((device: any) => {
        if (device.name && device.name.toLowerCase().includes(term)) return true;
        if (device.device_type && device.device_type.toLowerCase().includes(term)) return true;
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
      });
    }
    
    return false;
  };

  if (loading && !dc) return <div className="text-center py-10">Loading floor plan...</div>;
  if (!dc) return <div className="text-center py-10">Datacenter not found.</div>;

  const maxX = dc.width;
  const maxY = dc.height;

  return (
    <div>
      <nav className="mb-4">
        <Link to="/" className="text-blue-600 hover:underline flex items-center gap-1 w-fit">
          <ChevronLeft size={16} />
          Back to Locations
        </Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dc.name}</h1>
          <p className="text-slate-600">{dc.address}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => downloadDatacenterExport(dc.id, dc.name)}
            className="flex items-center gap-1 bg-slate-100 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-200 transition-colors"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </button>
          {isAdmin && (
            <button 
              onClick={() => {
                setError(null);
                setImportFile(null);
                setImportAnalysis(null);
                setImportError(null);
                setImportSuccess(false);
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1 bg-slate-100 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-200 transition-colors"
            >
              <Upload size={18} />
              <span>Import Wizard</span>
            </button>
          )}
          {isAdmin && (
            <>
              <button 
                onClick={() => {
                  setError(null);
                  setIsDcModalOpen(true);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-200 transition-colors"
              >
                <Settings size={18} />
                <span>Edit Location</span>
              </button>
              <button 
                onClick={() => {
                  setError(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                <span>Place Rack</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dynamic Search & Highlights Bar */}
      <div className="mb-6 bg-slate-50 border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 w-full md:max-w-md relative">
          <input
            type="text"
            placeholder="🔍 Search devices (Name, IP, Owner, Type, Serial...)"
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
        <div className="text-xs text-slate-500 flex items-center gap-2">
          {searchTerm ? (
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold border border-blue-100 animate-pulse">
              Found {dc.racks.filter(matchesSearch).length} matching racks
            </span>
          ) : (
            <span>Type above to highlight coordinates of matching rack hardware in real-time.</span>
          )}
        </div>
      </div>

      {error && !isModalOpen && !isEditModalOpen && !isDcModalOpen && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-lg p-8 overflow-auto">
        <div 
          className="grid gap-2 mx-auto"
          style={{ 
            gridTemplateColumns: `repeat(${maxX}, 60px)`,
            width: 'fit-content'
          }}
        >
          {Array.from({ length: maxY }).map((_, y) => (
            Array.from({ length: maxX }).map((_, x) => {
              const rack = dc.racks.find(r => r.x_coord === x && r.y_coord === y);
              const isMatch = rack ? matchesSearch(rack) : false;
              return (
                <div 
                  key={`${x}-${y}`}
                  className={`group w-[60px] h-[60px] border rounded flex items-center justify-center relative transition-all ${
                    rack 
                      ? isMatch 
                        ? 'bg-blue-600 text-white ring-4 ring-blue-400 ring-opacity-70 shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse scale-105 z-10' 
                        : 'bg-slate-800 text-white' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {rack ? (
                    <>
                      <Link to={`/rack/${rack.id}`} className="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-0">
                        {rack.name}
                      </Link>
                      {isAdmin && (
                        <button 
                          onClick={() => openEditModal(rack)}
                          className="absolute top-0 right-0 p-1 bg-blue-600 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Edit Rack"
                        >
                          <Settings size={10} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span 
                      className={`text-slate-200 text-[8px] flex items-center justify-center w-full h-full ${isAdmin ? 'cursor-pointer hover:text-blue-400' : ''}`}
                      onClick={() => {
                        if (isAdmin) {
                          setError(null);
                          setNewRack({ ...newRack, x_coord: x, y_coord: y });
                          setIsModalOpen(true);
                        }
                      }}
                    >
                      {x},{y}
                    </span>
                  )}
                </div>
              );
            })
          ))}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Place New Rack">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Rack Name</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={newRack.name}
              onChange={e => setNewRack({...newRack, name: e.target.value})}
              placeholder="e.g. Rack-01"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">X Coordinate</label>
              <input 
                type="number"
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={newRack.x_coord}
                onChange={e => setNewRack({...newRack, x_coord: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y Coordinate</label>
              <input 
                type="number"
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={newRack.y_coord}
                onChange={e => setNewRack({...newRack, y_coord: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Height (U)</label>
            <input 
              type="number"
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
              value={newRack.height_u}
              onChange={e => setNewRack({...newRack, height_u: parseInt(e.target.value)})}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? 'Placing...' : 'Place Rack'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Rack: ${selectedRack?.name}`}>
        <form onSubmit={handleUpdateRack} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Rack Name</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={editRackData.name}
              onChange={e => setEditRackData({...editRackData, name: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">X Coordinate</label>
              <input 
                type="number"
                min="0"
                max={maxX - 1}
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={editRackData.x}
                onChange={e => setEditRackData({...editRackData, x: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Y Coordinate</label>
              <input 
                type="number"
                min="0"
                max={maxY - 1}
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={editRackData.y}
                onChange={e => setEditRackData({...editRackData, y: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Height (U)</label>
            <input 
              type="number"
              min="1"
              max="60"
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
              value={editRackData.h}
              onChange={e => setEditRackData({...editRackData, h: parseInt(e.target.value)})}
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={handleDeleteRack}
              disabled={isSubmitting}
              className="flex-1 bg-red-100 text-red-700 py-2 rounded font-bold hover:bg-red-200 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-[2] bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDcModalOpen} onClose={() => setIsDcModalOpen(false)} title="Edit Location">
        <form onSubmit={handleUpdateDC} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={dcData.name}
              onChange={e => setDcData({...dcData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input 
              required
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={dcData.address}
              onChange={e => setDcData({...dcData, address: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea 
              disabled={isSubmitting}
              className="w-full border rounded px-3 py-2 disabled:bg-slate-50"
              value={dcData.description}
              onChange={e => setDcData({...dcData, description: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Grid Width</label>
              <input 
                type="number"
                min="1"
                max="100"
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={dcData.width}
                onChange={e => setDcData({...dcData, width: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grid Height</label>
              <input 
                type="number"
                min="1"
                max="100"
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={dcData.height}
                onChange={e => setDcData({...dcData, height: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              type="button"
              onClick={handleDeleteDC}
              disabled={isSubmitting}
              className="flex-1 bg-red-100 text-red-700 py-2 rounded font-bold hover:bg-red-200 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-[2] bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Bulk Datacenter Importer Wizard" size="3xl">
        <div className="space-y-6">
          {importSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold text-slate-800">Import Completed Successfully!</h3>
              <p className="text-sm text-slate-600">
                Created/updated <strong>{importAnalysis?.racks?.length || 0}</strong> racks and housed <strong>{importAnalysis?.devices?.length || 0}</strong> devices successfully inside SQLite.
              </p>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Close Wizard
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border rounded-lg p-4 text-xs text-slate-600 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">CSV Data Template Format</h4>
                <p>Upload a CSV file containing racks and devices. Standard column headers mapped automatically:</p>
                <div className="font-mono bg-slate-900 text-slate-200 p-2 rounded overflow-x-auto text-[10px]">
                  Type,Name,Rack,X Coord,Y Coord,Start U,U Height,Device Type,IP Addresses,Management IP<br/>
                  rack,Rack-A,,2,3,,42,,,<br/>
                  device,core-switch-01,Rack-A,,,1,2,TOR Switch,10.0.0.1,10.0.0.254<br/>
                  device,web-srv-12,Rack-A,,,15,2,Server,192.168.1.12,
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  * Coordinates are 0-indexed and must stay within the floor plan dimensions. U-slots are validated for overlapping conflicts.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Select Datacenter CSV Template</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFileChange}
                  disabled={isSubmitting}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white hover:border-slate-400 cursor-pointer disabled:opacity-50"
                />
                {importFile && (
                  <div className="text-xs text-slate-500 mt-1">
                    Selected file: <strong>{importFile.name}</strong> ({(importFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 py-6 text-blue-600 animate-pulse text-sm">
                  <span className="animate-spin border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-pulse" />
                  <span>Parsing records and executing structural assertions...</span>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg space-y-2">
                  <span className="font-bold text-sm block">⚠️ Import Execution Alert</span>
                  <p className="text-xs font-semibold">{importError}</p>
                  
                  {importAnalysis?.errors && importAnalysis.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto text-[11px] font-mono space-y-1 mt-2 bg-red-100/50 p-2 rounded border border-red-200/50">
                      {importAnalysis.errors.map((err: string, i: number) => (
                        <div key={i} className="text-red-800">Line Check Error: {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importAnalysis && !isSubmitting && (
                <div className="space-y-4">
                  {importAnalysis.valid && (
                    <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      <span>Analysis verification complete! 0 boundary errors, 0 slot overlaps. 100% safe to commit.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-lg">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-2">Racks ({importAnalysis.racks.length})</span>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {importAnalysis.racks.map((r: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[11px] bg-white border border-slate-100 px-2 py-1 rounded">
                            <span className="font-semibold text-slate-700">{r.name}</span>
                            <span className="text-slate-500">Coord: ({r.x_coord},{r.y_coord}) | {r.height_u}U</span>
                          </div>
                        ))}
                        {importAnalysis.racks.length === 0 && (
                          <span className="text-slate-400 italic text-[11px] block text-center py-4">No new racks</span>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-100 bg-slate-50/50 p-3 rounded-lg">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-2">Devices ({importAnalysis.devices.length})</span>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {importAnalysis.devices.map((d: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-[11px] bg-white border border-slate-100 px-2 py-1 rounded">
                            <span className="font-semibold text-slate-700 truncate max-w-[120px]">{d.name}</span>
                            <span className="text-slate-500 shrink-0">{d.rack_name} | U{d.start_u} ({d.u_height}U)</span>
                          </div>
                        ))}
                        {importAnalysis.devices.length === 0 && (
                          <span className="text-slate-400 italic text-[11px] block text-center py-4">No devices</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {importAnalysis.valid && (
                    <button
                      type="button"
                      onClick={executeImport}
                      disabled={isSubmitting}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow"
                    >
                      <span>Execute Import Transaction ({importAnalysis.racks.length + importAnalysis.devices.length} elements)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default GridView;

