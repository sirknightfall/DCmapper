from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import asyncio
from sqlmodel import Session, select
from app.database import create_db_and_tables, get_session
from app.models import Datacenter, Rack, Device
from app.schemas import (
    DatacenterCreate, DatacenterRead, DatacenterWithRacks,
    RackCreate, RackRead, RackWithDevices,
    DeviceCreate, DeviceRead, DeviceUpdate
)
from app.tasks import status_monitor_task

app = FastAPI(title="DCmapper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    create_db_and_tables()
    # Start the background ping task
    asyncio.create_task(status_monitor_task())

# --- Datacenter Routes ---

@app.post("/datacenters/", response_model=DatacenterRead)
def create_datacenter(dc: DatacenterCreate, session: Session = Depends(get_session)):
    db_dc = Datacenter.from_orm(dc)
    session.add(db_dc)
    session.commit()
    session.refresh(db_dc)
    return db_dc

@app.get("/datacenters/", response_model=List[DatacenterRead])
def read_datacenters(offset: int = 0, limit: int = Query(default=100, le=100), session: Session = Depends(get_session)):
    datacenters = session.exec(select(Datacenter).offset(offset).limit(limit)).all()
    return datacenters

@app.get("/datacenters/{dc_id}", response_model=DatacenterWithRacks)
def read_datacenter(dc_id: int, session: Session = Depends(get_session)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    return dc

# --- Rack Routes ---

@app.post("/racks/", response_model=RackRead)
def create_rack(rack: RackCreate, session: Session = Depends(get_session)):
    db_rack = Rack.from_orm(rack)
    session.add(db_rack)
    session.commit()
    session.refresh(db_rack)
    return db_rack

@app.get("/racks/", response_model=List[RackRead])
def read_racks(offset: int = 0, limit: int = Query(default=100, le=100), session: Session = Depends(get_session)):
    racks = session.exec(select(Rack).offset(offset).limit(limit)).all()
    return racks

@app.get("/racks/{rack_id}", response_model=RackWithDevices)
def read_rack(rack_id: int, session: Session = Depends(get_session)):
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    return rack

# --- Device Routes ---

@app.post("/devices/", response_model=DeviceRead)
def create_device(device: DeviceCreate, session: Session = Depends(get_session)):
    db_device = Device.from_orm(device)
    session.add(db_device)
    session.commit()
    session.refresh(db_device)
    return db_device

@app.get("/devices/{device_id}", response_model=DeviceRead)
def read_device(device_id: int, session: Session = Depends(get_session)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@app.patch("/devices/{device_id}", response_model=DeviceRead)
def update_device(device_id: int, device_update: DeviceUpdate, session: Session = Depends(get_session)):
    db_device = session.get(Device, device_id)
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device_data = device_update.dict(exclude_unset=True)
    for key, value in device_data.items():
        setattr(db_device, key, value)
    
    session.add(db_device)
    session.commit()
    session.refresh(db_device)
    return db_device

@app.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    session.delete(device)
    session.commit()
    return {"ok": True}
