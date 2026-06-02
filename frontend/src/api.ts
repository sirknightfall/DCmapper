import axios from 'axios';
import type { Datacenter, DatacenterWithRacks, Rack, RackWithDevices, Device, SystemConfig, StatusHistory, DeviceField } from './types';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  
  // In production (served via Nginx in Docker), use the relative reverse proxy path /api
  if (import.meta.env.PROD) {
    return '/api';
  }
  
  // In local development, fall back to port 8000 on the host
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

// Add response interceptor to handle token expiration/invalidation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (data: any) => api.post('/token', data).then((res: any) => res.data);
export const getMe = () => api.get('/users/me/').then((res: any) => res.data);
export const getUsers = () => api.get('/users/').then((res: any) => res.data);
export const createUser = (user: any) => api.post('/users/', user).then((res: any) => res.data);
export const updateOwnPassword = (data: any) => api.patch('/users/me/password', data).then((res: any) => res.data);
export const resetPassword = (userId: number, data: any) => api.patch(`/users/${userId}/password`, data).then((res: any) => res.data);
export const deleteUser = (userId: number) => api.delete(`/users/${userId}`).then((res: any) => res.data);

// Datacenters
export const getDatacenters = () => api.get<DatacenterWithRacks[]>('/datacenters/').then((res: any) => res.data);
export const getDatacenter = (id: number) => api.get<DatacenterWithRacks>(`/datacenters/${id}`).then((res: any) => res.data);
export const createDatacenter = (dc: Omit<Datacenter, 'id'>) => api.post<Datacenter>('/datacenters/', dc).then((res: any) => res.data);
export const updateDatacenter = (id: number, dc: Partial<Datacenter>) => api.patch<Datacenter>(`/datacenters/${id}`, dc).then((res: any) => res.data);
export const deleteDatacenter = (id: number) => api.delete(`/datacenters/${id}`).then((res: any) => res.data);
export const downloadDatacenterExport = (dcId: number, dcName: string) => {
  return api.get(`/datacenters/${dcId}/export`, { responseType: 'blob' })
    .then((res: any) => {
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dc_${dcName.replace(/\s+/g, '_')}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    });
};

export const analyzeImport = (dcId: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/datacenters/${dcId}/import/analyze`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }).then((res: any) => res.data);
};

export const commitImport = (dcId: number, payload: { racks: any[]; devices: any[] }) => {
  return api.post(`/datacenters/${dcId}/import/commit`, payload).then((res: any) => res.data);
};

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
export const pingDevice = (deviceId: number) => api.get<{ success: boolean; ip: string; output: string; status: string; timestamp: string }>(`/devices/${deviceId}/ping`).then((res: any) => res.data);

// Config
export const getConfig = () => api.get<SystemConfig>('/config/').then((res: any) => res.data);
export const updateConfig = (config: Partial<SystemConfig>) => api.patch<SystemConfig>('/config/', config).then((res: any) => res.data);

// Device Fields
export const getDeviceFields = () => api.get<DeviceField[]>('/device-fields/').then((res: any) => res.data);
export const createDeviceField = (field: Omit<DeviceField, 'id' | 'name' | 'is_custom' | 'is_active'>) => api.post<DeviceField>('/device-fields/', field).then((res: any) => res.data);
export const updateDeviceField = (id: number, field: Partial<DeviceField>) => api.patch<DeviceField>(`/device-fields/${id}`, field).then((res: any) => res.data);
export const deleteDeviceField = (id: number) => api.delete(`/device-fields/${id}`).then((res: any) => res.data);
export const getActivityLogs = () => api.get<any[]>('/activity-logs/').then((res: any) => res.data);

