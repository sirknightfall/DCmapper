import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDatacenter, createRack, updateRack, getDatacenterExportUrl } from '../api';
import type { DatacenterWithRacks, Rack } from '../types';
import { ChevronLeft, Plus, Move, Download } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const GridView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [dc, setDc] = useState<DatacenterWithRacks | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newRack, setNewRack] = useState({ name: '', x_coord: 0, y_coord: 0, height_u: 42 });
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
  const [moveData, setMoveData] = useState({ x: 0, y: 0 });

  const fetchDC = () => {
    if (id) {
      setLoading(true);
      getDatacenter(parseInt(id))
        .then(setDc)
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

  const openMoveModal = (rack: Rack) => {
    setSelectedRack(rack);
    setMoveData({ x: rack.x_coord, y: rack.y_coord });
    setError(null);
    setIsMoveModalOpen(true);
  };

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRack && isAdmin) {
      setIsSubmitting(true);
      setError(null);
      updateRack(selectedRack.id, { x_coord: moveData.x, y_coord: moveData.y })
        .then(() => {
          setIsMoveModalOpen(false);
          fetchDC();
        })
        .catch(err => {
          const msg = err.response?.data?.detail || err.message || "Unknown error";
          setError(`Failed to move rack: ${msg}`);
        })
        .finally(() => setIsSubmitting(false));
    }
  };

  if (loading && !dc) return <div className="text-center py-10">Loading floor plan...</div>;
  if (!dc) return <div className="text-center py-10">Datacenter not found.</div>;

  const maxX = dc.width;
  const maxY = dc.height;

  return (
    <div>
      <nav className="mb-4">
        <Link to="/" className="text-blue-600 hover:underline flex items-center gap-1">
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
          <a 
            href={getDatacenterExportUrl(dc.id)}
            download
            className="flex items-center gap-1 bg-slate-100 text-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-200 transition-colors"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </a>
          {isAdmin && (
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
          )}
        </div>
      </div>

      {error && !isModalOpen && !isMoveModalOpen && (
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
              return (
                <div 
                  key={`${x}-${y}`}
                  className={`group w-[60px] h-[60px] border rounded flex items-center justify-center relative transition-colors ${rack ? 'bg-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                >
                  {rack ? (
                    <>
                      <Link to={`/rack/${rack.id}`} className="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-0">
                        {rack.name}
                      </Link>
                      {isAdmin && (
                        <button 
                          onClick={() => openMoveModal(rack)}
                          className="absolute top-0 right-0 p-1 bg-blue-600 text-white rounded-bl opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="Move Rack"
                        >
                          <Move size={10} />
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

      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title={`Move Rack: ${selectedRack?.name}`}>
        <form onSubmit={handleMove} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">New X Coordinate</label>
              <input 
                type="number"
                min="0"
                max={maxX - 1}
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={moveData.x}
                onChange={e => setMoveData({...moveData, x: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Y Coordinate</label>
              <input 
                type="number"
                min="0"
                max={maxY - 1}
                required
                disabled={isSubmitting}
                className="w-full border rounded px-3 py-2 disabled:bg-slate-50 font-mono"
                value={moveData.y}
                onChange={e => setMoveData({...moveData, y: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? 'Moving...' : 'Confirm Move'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default GridView;
