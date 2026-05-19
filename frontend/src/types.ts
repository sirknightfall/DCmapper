export interface Datacenter {
  id: number;
  name: string;
  address: string;
  description?: string;
}

export interface Rack {
  id: number;
  name: string;
  datacenter_id: number;
  x_coord: number;
  y_coord: number;
  height_u: number;
}

export interface Device {
  id: number;
  name: string;
  description?: string;
  device_type: string;
  vendor_model: string;
  rack_id: number;
  start_u: number;
  u_height: number;
  ip_addresses: string;
  management_ip?: string;
  management_link?: string;
  status: 'Online' | 'Offline' | 'Unknown';
  last_checked?: string;
}

export interface DatacenterWithRacks extends Datacenter {
  racks: Rack[];
}

export interface RackWithDevices extends Rack {
  devices: Device[];
}
