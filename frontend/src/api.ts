import axios from 'axios';
import type { Datacenter, DatacenterWithRacks, Rack, RackWithDevices, Device } from './types';

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
export const createDatacenter = (dc: Omit<Datacenter, 'id'>) => api.post<Datacenter>('/datacenters/', dc).then((res: any) => res.data);
export const createRack = (rack: Omit<Rack, 'id'>) => api.post<Rack>('/racks/', rack).then((res: any) => res.data);
export const createDevice = (device: any) => api.post<Device>('/devices/', device).then((res: any) => res.data);
