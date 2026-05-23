from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Datacenter Schemas
class DatacenterBase(BaseModel):
    name: str
    address: str
    description: Optional[str] = None

class DatacenterCreate(DatacenterBase):
    pass

class DatacenterRead(DatacenterBase):
    id: int

# Rack Schemas
class RackBase(BaseModel):
    name: str
    datacenter_id: int
    x_coord: int
    y_coord: int
    height_u: int = 42

class RackCreate(RackBase):
    pass

class RackRead(RackBase):
    id: int

# Device Schemas
class DeviceBase(BaseModel):
    name: str
    description: Optional[str] = None
    device_type: str
    vendor_model: str
    rack_id: int
    start_u: int
    u_height: int = 1
    ip_addresses: str
    management_ip: Optional[str] = None
    management_link: Optional[str] = None
    network_ports: Optional[str] = None
    owner: Optional[str] = None
    installation_date: Optional[datetime] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceRead(DeviceBase):
    id: int
    status: str
    last_checked: Optional[datetime] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    device_type: Optional[str] = None
    vendor_model: Optional[str] = None
    rack_id: Optional[int] = None
    start_u: Optional[int] = None
    u_height: Optional[int] = None
    ip_addresses: Optional[str] = None
    management_ip: Optional[str] = None
    management_link: Optional[str] = None
    network_ports: Optional[str] = None
    owner: Optional[str] = None
    installation_date: Optional[datetime] = None
    status: Optional[str] = None

# System Config Schemas
class SystemConfigRead(BaseModel):
    id: int
    check_interval_seconds: int

class SystemConfigUpdate(BaseModel):
    check_interval_seconds: int

# Status History Schemas
class StatusHistoryRead(BaseModel):
    id: int
    device_id: int
    status: str
    timestamp: datetime

# Nested relations for drill-down views
class RackWithDevices(RackRead):
    devices: List[DeviceRead] = []

class DatacenterWithRacks(DatacenterRead):
    racks: List[RackRead] = []
