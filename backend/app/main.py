from fastapi import FastAPI, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import datetime, timedelta
import asyncio
import csv
import io
from sqlmodel import Session, select, text
from app.database import create_db_and_tables, get_session, engine
from app.models import Datacenter, Rack, Device, SystemConfig, StatusHistory, User, DeviceField
from app.schemas import (
    DatacenterCreate, DatacenterRead, DatacenterWithRacks, DatacenterUpdate,
    RackCreate, RackRead, RackWithDevices, RackUpdate,
    DeviceCreate, DeviceRead, DeviceUpdate,
    SystemConfigRead, SystemConfigUpdate,
    StatusHistoryRead,
    UserRead, UserCreate, UserUpdatePassword, Token,
    DeviceFieldCreate, DeviceFieldUpdate
)
from app.tasks import status_monitor_task, cleanup_deleted_devices_task
from app.auth import (
    get_password_hash, create_access_token, verify_password,
    get_current_active_user, require_admin, ACCESS_TOKEN_EXPIRE_MINUTES
)

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

    # Simple migration: add width/height to datacenter if missing
    with Session(engine) as session:
        try:
            session.execute(text("ALTER TABLE datacenter ADD COLUMN width INTEGER DEFAULT 10"))
            session.execute(text("ALTER TABLE datacenter ADD COLUMN height INTEGER DEFAULT 10"))
            session.commit()
        except Exception:
            session.rollback()

    # Simple migration: add deleted_at to device if missing
    with Session(engine) as session:
        try:
            session.execute(text("ALTER TABLE device ADD COLUMN deleted_at DATETIME DEFAULT NULL"))
            session.commit()
        except Exception:
            session.rollback()

    # Simple migration: add retention_days to systemconfig if missing
    with Session(engine) as session:
        try:
            session.execute(text("ALTER TABLE systemconfig ADD COLUMN retention_days INTEGER DEFAULT 365"))
            session.commit()
        except Exception:
            session.rollback()

    # Simple migration: add custom_values to device if missing
    with Session(engine) as session:
        try:
            session.execute(text("ALTER TABLE device ADD COLUMN custom_values TEXT DEFAULT '{}'"))
            session.commit()
        except Exception:
            session.rollback()

    # Ensure default fields exist
    try:
        with Session(engine) as session:
            field = session.exec(select(DeviceField)).first()
            if not field:
                print("Seeding default device fields...")
                default_fields = [
                    DeviceField(name="description", label="Description", field_type="text", required=False, is_custom=False, is_active=True),
                    DeviceField(name="vendor_model", label="Vendor / Model", field_type="text", required=True, is_custom=False, is_active=True),
                    DeviceField(name="ip_addresses", label="IP Addresses", field_type="text", required=True, is_custom=False, is_active=True),
                    DeviceField(name="management_ip", label="Management IP", field_type="text", required=False, is_custom=False, is_active=True),
                    DeviceField(name="management_link", label="Management Link", field_type="url", required=False, is_custom=False, is_active=True),
                    DeviceField(name="network_ports", label="Network Ports", field_type="text", required=False, is_custom=False, is_active=True),
                    DeviceField(name="owner", label="Owner", field_type="text", required=False, is_custom=False, is_active=True),
                    DeviceField(name="installation_date", label="Installation Date", field_type="date", required=False, is_custom=False, is_active=True),
                ]
                session.add_all(default_fields)
                session.commit()
                print("Device fields seeded successfully.")
    except Exception as e:
        print(f"Error seeding device fields: {e}")

    # Ensure default config exists
    try:
        with Session(engine) as session:
            config = session.exec(select(SystemConfig)).first()
            if not config:
                config = SystemConfig(check_interval_seconds=60, retention_days=365)
                session.add(config)
                session.commit()
    except Exception as e:
        print(f"Error initializing config: {e}")

    # Ensure default users exist
    with Session(engine) as session:
        try:
            admin = session.exec(select(User).where(User.username == "admin")).first()
            if not admin:
                print("Creating default admin user...")
                admin = User(
                    username="admin",
                    hashed_password=get_password_hash("admin"),
                    role="admin"
                )
                session.add(admin)
                session.commit()
                print("Admin user created successfully.")
            else:
                print("Admin user already exists.")
        except Exception as e:
            print(f"Error initializing admin user: {e}")
            session.rollback()
        
        try:
            viewer = session.exec(select(User).where(User.username == "viewer")).first()
            if not viewer:
                print("Creating default viewer user...")
                viewer = User(
                    username="viewer",
                    hashed_password=get_password_hash("viewer"),
                    role="viewer"
                )
                session.add(viewer)
                session.commit()
                print("Viewer user created successfully.")
            else:
                print("Viewer user already exists.")
        except Exception as e:
            print(f"Error initializing viewer user: {e}")
            session.rollback()

    # Start the background tasks
    asyncio.create_task(status_monitor_task())
    asyncio.create_task(cleanup_deleted_devices_task())

# --- Auth Routes ---

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    user.last_login = datetime.utcnow()
    session.add(user)
    session.commit()
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=UserRead)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.patch("/users/me/password", response_model=UserRead)
async def update_own_password(update: UserUpdatePassword, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)):
    current_user.hashed_password = get_password_hash(update.new_password)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

@app.get("/users/", response_model=List[UserRead])
async def read_users(session: Session = Depends(get_session), _: User = Depends(require_admin)):
    users = session.exec(select(User)).all()
    return users

@app.post("/users/", response_model=UserRead)
async def create_user(user: UserCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    # Check if exists
    existing = session.exec(select(User).where(User.username == user.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    db_user = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@app.patch("/users/{user_id}/password", response_model=UserRead)
async def reset_user_password(user_id: int, update: UserUpdatePassword, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.hashed_password = get_password_hash(update.new_password)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if db_user.username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own user")
    
    session.delete(db_user)
    session.commit()
    return {"ok": True}

# --- Datacenter Routes ---

@app.post("/datacenters/", response_model=DatacenterRead)
def create_datacenter(dc: DatacenterCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_dc = Datacenter.from_orm(dc)
    session.add(db_dc)
    session.commit()
    session.refresh(db_dc)
    return db_dc

@app.get("/datacenters/", response_model=List[DatacenterRead])
def read_datacenters(offset: int = 0, limit: int = Query(default=100, le=100), session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    datacenters = session.exec(select(Datacenter).offset(offset).limit(limit)).all()
    return datacenters

@app.get("/datacenters/{dc_id}", response_model=DatacenterWithRacks)
def read_datacenter(dc_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    return dc

@app.patch("/datacenters/{dc_id}", response_model=DatacenterRead)
def update_datacenter(dc_id: int, dc_update: DatacenterUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_dc = session.get(Datacenter, dc_id)
    if not db_dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    
    dc_data = dc_update.dict(exclude_unset=True)
    
    # Validation: Ensure resizing doesn't orphan racks
    new_width = dc_data.get("width", db_dc.width)
    new_height = dc_data.get("height", db_dc.height)
    
    if new_width < db_dc.width or new_height < db_dc.height:
        # Check if any racks are outside the new bounds
        statement = select(Rack).where(Rack.datacenter_id == dc_id)
        statement = statement.where((Rack.x_coord >= new_width) | (Rack.y_coord >= new_height))
        offending_rack = session.exec(statement).first()
        if offending_rack:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot resize: Rack '{offending_rack.name}' exists at {offending_rack.x_coord},{offending_rack.y_coord}"
            )
    
    for key, value in dc_data.items():
        setattr(db_dc, key, value)
    
    session.add(db_dc)
    session.commit()
    session.refresh(db_dc)
    return db_dc

@app.delete("/datacenters/{dc_id}")
def delete_datacenter(dc_id: int, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    
    # SQLModel/SQLAlchemy doesn't have automatic cascade delete configured in the models,
    # so we delete associated racks (and their devices)
    for rack in dc.racks:
        for device in rack.devices:
            session.delete(device)
        session.delete(rack)
    
    session.delete(dc)
    session.commit()
    return {"ok": True}

@app.get("/datacenters/{dc_id}/export")
def export_datacenter_csv(dc_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    
    # Get all racks in this DC
    racks = session.exec(select(Rack).where(Rack.datacenter_id == dc_id)).all()
    if not racks:
        # Return empty CSV with headers
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Name", "Type", "Vendor/Model", "Rack", "Start U", "Height", "IP Addresses", "Status", "Deleted At"])
        output.seek(0)
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=dc_{dc.name}_export.csv"})

    rack_ids = [r.id for r in racks]
    rack_map = {r.id: r.name for r in racks}
    
    # Get all devices in these racks, including deleted ones
    statement = select(Device).where(Device.rack_id.in_(rack_ids))
    devices = session.exec(statement).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Name", "Type", "Vendor/Model", "Rack", "Start U", "Height", 
        "IP Addresses", "Mgmt IP", "Owner", "Status", "Last Checked", "Deleted At"
    ])
    
    for d in devices:
        writer.writerow([
            d.name, d.device_type, d.vendor_model, rack_map.get(d.rack_id, "Unknown"), 
            d.start_u, d.u_height, d.ip_addresses, d.management_ip, d.owner,
            d.status, d.last_checked.isoformat() if d.last_checked else "Never",
            d.deleted_at.isoformat() if d.deleted_at else "Active"
        ])
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=dc_{dc.name}_export.csv"}
    )

# --- Rack Routes ---

@app.post("/racks/", response_model=RackRead)
def create_rack(rack: RackCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_rack = Rack.from_orm(rack)
    session.add(db_rack)
    session.commit()
    session.refresh(db_rack)
    return db_rack

@app.get("/racks/", response_model=List[RackRead])
def read_racks(offset: int = 0, limit: int = Query(default=100, le=100), session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    racks = session.exec(select(Rack).offset(offset).limit(limit)).all()
    return racks

@app.get("/racks/{rack_id}", response_model=RackWithDevices)
def read_rack(rack_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    # Filter out soft-deleted devices for the UI
    rack.devices = [d for d in rack.devices if d.deleted_at is None]
    return rack

@app.patch("/racks/{rack_id}", response_model=RackRead)
def update_rack(rack_id: int, rack_update: RackUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_rack = session.get(Rack, rack_id)
    if not db_rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    dc = session.get(Datacenter, db_rack.datacenter_id)
    
    # Validation if coordinates are changing
    new_x = rack_update.x_coord if rack_update.x_coord is not None else db_rack.x_coord
    new_y = rack_update.y_coord if rack_update.y_coord is not None else db_rack.y_coord
    
    if new_x != db_rack.x_coord or new_y != db_rack.y_coord:
        # 1. Boundary check
        if dc and (new_x < 0 or new_x >= dc.width or new_y < 0 or new_y >= dc.height):
            raise HTTPException(status_code=400, detail=f"Coordinates out of datacenter bounds ({dc.width}x{dc.height})")
        
        # 2. Overlap check
        statement = select(Rack).where(Rack.datacenter_id == db_rack.datacenter_id).where(Rack.id != rack_id)
        statement = statement.where(Rack.x_coord == new_x).where(Rack.y_coord == new_y)
        existing_rack = session.exec(statement).first()
        if existing_rack:
            raise HTTPException(status_code=400, detail=f"A rack named '{existing_rack.name}' already exists at {new_x},{new_y}")

    rack_data = rack_update.dict(exclude_unset=True)
    
    # Validation: Ensure resizing doesn't orphan devices
    new_height_u = rack_data.get("height_u", db_rack.height_u)
    if new_height_u < db_rack.height_u:
        # Check if any devices exceed the new height
        # Only check active devices (deleted_at is None)
        statement = select(Device).where(Device.rack_id == rack_id).where(Device.deleted_at == None)
        statement = statement.where(Device.start_u + Device.u_height - 1 > new_height_u)
        offending_device = session.exec(statement).first()
        if offending_device:
            top_u = offending_device.start_u + offending_device.u_height - 1
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot resize: Device '{offending_device.name}' reaches up to {top_u}U"
            )

    for key, value in rack_data.items():
        setattr(db_rack, key, value)
    
    session.add(db_rack)
    session.commit()
    session.refresh(db_rack)
    return db_rack

@app.delete("/racks/{rack_id}")
def delete_rack(rack_id: int, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    # Delete associated devices
    for device in rack.devices:
        session.delete(device)
        
    session.delete(rack)
    session.commit()
    return {"ok": True}

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
    statement = select(Device).where(Device.rack_id == rack_id).where(Device.deleted_at == None)
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

def validate_device_fields(session: Session, device_data: dict, is_update: bool = False, current_device = None):
    # Fetch all active fields
    active_fields = session.exec(select(DeviceField).where(DeviceField.is_active == True)).all()
    
    # Get custom values
    custom_vals = device_data.get("custom_values") or {}
    
    # Clean up custom values to only hold active custom fields
    cleaned_custom_vals = {}
    
    for field in active_fields:
        val = None
        if not field.is_custom:
            # Built-in field. In update, check if it's explicitly set or use current
            if field.name in device_data:
                val = device_data[field.name]
            elif is_update and current_device:
                val = getattr(current_device, field.name, None)
        else:
            # Custom field
            if field.name in custom_vals:
                val = custom_vals[field.name]
            elif is_update and current_device and current_device.custom_values:
                val = current_device.custom_values.get(field.name, None)
            
            # Save to cleaned custom values
            if val is not None:
                cleaned_custom_vals[field.name] = val
        
        # Check required constraint
        if field.required:
            if val is None or (isinstance(val, str) and val.strip() == ""):
                raise HTTPException(
                    status_code=400,
                    detail=f"Field '{field.label}' is required"
                )
                
    # Update device_data['custom_values'] with cleaned values
    device_data["custom_values"] = cleaned_custom_vals

@app.post("/devices/", response_model=DeviceRead)
def create_device(device: DeviceCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    validate_device_placement(session, device.rack_id, device.start_u, device.u_height)
    
    # Validate and clean dynamic fields
    device_dict = device.dict()
    validate_device_fields(session, device_dict)
    
    # Create the device with the updated/cleaned dict
    db_device = Device(**device_dict)
    session.add(db_device)
    session.commit()
    session.refresh(db_device)
    return db_device

@app.get("/devices/{device_id}", response_model=DeviceRead)
def read_device(device_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@app.patch("/devices/{device_id}", response_model=DeviceRead)
def update_device(device_id: int, device_update: DeviceUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
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

    # Validate and clean dynamic fields
    device_update_dict = device_update.dict(exclude_unset=True)
    validate_device_fields(session, device_update_dict, is_update=True, current_device=db_device)

    # Apply updates
    for key, value in device_update_dict.items():
        if key == "custom_values":
            # Merge with existing custom values
            existing = db_device.custom_values or {}
            existing.update(value)
            db_device.custom_values = existing
        else:
            setattr(db_device, key, value)
    
    session.add(db_device)
    session.commit()
    session.refresh(db_device)
    return db_device

@app.get("/devices/{device_id}/history", response_model=List[StatusHistoryRead])
def read_device_history(device_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Return history ordered by timestamp
    statement = select(StatusHistory).where(StatusHistory.device_id == device_id).order_by(StatusHistory.timestamp)
    history = session.exec(statement).all()
    return history

@app.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    # Soft delete
    device.deleted_at = datetime.utcnow()
    session.add(device)
    session.commit()
    return {"ok": True}

# --- Config Routes ---

@app.get("/config/", response_model=SystemConfigRead)
def get_config(session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    config = session.exec(select(SystemConfig)).first()
    if not config:
        # Fallback if somehow missing
        config = SystemConfig(check_interval_seconds=60, retention_days=365)
        session.add(config)
        session.commit()
        session.refresh(config)
    return config

@app.patch("/config/", response_model=SystemConfigRead)
def update_config(config_update: SystemConfigUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    config = session.exec(select(SystemConfig)).first()
    if not config:
        config = SystemConfig()
    
    if config_update.check_interval_seconds is not None:
        config.check_interval_seconds = config_update.check_interval_seconds
    if config_update.retention_days is not None:
        config.retention_days = config_update.retention_days
        
    session.add(config)
    session.commit()
    session.refresh(config)
    return config

# --- Device Field Config Routes ---

@app.get("/device-fields/", response_model=List[DeviceField])
def read_device_fields(session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    fields = session.exec(select(DeviceField)).all()
    return fields

@app.post("/device-fields/", response_model=DeviceField)
def create_device_field(field: DeviceFieldCreate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    # Automatically generate a clean name/slug from the label
    name_slug = "".join(c for c in field.label.lower().replace(" ", "_") if c.isalnum() or c == "_")
    if not name_slug:
        raise HTTPException(status_code=400, detail="Invalid label.")
        
    # Check for duplicate name
    existing = session.exec(select(DeviceField).where(DeviceField.name == name_slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A field with label '{field.label}' (slug '{name_slug}') already exists.")
        
    db_field = DeviceField(
        name=name_slug,
        label=field.label,
        field_type=field.field_type,
        required=field.required,
        is_custom=True,
        is_active=True
    )
    
    session.add(db_field)
    session.commit()
    session.refresh(db_field)
    return db_field

@app.patch("/device-fields/{field_id}", response_model=DeviceField)
def update_device_field(field_id: int, field_update: DeviceFieldUpdate, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_field = session.get(DeviceField, field_id)
    if not db_field:
        raise HTTPException(status_code=404, detail="Device field not found")
        
    if field_update.label is not None:
        db_field.label = field_update.label
    if field_update.field_type is not None:
        db_field.field_type = field_update.field_type
    if field_update.required is not None:
        db_field.required = field_update.required
    if field_update.is_active is not None:
        db_field.is_active = field_update.is_active
        
    session.add(db_field)
    session.commit()
    session.refresh(db_field)
    return db_field

@app.delete("/device-fields/{field_id}")
def delete_device_field(field_id: int, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    db_field = session.get(DeviceField, field_id)
    if not db_field:
        raise HTTPException(status_code=404, detail="Device field not found")
        
    if not db_field.is_custom:
        # Built-in fields cannot be deleted from the schema, only deactivated/removed from view!
        db_field.is_active = False
        session.add(db_field)
        session.commit()
        return {"ok": True, "message": "Built-in field deactivated"}
    
    session.delete(db_field)
    session.commit()
    return {"ok": True}

