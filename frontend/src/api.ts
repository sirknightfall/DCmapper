import axios from 'axios';
import type { Datacenter, DatacenterWithRacks, Rack, RackWithDevices, Device, SystemConfig, StatusHistory } from './types';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // If no env var, use the current window hostname but port 8000
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
});

export const getDatacenters = () => api.get<Datacenter[]>('/datacenters/').then((res: any) => res.data);
export const getDatacenter = (id: number) => api.get<DatacenterWithRacks>(`/datacenters/${id}`).then((res: any) => res.data);
export const getRack = (id: number) => api.get<RackWithDevices>(`/racks/${id}`).then((res: any) => res.data);
export const getRacks = () => api.get<Rack[]>('/racks/').then((res: any) => res.data);
export const createDatacenter = (dc: Omit<Datacenter, 'id'>) => api.post<Datacenter>('/datacenters/', dc).then((res: any) => res.data);
export const createRack = (rack: Omit<Rack, 'id'>) => api.post<Rack>('/racks/', rack).then((res: any) => res.data);
export const updateRack = (id: number, rack: Partial<Rack>) => api.patch<Rack>(`/racks/${id}`, rack).then((res: any) => res.data);
export const createDevice = (device: any) => api.post<Device>('/devices/', device).then((res: any) => res.data);
export const updateDevice = (id: number, device: Partial<Device>) => api.patch<Device>(`/devices/${id}`, device).then((res: any) => res.data);
export const deleteDevice = (id: number) => api.delete(`/devices/${id}`).then((res: any) => res.data);

export const getConfig = () => api.get<SystemConfig>('/config/').then((res: any) => res.data);
export const updateConfig = (config: Partial<SystemConfig>) => api.patch<SystemConfig>('/config/', config).then((res: any) => res.data);

export const getDeviceHistory = (deviceId: number) => api.get<StatusHistory[]>(`/devices/${deviceId}/history`).then((res: any) => res.data);

export const getDatacenterExportUrl = (dcId: number) => `${API_URL}/datacenters/${dcId}/export`;
