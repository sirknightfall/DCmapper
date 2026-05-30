from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

class Datacenter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    address: str
    description: Optional[str] = None
    width: int = Field(default=10)
    height: int = Field(default=10)
    
    racks: List["Rack"] = Relationship(back_populates="datacenter")

class Rack(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    datacenter_id: int = Field(foreign_key="datacenter.id")
    x_coord: int
    y_coord: int
    height_u: int = Field(default=42)
    
    datacenter: Datacenter = Relationship(back_populates="racks")
    devices: List["Device"] = Relationship(back_populates="rack")

class Device(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    device_type: str # e.g., Server, TOR Switch
    vendor_model: Optional[str] = None
    
    # Rack location
    rack_id: int = Field(foreign_key="rack.id")
    start_u: int
    u_height: int = Field(default=1)
    
    # Networking
    ip_addresses: Optional[str] = None # Comma-separated or JSON string
    management_ip: Optional[str] = None
    management_link: Optional[str] = None
    
    # Other metadata
    network_ports: Optional[str] = None
    owner: Optional[str] = None
    installation_date: Optional[datetime] = None
    
    # Custom values dictionary
    custom_values: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Status
    status: str = Field(default="Unknown") # Online, Offline, Unknown
    last_checked: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    rack: Rack = Relationship(back_populates="devices")
    status_history: List["StatusHistory"] = Relationship(back_populates="device")

class DeviceField(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True) # slug/key, e.g., "serial_number"
    label: str
    field_type: str = Field(default="text") # text, number, date, url
    required: bool = Field(default=False)
    is_custom: bool = Field(default=True)
    is_active: bool = Field(default=True)

class StatusHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id")
    status: str # Online, Offline
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    device: Device = Relationship(back_populates="status_history")

class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    check_interval_seconds: int = Field(default=60)
    retention_days: int = Field(default=365)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="viewer") # admin, viewer
    is_active: bool = Field(default=True)
    last_login: Optional[datetime] = None


