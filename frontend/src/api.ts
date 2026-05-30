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

// Add interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (data: any) => api.post('/token', data).then((res: any) => res.data);
export const getMe = () => api.get('/users/me/').then((res: any) => res.data);
export const getUsers = () => api.get('/users/').then((res: any) => res.data);
export const createUser = (user: any) => api.post('/users/', user).then((res: any) => res.data);
export const updateOwnPassword = (data: any) => api.patch('/users/me/password', data).then((res: any) => res.data);
export const resetPassword = (userId: number, data: any) => api.patch(`/users/${userId}/password`, data).then((res: any) => res.data);
export const deleteUser = (userId: number) => api.delete(`/users/${userId}`).then((res: any) => res.data);

// Datacenters
export const getDatacenters = () => api.get<Datacenter[]>('/datacenters/').then((res: any) => res.data);
export const getDatacenter = (id: number) => api.get<DatacenterWithRacks>(`/datacenters/${id}`).then((res: any) => res.data);
export const createDatacenter = (dc: Omit<Datacenter, 'id'>) => api.post<Datacenter>('/datacenters/', dc).then((res: any) => res.data);
export const updateDatacenter = (id: number, dc: Partial<Datacenter>) => api.patch<Datacenter>(`/datacenters/${id}`, dc).then((res: any) => res.data);
export const deleteDatacenter = (id: number) => api.delete(`/datacenters/${id}`).then((res: any) => res.data);
export const getDatacenterExportUrl = (dcId: number) => `${API_URL}/datacenters/${dcId}/export`;

// Racks
export const getRack = (id: number) => api.get<RackWithDevices>(`/racks/${id}`).then((res: any) => res.data);
export const getRacks = () => api.get<Rack[]>('/racks/').then((res: any) => res.data);
export const createRack = (rack: Omit<Rack, 'id'>) => api.post<Rack>('/racks/', rack).then((res: any) => res.data);
export const updateRack = (id: number, rack: Partial<Rack>) => api.patch<Rack>(`/racks/${id}`, rack).then((res: any) => res.data);
export const deleteRack = (id: number) => api.delete(`/racks/${id}`).then((res: any) => res.data);

// Devices
export const createDevice = (device: any) => api.post<Device>('/devices/', device).then((res: any) => res.data);
export const updateDevice = (id: number, device: Partial<Device>) => api.patch<Device>(`/devices/${id}`, device).then((res: any) => res.data);
export const deleteDevice = (id: number) => api.delete(`/devices/${id}`).then((res: any) => res.data);
export const getDeviceHistory = (deviceId: number) => api.get<StatusHistory[]>(`/devices/${deviceId}/history`).then((res: any) => res.data);

// Config
export const getConfig = () => api.get<SystemConfig>('/config/').then((res: any) => res.data);
export const updateConfig = (config: Partial<SystemConfig>) => api.patch<SystemConfig>('/config/', config).then((res: any) => res.data);
