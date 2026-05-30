export interface Datacenter {
  id: number;
  name: string;
  address: string;
  description?: string;
  width: number;
  height: number;
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
  vendor_model?: string;
  rack_id: number;
  start_u: number;
  u_height: number;
  ip_addresses?: string;
  management_ip?: string;
  management_link?: string;
  network_ports?: string;
  owner?: string;
  installation_date?: string;
  custom_values?: Record<string, any>;
  status: 'Online' | 'Offline' | 'Unknown';
  last_checked?: string;
}

export interface DeviceField {
  id: number;
  name: string;
  label: string;
  field_type: string; // 'text' | 'number' | 'date' | 'url'
  required: boolean;
  is_custom: boolean;
  is_active: boolean;
}


export interface DatacenterWithRacks extends Datacenter {
  racks: Rack[];
}

export interface RackWithDevices extends Rack {
  devices: Device[];
}

export interface SystemConfig {
  id: number;
  check_interval_seconds: number;
  retention_days: number;
}

export interface StatusHistory {
  id: number;
  device_id: number;
  status: 'Online' | 'Offline';
  timestamp: string;
}
