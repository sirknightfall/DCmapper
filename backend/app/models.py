from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

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
    vendor_model: str
    
    # Rack location
    rack_id: int = Field(foreign_key="rack.id")
    start_u: int
    u_height: int = Field(default=1)
    
    # Networking
    ip_addresses: str # Comma-separated or JSON string
    management_ip: Optional[str] = None
    management_link: Optional[str] = None
    
    # Other metadata
    network_ports: Optional[str] = None
    owner: Optional[str] = None
    installation_date: Optional[datetime] = None
    
    # Status
    status: str = Field(default="Unknown") # Online, Offline, Unknown
    last_checked: Optional[datetime] = None
    
    rack: Rack = Relationship(back_populates="devices")
    status_history: List["StatusHistory"] = Relationship(back_populates="device")

class StatusHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id")
    status: str # Online, Offline
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    device: Device = Relationship(back_populates="status_history")

class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    check_interval_seconds: int = Field(default=60)

