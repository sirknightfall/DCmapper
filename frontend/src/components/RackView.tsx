import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRack, createDevice, updateDevice, deleteDevice, getDatacenters, getRacks } from '../api';
import type { RackWithDevices, Device, Datacenter, Rack } from '../types';
import { ChevronLeft, Plus, ExternalLink, Activity, Trash2, Move } from 'lucide-react';
import Modal from './Modal';

const RackView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rack, setRack] = useState<RackWithDevices | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [allDCs, setAllDCs] = useState<Datacenter[]>([]);
  const [allRacks, setAllRacks] = useState<Rack[]>([]);
  const [moveData, setMoveData] = useState({
    dcId: 0,
    rackId: 0,
    startU: 1
  });
  
  const [newDevice, setNewDevice] = useState({
    name: '',
    description: '',
    device_type: 'Server',
    vendor_model: '',
    start_u: 1,
    u_height: 1,
    ip_addresses: '',
    management_ip: '',
    management_link: ''
  });

  const fetchRack = () => {
    if (id) {
      setLoading(true);
      getRack(parseInt(id))
        .then(setRack)
        .finally(() => setLoading(false));
    }
  };

  const fetchMoveResources = () => {
    Promise.all([getDatacenters(), getRacks()]).then(([dcs, racks]) => {
      setAllDCs(dcs);
      setAllRacks(racks);
    });
  };

  useEffect(() => {
    fetchRack();
  }, [id]);

  const handleDelete = (deviceId: number) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      deleteDevice(deviceId).then(() => {
        fetchRack();
      });
    }
  };

  const openMoveModal = (device: Device) => {
    setSelectedDevice(device);
    setMoveData({
      dcId: rack?.datacenter_id || 0,
      rackId: device.rack_id,
      startU: device.start_u
    });
    fetchMoveResources();
    setIsMoveModalOpen(true);
  };

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDevice) {
      updateDevice(selectedDevice.id, { 
        rack_id: moveData.rackId, 
        start_u: moveData.startU 
      }).then(() => {
        setIsMoveModalOpen(false);
        fetchRack();
      });
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (id) {
      createDevice({ ...newDevice, rack_id: parseInt(id) }).then(() => {
        setIsModalOpen(false);
        setNewDevice({
          name: '',
          description: '',
          device_type: 'Server',
          vendor_model: '',
          start_u: 1,
          u_height: 1,
          ip_addresses: '',
          management_ip: '',
          management_link: ''
        });
        fetchRack();
      });
    }
  };

  if (loading && !rack) return <div className="text-center py-10">Loading rack view...</div>;
  if (!rack) return <div className="text-center py-10">Rack not found.</div>;

  const uSlots = Array.from({ length: rack.height_u }, (_, i) => rack.height_u - i);

  const getDeviceAtU = (u: number) => {
    return rack.devices.find(d => u >= d.start_u && u < d.start_u + d.u_height);
  };

  return (
    <div>
      <nav className="mb-4">
        <Link to={`/datacenter/${rack.datacenter_id}`} className="text-blue-600 hover:underline flex items-center gap-1">
          <ChevronLeft size={16} />
          Back to Floor Plan
        </Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{rack.name}</h1>
          <p className="text-slate-600">{rack.height_u}U Server Rack</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          <Plus size={18} />
          <span>Add Device</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="bg-slate-300 p-4 rounded-t-xl border-x-8 border-t-8 border-slate-400 w-full md:w-96">
          <div className="flex flex-col gap-1 bg-slate-900 p-2 min-h-[600px]">
            {uSlots.map(u => {
              const device = getDeviceAtU(u);
              const isStart = device?.start_u === u;
              
              if (device && !isStart) return null;

              return (
                <div 
                  key={u}
                  className={`relative flex items-center px-3 border border-slate-800 rounded text-xs font-mono
                    ${device ? 'bg-blue-900 text-blue-100 cursor-pointer hover:bg-blue-800' : 'bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-700'}
                  `}
                  style={{ height: device ? `${device.u_height * 2.5}rem` : '2rem' }}
                  onClick={() => {
                    if (!device) {
                      setNewDevice({ ...newDevice, start_u: u });
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <span className="absolute -left-6 text-slate-400 text-[10px] w-4 text-right">{u}</span>
                  {device ? (
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          device.status === 'Online' ? 'bg-green-500 shadow-[0_0_5px_green]' : 
                          device.status === 'Offline' ? 'bg-red-500' : 'bg-slate-500'
                        }`} />
                        <span>{device.name}</span>
                      </div>
                      <span className="text-[10px] opacity-60">{device.device_type}</span>
                    </div>
                  ) : (
                    <span>---</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} />
            Device Inventory
          </h2>
          <div className="space-y-4">
            {rack.devices.sort((a,b) => b.start_u - a.start_u).map(device => (
              <div key={device.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{device.name}</h3>
                    <p className="text-sm text-slate-500">{device.vendor_model} ({device.device_type})</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      device.status === 'Online' ? 'bg-green-100 text-green-700' : 
                      device.status === 'Offline' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {device.status}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openMoveModal(device)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Move Device"
                      >
                        <Move size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(device.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Device"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">IP Addresses</span>
                    <span>{device.ip_addresses}</span>
                  </div>
                  {device.management_ip && (
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Management</span>
                      <div className="flex items-center gap-2">
                        <span>{device.management_ip}</span>
                        {device.management_link && (
                          <a href={device.management_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {device.last_checked && (
                  <div className="mt-4 text-[10px] text-slate-400 italic">
                    Last checked: {new Date(device.last_checked).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
            {rack.devices.length === 0 && !loading && (
              <div className="py-10 text-center text-slate-500 bg-slate-50 border border-dashed rounded-lg">
                No devices in this rack.
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Device">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Device Name</label>
              <input required className="w-full border rounded px-3 py-2" value={newDevice.name} onChange={e => setNewDevice({...newDevice, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded px-3 py-2" value={newDevice.device_type} onChange={e => setNewDevice({...newDevice, device_type: e.target.value})}>
                <option>Server</option>
                <option>TOR Switch</option>
                <option>Load Balancer</option>
                <option>Patch Panel</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vendor/Model</label>
              <input required className="w-full border rounded px-3 py-2" value={newDevice.vendor_model} onChange={e => setNewDevice({...newDevice, vendor_model: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IP Addresses</label>
              <input required className="w-full border rounded px-3 py-2" value={newDevice.ip_addresses} onChange={e => setNewDevice({...newDevice, ip_addresses: e.target.value})} placeholder="1.2.3.4, 5.6.7.8" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start U</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={newDevice.start_u} onChange={e => setNewDevice({...newDevice, start_u: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (U)</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={newDevice.u_height} onChange={e => setNewDevice({...newDevice, u_height: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mgmt IP</label>
              <input className="w-full border rounded px-3 py-2" value={newDevice.management_ip} onChange={e => setNewDevice({...newDevice, management_ip: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mgmt Link</label>
              <input className="w-full border rounded px-3 py-2" value={newDevice.management_link} onChange={e => setNewDevice({...newDevice, management_link: e.target.value})} placeholder="https://..." />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
            Add Device
          </button>
        </form>
      </Modal>

      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title="Move Device">
        <form onSubmit={handleMove} className="space-y-4">
          <p className="text-sm text-slate-600 mb-4">
            Relocate <strong>{selectedDevice?.name}</strong> to a different rack or U position.
          </p>
          
          <div>
            <label className="block text-sm font-medium mb-1">Target Datacenter</label>
            <select 
              className="w-full border rounded px-3 py-2" 
              value={moveData.dcId} 
              onChange={e => {
                const newDcId = parseInt(e.target.value);
                const firstRackInDc = allRacks.find(r => r.datacenter_id === newDcId);
                setMoveData({
                  ...moveData, 
                  dcId: newDcId,
                  rackId: firstRackInDc ? firstRackInDc.id : 0
                });
              }}
            >
              {allDCs.map(dc => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Rack</label>
            <select 
              className="w-full border rounded px-3 py-2" 
              value={moveData.rackId} 
              onChange={e => setMoveData({...moveData, rackId: parseInt(e.target.value)})}
            >
              {allRacks.filter(r => r.datacenter_id === moveData.dcId).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Start U Position</label>
            <input 
              type="number" 
              required 
              className="w-full border rounded px-3 py-2" 
              value={moveData.startU} 
              onChange={e => setMoveData({...moveData, startU: parseInt(e.target.value)})} 
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Device height: {selectedDevice?.u_height}U
            </p>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
            Confirm Move
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default RackView;
