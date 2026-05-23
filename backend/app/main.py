from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import asyncio
from sqlmodel import Session, select
from app.database import create_db_and_tables, get_session, engine
from app.models import Datacenter, Rack, Device, SystemConfig, StatusHistory
from app.schemas import (
    DatacenterCreate, DatacenterRead, DatacenterWithRacks,
    RackCreate, RackRead, RackWithDevices,
    DeviceCreate, DeviceRead, DeviceUpdate,
    SystemConfigRead, SystemConfigUpdate,
    StatusHistoryRead
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
    # Ensure default config exists
    with Session(engine) as session:
        config = session.exec(select(SystemConfig)).first()
        if not config:
            config = SystemConfig(check_interval_seconds=60)
            session.add(config)
            session.commit()
            
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

def validate_device_placement(session: Session, rack_id: int, start_u: int, u_height: int, exclude_device_id: int = None):
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Target rack not found")
    
    # Check rack height constraints
    if start_u < 1:
        raise HTTPException(status_code=400, detail="Start U must be at least 1")
    if start_u + u_height - 1 > rack.height_u:
        raise HTTPException(status_code=400, detail=f"Device exceeds rack height ({rack.height_u}U)")
    
    # Check for overlaps
    statement = select(Device).where(Device.rack_id == rack_id)
    if exclude_device_id:
        statement = statement.where(Device.id != exclude_device_id)
    
    existing_devices = session.exec(statement).all()
    
    proposed_end = start_u + u_height
    for device in existing_devices:
        device_end = device.start_u + device.u_height
        # Overlap if: (StartA < EndB) and (StartB < EndA)
        if start_u < device_end and device.start_u < proposed_end:
            raise HTTPException(
                status_code=400, 
                detail=f"Placement overlap with device '{device.name}' ({device.start_u}U-{device_end-1}U)"
            )

@app.post("/devices/", response_model=DeviceRead)
def create_device(device: DeviceCreate, session: Session = Depends(get_session)):
    validate_device_placement(session, device.rack_id, device.start_u, device.u_height)
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
    
    # Determine new values for validation
    new_rack_id = device_update.rack_id if device_update.rack_id is not None else db_device.rack_id
    new_start_u = device_update.start_u if device_update.start_u is not None else db_device.start_u
    new_u_height = device_update.u_height if device_update.u_height is not None else db_device.u_height
    
    # Validate if position or rack changed
    if (new_rack_id != db_device.rack_id or 
        new_start_u != db_device.start_u or 
        new_u_height != db_device.u_height):
        validate_device_placement(session, new_rack_id, new_start_u, new_u_height, exclude_device_id=device_id)

    device_data = device_update.dict(exclude_unset=True)
    for key, value in device_data.items():
        setattr(db_device, key, value)
    
    session.add(db_device)
    session.commit()
    session.refresh(db_device)
    return db_device

@app.get("/devices/{device_id}/history", response_model=List[StatusHistoryRead])
def read_device_history(device_id: int, session: Session = Depends(get_session)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Return history ordered by timestamp
    statement = select(StatusHistory).where(StatusHistory.device_id == device_id).order_by(StatusHistory.timestamp)
    history = session.exec(statement).all()
    return history

@app.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    session.delete(device)
    session.commit()
    return {"ok": True}

# --- Config Routes ---

@app.get("/config/", response_model=SystemConfigRead)
def get_config(session: Session = Depends(get_session)):
    config = session.exec(select(SystemConfig)).first()
    if not config:
        # Fallback if somehow missing
        config = SystemConfig(check_interval_seconds=60)
        session.add(config)
        session.commit()
        session.refresh(config)
    return config

@app.patch("/config/", response_model=SystemConfigRead)
def update_config(config_update: SystemConfigUpdate, session: Session = Depends(get_session)):
    config = session.exec(select(SystemConfig)).first()
    if not config:
        config = SystemConfig()
    
    config.check_interval_seconds = config_update.check_interval_seconds
    session.add(config)
    session.commit()
    session.refresh(config)
    return config
