from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Datacenter Schemas
class DatacenterBase(BaseModel):
    name: str
    address: str
    description: Optional[str] = None
    width: int = 10
    height: int = 10

class DatacenterCreate(DatacenterBase):
    pass

class DatacenterRead(DatacenterBase):
    id: int

class DatacenterUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

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

class RackUpdate(BaseModel):
    name: Optional[str] = None
    x_coord: Optional[int] = None
    y_coord: Optional[int] = None
    height_u: Optional[int] = None

# Device Schemas
class DeviceBase(BaseModel):
    name: str
    description: Optional[str] = None
    device_type: str
    vendor_model: Optional[str] = None
    rack_id: int
    start_u: int
    u_height: int = 1
    ip_addresses: Optional[str] = None
    management_ip: Optional[str] = None
    management_link: Optional[str] = None
    network_ports: Optional[str] = None
    owner: Optional[str] = None
    installation_date: Optional[datetime] = None
    custom_values: Optional[dict] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceRead(DeviceBase):
    id: int
    status: str
    last_checked: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

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
    custom_values: Optional[dict] = None

# Device Field Schemas
class DeviceFieldCreate(BaseModel):
    label: str
    field_type: str = "text"
    required: bool = False

class DeviceFieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    required: Optional[bool] = None
    is_active: Optional[bool] = None


# System Config Schemas
class SystemConfigRead(BaseModel):
    id: int
    check_interval_seconds: int
    retention_days: int

class SystemConfigUpdate(BaseModel):
    check_interval_seconds: Optional[int] = None
    retention_days: Optional[int] = None

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

class DatacenterWithRacksAndDevices(DatacenterRead):
    racks: List[RackWithDevices] = []

# Auth Schemas
class UserRead(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "viewer"

class UserUpdatePassword(BaseModel):
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class ActivityLogRead(BaseModel):
    id: int
    username: str
    action: str
    details: str
    timestamp: datetime
