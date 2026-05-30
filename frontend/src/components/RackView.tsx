import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRack, createDevice, updateDevice, deleteDevice, getDatacenters, getRacks, getDeviceHistory, getDeviceFields } from '../api';
import type { RackWithDevices, Device, Datacenter, Rack, StatusHistory, DeviceField } from '../types';
import { ChevronLeft, Plus, ExternalLink, Activity, Trash2, Move, Edit2, Clock } from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const RackView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [rack, setRack] = useState<RackWithDevices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [historyData, setHistoryData] = useState<StatusHistory[]>([]);
  
  const [allDCs, setAllDCs] = useState<Datacenter[]>([]);
  const [allRacks, setAllRacks] = useState<Rack[]>([]);
  const [moveData, setMoveData] = useState({
    dcId: 0,
    rackId: 0,
    startU: 1
  });
  
  // Target Rack Preview state
  const [targetRack, setTargetRack] = useState<RackWithDevices | null>(null);
  const [targetRackLoading, setTargetRackLoading] = useState(false);
  
  const [deviceFields, setDeviceFields] = useState<DeviceField[]>([]);

  const [newDevice, setNewDevice] = useState<any>({
    name: '',
    description: '',
    device_type: 'Server',
    vendor_model: '',
    start_u: 1,
    u_height: 1,
    ip_addresses: '',
    management_ip: '',
    management_link: '',
    owner: '',
    network_ports: '',
    custom_values: {}
  });

  const [editDeviceData, setEditDeviceData] = useState<any>({
    name: '',
    description: '',
    device_type: 'Server',
    vendor_model: '',
    start_u: 1,
    u_height: 1,
    ip_addresses: '',
    management_ip: '',
    management_link: '',
    owner: '',
    network_ports: '',
    custom_values: {}
  });

  const fetchRack = () => {
    if (id) {
      setLoading(true);
      getRack(parseInt(id))
        .then(setRack)
        .catch(err => {
          console.error("Failed to fetch rack:", err);
          setError("Failed to load rack inventory.");
        })
        .finally(() => setLoading(false));
    }
  };

  const fetchMoveResources = () => {
    Promise.all([getDatacenters(), getRacks()]).then(([dcs, racks]) => {
      setAllDCs(dcs);
      setAllRacks(racks);
    });
  };

  const fetchTargetRack = (rackId: number) => {
    if (rackId > 0) {
      setTargetRackLoading(true);
      getRack(rackId)
        .then(setTargetRack)
        .catch(err => {
          console.error("Failed to fetch target rack:", err);
          setTargetRack(null);
        })
        .finally(() => setTargetRackLoading(false));
    } else {
      setTargetRack(null);
    }
  };

  useEffect(() => {
    fetchRack();
    getDeviceFields()
      .then(setDeviceFields)
      .catch(err => console.error("Failed to load device fields:", err));
  }, [id]);

  const clearModals = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setIsMoveModalOpen(false);
    setIsHistoryModalOpen(false);
    setTargetRack(null);
    setError(null);
  };

  const handleDelete = (deviceId: number) => {
    if (isAdmin && window.confirm('Are you sure you want to delete this device?')) {
      deleteDevice(deviceId).then(() => {
        fetchRack();
      }).catch(err => {
        alert(err.response?.data?.detail || "Failed to delete device.");
      });
    }
  };

  const openMoveModal = (device: Device) => {
    setSelectedDevice(device);
    const initialDcId = rack?.datacenter_id || 0;
    const initialRackId = device.rack_id;
    setMoveData({
      dcId: initialDcId,
      rackId: initialRackId,
      startU: device.start_u
    });
    fetchMoveResources();
    fetchTargetRack(initialRackId);
    setError(null);
    setIsMoveModalOpen(true);
  };

  const openEditModal = (device: Device) => {
    setSelectedDevice(device);
    setEditDeviceData({
      name: device.name,
      description: device.description || '',
      device_type: device.device_type,
      vendor_model: device.vendor_model || '',
      start_u: device.start_u,
      u_height: device.u_height,
      ip_addresses: device.ip_addresses || '',
      management_ip: device.management_ip || '',
      management_link: device.management_link || '',
      owner: (device as any).owner || '',
      network_ports: (device as any).network_ports || '',
      custom_values: device.custom_values || {}
    });
    setError(null);
    setIsEditModalOpen(true);
  };

  const openHistoryModal = (device: Device) => {
    setSelectedDevice(device);
    setHistoryData([]);
    setError(null);
    setIsHistoryModalOpen(true);
    getDeviceHistory(device.id)
      .then(setHistoryData)
      .catch(() => setError("Failed to load status history."));
  };

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedDevice && isAdmin) {
      updateDevice(selectedDevice.id, { 
        rack_id: moveData.rackId, 
        start_u: moveData.startU 
      }).then(() => {
        setIsMoveModalOpen(false);
        fetchRack();
      }).catch(err => {
        setError(err.response?.data?.detail || "Failed to move device.");
      });
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedDevice && isAdmin) {
      updateDevice(selectedDevice.id, editDeviceData).then(() => {
        setIsEditModalOpen(false);
        fetchRack();
      }).catch(err => {
        setError(err.response?.data?.detail || "Failed to update device.");
      });
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (id && isAdmin) {
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
          management_link: '',
          owner: '',
          network_ports: '',
          custom_values: {}
        });
        fetchRack();
      }).catch(err => {
        setError(err.response?.data?.detail || "Failed to create device.");
      });
    }
  };

  const renderDeviceDetails = (device: Device) => {
    const activeFields = deviceFields.filter(f => f.is_active);
    
    const getFieldValue = (field: DeviceField) => {
      if (!field.is_custom) {
        return device[field.name as keyof Device];
      } else {
        return device.custom_values?.[field.name];
      }
    };

    const populatedFields = activeFields.filter(field => {
      const val = getFieldValue(field);
      return val !== undefined && val !== null && val !== '';
    });

    if (populatedFields.length === 0) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-slate-50">
        {populatedFields.map((field) => {
          const val = getFieldValue(field);
          
          if (field.field_type === 'url') {
            return (
              <div key={field.id} className="col-span-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{field.label}</span>
                <a href={String(val)} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                  <span>Visit Link</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            );
          }

          if (field.field_type === 'date') {
            return (
              <div key={field.id} className="col-span-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{field.label}</span>
                <span>{new Date(String(val)).toLocaleDateString()}</span>
              </div>
            );
          }

          const isLong = field.name === 'description' || String(val).length > 40;
          return (
            <div key={field.id} className={isLong ? "col-span-2" : "col-span-1"}>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">{field.label}</span>
              <span className="whitespace-pre-wrap">{String(val)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDynamicFields = (deviceState: any, setDeviceState: any) => {
    const activeFields = deviceFields.filter(f => f.is_active);
    
    const getFieldValue = (field: DeviceField) => {
      if (!field.is_custom) {
        return deviceState[field.name] ?? '';
      } else {
        return deviceState.custom_values?.[field.name] ?? '';
      }
    };

    const setFieldValue = (field: DeviceField, val: any) => {
      if (!field.is_custom) {
        setDeviceState((prev: any) => ({ ...prev, [field.name]: val }));
      } else {
        setDeviceState((prev: any) => ({
          ...prev,
          custom_values: {
            ...(prev.custom_values || {}),
            [field.name]: val
          }
        }));
      }
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeFields.map((field) => {
          const val = getFieldValue(field);
          const inputId = `field_${field.name}`;
          const isFullWidth = field.name === 'description';
          
          if (isFullWidth) {
            return (
              <div key={field.id} className="col-span-1 md:col-span-2">
                <label htmlFor={inputId} className="block text-sm font-medium mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  id={inputId}
                  required={field.required}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={val}
                  onChange={e => setFieldValue(field, e.target.value)}
                />
              </div>
            );
          }

          let inputType = 'text';
          if (field.field_type === 'number') inputType = 'number';
          else if (field.field_type === 'date') inputType = 'date';
          else if (field.field_type === 'url') inputType = 'url';

          let displayVal = val;
          if (field.field_type === 'date' && val) {
            try {
              displayVal = new Date(val).toISOString().split('T')[0];
            } catch (e) {
              displayVal = val;
            }
          }

          return (
            <div key={field.id} className="col-span-1">
              <label htmlFor={inputId} className="block text-sm font-medium mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                id={inputId}
                type={inputType}
                required={field.required}
                placeholder={field.field_type === 'url' ? 'https://...' : ''}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={displayVal}
                onChange={e => {
                  let value: any = e.target.value;
                  if (field.field_type === 'number') {
                    value = value === '' ? '' : parseFloat(value);
                  }
                  setFieldValue(field, value);
                }}
              />
            </div>
          );
        })}
      </div>
    );
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
        {isAdmin && (
          <button 
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            <span>Add Device</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="bg-slate-300 p-4 rounded-t-xl border-x-8 border-t-8 border-slate-400 w-full md:w-96 shadow-inner">
          <div className="flex flex-col gap-1 bg-slate-900 p-2 min-h-[600px] rounded border border-slate-950">
            {uSlots.map(u => {
              const device = getDeviceAtU(u);
              const isStart = device?.start_u === u;
              
              if (device && !isStart) return null;

              return (
                <div 
                  key={u}
                  className={`relative flex items-center px-3 border border-slate-800 rounded text-xs font-mono transition-colors
                    ${device ? 'bg-blue-900 text-blue-100 cursor-pointer hover:bg-blue-800' : 
                      isAdmin ? 'bg-slate-800 text-slate-500 cursor-pointer hover:bg-slate-700' : 'bg-slate-800 text-slate-600 cursor-default'}
                  `}
                  style={{ height: device ? `${device.u_height * 2.5}rem` : '2rem' }}
                  onClick={() => {
                    if (!device) {
                      if (isAdmin) {
                        setNewDevice({ ...newDevice, start_u: u });
                        setIsModalOpen(true);
                      }
                    } else if (isStart) {
                      if (isAdmin) {
                        openEditModal(device);
                      } else {
                        openHistoryModal(device);
                      }
                    }
                  }}
                >
                  <span className="absolute -left-6 text-slate-400 text-[10px] w-4 text-right">{u}</span>
                  {device ? (
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-2 h-2 rounded-full cursor-help ${
                            device.status === 'Online' ? 'bg-green-500 shadow-[0_0_5px_green]' : 
                            device.status === 'Offline' ? 'bg-red-500' : 'bg-slate-500'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistoryModal(device);
                          }}
                          title="Click to view 24h history"
                        />
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
                    <button 
                      onClick={() => openHistoryModal(device)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-transform hover:scale-105 ${
                        device.status === 'Online' ? 'bg-green-100 text-green-700' : 
                        device.status === 'Offline' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}
                      title="View uptime history"
                    >
                      {device.status}
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openHistoryModal(device)}
                        className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Uptime History"
                      >
                        <Clock size={16} />
                      </button>
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => openEditModal(device)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Device"
                          >
                            <Edit2 size={16} />
                          </button>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {renderDeviceDetails(device)}

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

      <Modal isOpen={isModalOpen} onClose={clearModals} title="Add New Device">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200 mb-2">{error}</div>}
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
              <label className="block text-sm font-medium mb-1">Start U</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={newDevice.start_u} onChange={e => setNewDevice({...newDevice, start_u: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (U)</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={newDevice.u_height} onChange={e => setNewDevice({...newDevice, u_height: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Device Properties</h3>
            {renderDynamicFields(newDevice, setNewDevice)}
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
            Add Device
          </button>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={clearModals} title="Edit Device Details">
        <form onSubmit={handleUpdate} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200 mb-2">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Device Name</label>
              <input required className="w-full border rounded px-3 py-2" value={editDeviceData.name} onChange={e => setEditDeviceData({...editDeviceData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border rounded px-3 py-2" value={editDeviceData.device_type} onChange={e => setEditDeviceData({...editDeviceData, device_type: e.target.value})}>
                <option>Server</option>
                <option>TOR Switch</option>
                <option>Load Balancer</option>
                <option>Patch Panel</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start U</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={editDeviceData.start_u} onChange={e => setEditDeviceData({...editDeviceData, start_u: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (U)</label>
              <input type="number" required className="w-full border rounded px-3 py-2" value={editDeviceData.u_height} onChange={e => setEditDeviceData({...editDeviceData, u_height: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Device Properties</h3>
            {renderDynamicFields(editDeviceData, setEditDeviceData)}
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
            Save Changes
          </button>
        </form>
      </Modal>

      <Modal isOpen={isMoveModalOpen} onClose={clearModals} title="Move Device" size="3xl">
        <div className="flex flex-col md:flex-row gap-6">
          <form onSubmit={handleMove} className="flex-1 space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200 mb-2">{error}</div>}
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
                  const firstRackId = firstRackInDc ? firstRackInDc.id : 0;
                  setMoveData({
                    ...moveData, 
                    dcId: newDcId,
                    rackId: firstRackId
                  });
                  fetchTargetRack(firstRackId);
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
                onChange={e => {
                  const newRackId = parseInt(e.target.value);
                  setMoveData({...moveData, rackId: newRackId});
                  fetchTargetRack(newRackId);
                }}
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

          {/* Right Panel: Target Rack Preview */}
          <div className="flex-1 flex flex-col">
            {targetRackLoading ? (
              <div className="flex items-center justify-center flex-1 h-[300px] border border-dashed rounded text-xs text-slate-400">
                Loading target rack layout...
              </div>
            ) : targetRack ? (
              <div className="flex-1 border border-slate-700 bg-slate-950 p-3 rounded-lg flex flex-col max-h-[400px] overflow-hidden">
                <div className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1 flex justify-between items-center">
                  <span>Target Rack: {targetRack.name}</span>
                  <span className="text-[10px] text-slate-500">{targetRack.height_u}U capacity</span>
                </div>
                
                {/* Visual grid layout list */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-0.5 min-h-0">
                  {Array.from({ length: targetRack.height_u }, (_, i) => targetRack.height_u - i).map(u => {
                    const isProposed = selectedDevice && u >= moveData.startU && u < moveData.startU + selectedDevice.u_height;
                    const occupyingDevice = targetRack.devices.find(d => d.id !== selectedDevice?.id && u >= d.start_u && u < d.start_u + d.u_height);
                    const isCollision = isProposed && occupyingDevice;
                    const isOutOfBounds = selectedDevice && (moveData.startU < 1 || moveData.startU + selectedDevice.u_height - 1 > targetRack.height_u);
                    
                    let bgClass = "bg-slate-900 border-slate-800 text-slate-600 border border-dashed";
                    let content = "Empty Slot";
                    
                    if (isCollision) {
                      bgClass = "bg-red-950/80 border-red-500 text-red-200 border-2 font-bold animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.5)]";
                      content = `⚠️ Overlap: ${occupyingDevice.name}`;
                    } else if (isProposed) {
                      if (isOutOfBounds) {
                        bgClass = "bg-red-950/80 border-red-500 text-red-200 border-2 font-bold";
                        content = `⚠️ Out of bounds (Exceeds ${targetRack.height_u}U)`;
                      } else {
                        bgClass = "bg-blue-950/80 border-blue-500 text-blue-100 border-2 font-semibold shadow-[0_0_5px_rgba(59,130,246,0.5)]";
                        content = `✨ Moving: ${selectedDevice.name}`;
                      }
                    } else if (occupyingDevice) {
                      bgClass = "bg-slate-700 border-slate-500 text-slate-100 border font-medium";
                      content = occupyingDevice.name;
                    }
                    
                    return (
                      <div key={u} className={`flex items-center px-2 py-0.5 rounded text-[10px] font-mono h-6 transition-all ${bgClass}`}>
                        <span className="w-5 text-right text-[9px] text-slate-500 mr-2 pr-1 border-r border-slate-800">{u}</span>
                        <span className="truncate flex-1">{content}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend Guide */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-[9px]">
                  <div className="flex items-center gap-1 text-blue-400">
                    <span className="w-2.5 h-2.5 bg-blue-950 border border-blue-500 rounded-sm" />
                    <span>✨ Proposed Position</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <span className="w-2.5 h-2.5 bg-red-950 border border-red-500 rounded-sm" />
                    <span>⚠️ Slot Conflict / Error</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-200">
                    <span className="w-2.5 h-2.5 bg-slate-700 border border-slate-500 rounded-sm" />
                    <span>Housed Device</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="w-2.5 h-2.5 bg-slate-900 border border-slate-800 border-dashed rounded-sm" />
                    <span>Empty Slot</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 h-[300px] border border-dashed rounded text-xs text-slate-400">
                Select a target rack to view its layout
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={clearModals} title={`Status History: ${selectedDevice?.name}`}>
        <div className="max-h-[60vh] overflow-y-auto px-2">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-200 mb-4">{error}</div>}
          
          <div className="space-y-4">
            {historyData.length === 0 && !error && (
              <div className="text-center py-10 text-slate-500 italic text-sm">
                No history recorded yet. Background monitoring will collect data every check cycle.
              </div>
            )}
            
            {historyData.slice().reverse().map((entry, idx) => (
              <div key={entry.id} className="relative pl-6 border-l-2 border-slate-100 pb-4 last:pb-0">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                  entry.status === 'Online' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-xs font-bold ${
                      entry.status === 'Online' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {entry.status}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {idx < historyData.length - 1 && (
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
                      Step {idx + 1}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t text-[10px] text-slate-400 italic">
          Showing data for the last 24 hours. Older records are automatically pruned.
        </div>
      </Modal>
    </div>
  );
};

export default RackView;
