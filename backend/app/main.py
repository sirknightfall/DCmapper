from fastapi import FastAPI, Depends, HTTPException, Query, Response, status, UploadFile, File
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
from app.models import Datacenter, Rack, Device, SystemConfig, StatusHistory, User, DeviceField, ActivityLog
from app.schemas import (
    DatacenterCreate, DatacenterRead, DatacenterWithRacks, DatacenterWithRacksAndDevices, DatacenterUpdate,
    RackCreate, RackRead, RackWithDevices, RackUpdate,
    DeviceCreate, DeviceRead, DeviceUpdate,
    SystemConfigRead, SystemConfigUpdate,
    StatusHistoryRead,
    UserRead, UserCreate, UserUpdatePassword, Token,
    DeviceFieldCreate, DeviceFieldUpdate, ActivityLogRead
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
    log_activity(session, current_user.username, "Change Password", "Changed own password")
    session.commit()
    session.refresh(current_user)
    return current_user

@app.get("/users/", response_model=List[UserRead])
async def read_users(session: Session = Depends(get_session), _: User = Depends(require_admin)):
    users = session.exec(select(User)).all()
    return users

@app.post("/users/", response_model=UserRead)
async def create_user(user: UserCreate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Create User", f"Created user {db_user.username} with role {db_user.role}")
    session.commit()
    session.refresh(db_user)
    return db_user

@app.patch("/users/{user_id}/password", response_model=UserRead)
async def reset_user_password(user_id: int, update: UserUpdatePassword, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.hashed_password = get_password_hash(update.new_password)
    session.add(db_user)
    log_activity(session, current_user.username, "Reset Password", f"Reset password for user {db_user.username}")
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
    
    log_activity(session, current_user.username, "Delete User", f"Deleted user {db_user.username}")
    session.delete(db_user)
    session.commit()
    return {"ok": True}

# --- Datacenter Routes ---

@app.post("/datacenters/", response_model=DatacenterRead)
def create_datacenter(dc: DatacenterCreate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    db_dc = Datacenter.from_orm(dc)
    session.add(db_dc)
    log_activity(session, current_user.username, "Create Datacenter", f"Created datacenter {db_dc.name} ({db_dc.address})")
    session.commit()
    session.refresh(db_dc)
    return db_dc

@app.get("/datacenters/", response_model=List[DatacenterWithRacksAndDevices])
def read_datacenters(offset: int = 0, limit: int = Query(default=100, le=100), session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    datacenters = session.exec(select(Datacenter).offset(offset).limit(limit)).all()
    for dc in datacenters:
        for rack in dc.racks:
            rack.devices = [d for d in rack.devices if d.deleted_at is None]
    return datacenters

@app.get("/datacenters/{dc_id}", response_model=DatacenterWithRacksAndDevices)
def read_datacenter(dc_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    # Filter out soft-deleted devices for all nested racks
    for rack in dc.racks:
        rack.devices = [d for d in rack.devices if d.deleted_at is None]
    return dc

@app.patch("/datacenters/{dc_id}", response_model=DatacenterRead)
def update_datacenter(dc_id: int, dc_update: DatacenterUpdate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Update Datacenter", f"Updated datacenter {db_dc.name}")
    session.commit()
    session.refresh(db_dc)
    return db_dc

@app.delete("/datacenters/{dc_id}")
def delete_datacenter(dc_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    
    # SQLModel/SQLAlchemy doesn't have automatic cascade delete configured in the models,
    # so we delete associated racks (and their devices)
    for rack in dc.racks:
        for device in rack.devices:
            session.delete(device)
        session.delete(rack)
    
    log_activity(session, current_user.username, "Delete Datacenter", f"Deleted datacenter {dc.name}")
    session.delete(dc)
    session.commit()
    return {"ok": True}

@app.post("/datacenters/{dc_id}/import/analyze")
async def analyze_import(dc_id: int, file: UploadFile = File(...), session: Session = Depends(get_session), _: User = Depends(require_admin)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
        
    content = await file.read()
    decoded = content.decode('utf-8', errors='ignore')
    
    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)
    
    if len(rows) < 2:
        return {"valid": False, "errors": ["File is empty or missing headers."], "racks": [], "devices": []}
        
    headers = [h.strip().lower() for h in rows[0]]
    
    def get_val(row, aliases, default=None):
        for alias in aliases:
            if alias in headers:
                idx = headers.index(alias)
                if idx < len(row):
                    return row[idx].strip()
        return default

    parsed_racks = []
    parsed_devices = []
    errors = []
    
    imported_coords = set()
    existing_coords = {(r.x_coord, r.y_coord): r.name for r in dc.racks}
    existing_racks = {r.name.lower(): r for r in dc.racks}
    proposed_racks = set()
    
    # Phase 1: Parse Racks
    for idx, row in enumerate(rows[1:], start=2):
        if not row or not any(row):
            continue
        row_type = get_val(row, ["type"], "device").lower()
        if row_type == "rack":
            name = get_val(row, ["name", "rack name", "rack_name"])
            if not name:
                errors.append(f"Row {idx}: Rack is missing a Name.")
                continue
                
            x_str = get_val(row, ["x", "x coord", "x coordinate", "x_coord"])
            y_str = get_val(row, ["y", "y coord", "y coordinate", "y_coord"])
            height_str = get_val(row, ["height", "u height", "height u", "height_u", "height (u)", "slots"], "42")
            
            if x_str is None or y_str is None:
                errors.append(f"Row {idx} (Rack {name}): Missing X or Y coordinates.")
                continue
                
            try:
                x = int(x_str)
                y = int(y_str)
            except ValueError:
                errors.append(f"Row {idx} (Rack {name}): X and Y coordinates must be integers (got '{x_str}', '{y_str}').")
                continue
                
            try:
                height = int(height_str)
            except ValueError:
                errors.append(f"Row {idx} (Rack {name}): U height must be an integer (got '{height_str}').")
                continue
                
            if x < 0 or x >= dc.width or y < 0 or y >= dc.height:
                errors.append(f"Row {idx} (Rack {name}): Coordinates ({x}, {y}) are out of datacenter bounds (Width: {dc.width}, Height: {dc.height}).")
                continue
                
            if (x, y) in imported_coords:
                errors.append(f"Row {idx} (Rack {name}): Coordinate collision ({x}, {y}) with another rack inside the import file.")
                continue
                
            coord_conflict_rack = existing_coords.get((x, y))
            if coord_conflict_rack and coord_conflict_rack.lower() != name.lower():
                errors.append(f"Row {idx} (Rack {name}): Coordinate collision ({x}, {y}) with existing rack '{coord_conflict_rack}' in the database.")
                continue
                
            imported_coords.add((x, y))
            proposed_racks.add(name.lower())
            
            status = "new"
            if name.lower() in existing_racks:
                status = "update"
                
            parsed_racks.append({
                "row": idx,
                "name": name,
                "x_coord": x,
                "y_coord": y,
                "height_u": height,
                "status": status
            })

    # Phase 2: Parse Devices
    for idx, row in enumerate(rows[1:], start=2):
        if not row or not any(row):
            continue
        row_type = get_val(row, ["type"], "device").lower()
        if row_type == "device":
            name = get_val(row, ["name", "device name", "device_name"])
            if not name:
                errors.append(f"Row {idx}: Device is missing a Name.")
                continue
                
            rack_name = get_val(row, ["rack", "parent", "parent rack", "rack name", "rack_name"])
            if not rack_name:
                errors.append(f"Row {idx} (Device {name}): Missing associated Rack Name.")
                continue
                
            target_rack = existing_racks.get(rack_name.lower())
            is_rack_proposed = rack_name.lower() in proposed_racks
            
            if not target_rack and not is_rack_proposed:
                errors.append(f"Row {idx} (Device {name}): Target rack '{rack_name}' does not exist in the datacenter and is not being created in this import file.")
                continue
                
            start_u_str = get_val(row, ["start u", "start_u", "start position", "u position"])
            u_height_str = get_val(row, ["height", "u height", "height u", "height_u", "height (u)", "slots"], "1")
            
            if not start_u_str:
                errors.append(f"Row {idx} (Device {name}): Missing starting U slot position ('Start U').")
                continue
                
            try:
                start_u = int(start_u_str)
                u_height = int(u_height_str)
            except ValueError:
                errors.append(f"Row {idx} (Device {name}): Start U and Height must be integers (got '{start_u_str}', '{u_height_str}').")
                continue
                
            max_height_u = target_rack.height_u if target_rack else 42
            for pr in parsed_racks:
                if pr["name"].lower() == rack_name.lower():
                    max_height_u = pr["height_u"]
                    break
                    
            if start_u < 1 or start_u + u_height - 1 > max_height_u:
                errors.append(f"Row {idx} (Device {name}): U slots ({start_u} to {start_u + u_height - 1}) are out of bounds for rack '{rack_name}' (capacity: {max_height_u}U).")
                continue
                
            device_type = get_val(row, ["device type", "device_type", "type of device"], "Server")
            ip_addresses = get_val(row, ["ip addresses", "ip_addresses", "ip", "ips", "ip address"], "")
            management_ip = get_val(row, ["management ip", "management_ip", "mgt ip", "oob ip"], "")
            management_link = get_val(row, ["management link", "management_link", "mgt link", "oob link"], "")
            owner = get_val(row, ["owner"], "")
            network_ports = get_val(row, ["network ports", "network_ports", "ports"], "")
            description = get_val(row, ["description", "desc", "notes"], "")
            
            custom_values = {}
            active_fields = session.exec(select(DeviceField).where(DeviceField.is_active == True)).all()
            for f in active_fields:
                if f.is_custom:
                    val = get_val(row, [f.label.lower(), f.name.lower()])
                    if val is not None:
                        custom_values[f.name] = val
                        
            parsed_devices.append({
                "row": idx,
                "name": name,
                "device_type": device_type,
                "rack_name": rack_name,
                "start_u": start_u,
                "u_height": u_height,
                "ip_addresses": ip_addresses,
                "management_ip": management_ip,
                "management_link": management_link,
                "owner": owner,
                "network_ports": network_ports,
                "description": description,
                "custom_values": custom_values
            })
            
    rack_device_reservations = {}
    for rack in dc.racks:
        rack_device_reservations[rack.name.lower()] = [
            (d.start_u, d.start_u + d.u_height - 1, d.name)
            for d in rack.devices if d.deleted_at is None
        ]
        
    for d in parsed_devices:
        r_name = d["rack_name"].lower()
        if r_name not in rack_device_reservations:
            rack_device_reservations[r_name] = []
            
        d_start = d["start_u"]
        d_end = d["start_u"] + d["u_height"] - 1
        
        overlap_found = False
        for (start, end, occupant_name) in rack_device_reservations[r_name]:
            if not (d_end < start or d_start > end):
                errors.append(f"Row {d['row']} (Device {d['name']}): U slot conflict ({d_start}U-{d_end}U) on rack '{d['rack_name']}' which is already occupied by '{occupant_name}'.")
                overlap_found = True
                break
                
        if not overlap_found:
            rack_device_reservations[r_name].append((d_start, d_end, d["name"]))

    valid = len(errors) == 0
    return {
        "valid": valid,
        "errors": errors,
        "racks": parsed_racks,
        "devices": parsed_devices
    }

@app.post("/datacenters/{dc_id}/import/commit")
def commit_import(dc_id: int, payload: dict, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
        
    racks_data = payload.get("racks", [])
    devices_data = payload.get("devices", [])
    
    rack_name_to_obj = {r.name.lower(): r for r in dc.racks}
    
    for r_data in racks_data:
        name = r_data["name"]
        name_lower = name.lower()
        
        if name_lower in rack_name_to_obj:
            rack = rack_name_to_obj[name_lower]
            rack.x_coord = r_data["x_coord"]
            rack.y_coord = r_data["y_coord"]
            rack.height_u = r_data["height_u"]
            session.add(rack)
        else:
            new_rack = Rack(
                name=name,
                datacenter_id=dc_id,
                x_coord=r_data["x_coord"],
                y_coord=r_data["y_coord"],
                height_u=r_data["height_u"]
            )
            session.add(new_rack)
            session.commit()
            session.refresh(new_rack)
            rack_name_to_obj[name_lower] = new_rack
            
    session.commit()
    rack_name_to_obj = {r.name.lower(): r for r in session.get(Datacenter, dc_id).racks}
    
    for d_data in devices_data:
        rack_name = d_data["rack_name"]
        rack = rack_name_to_obj.get(rack_name.lower())
        if not rack:
            raise HTTPException(status_code=400, detail=f"Rack '{rack_name}' not found for device '{d_data['name']}'")
            
        new_device = Device(
            name=d_data["name"],
            device_type=d_data["device_type"],
            rack_id=rack.id,
            start_u=d_data["start_u"],
            u_height=d_data["u_height"],
            ip_addresses=d_data.get("ip_addresses"),
            management_ip=d_data.get("management_ip"),
            management_link=d_data.get("management_link"),
            owner=d_data.get("owner"),
            network_ports=d_data.get("network_ports"),
            description=d_data.get("description"),
            custom_values=d_data.get("custom_values", {}),
            status="Unknown"
        )
        session.add(new_device)
        
    log_activity(session, current_user.username, "Bulk Import", f"Imported {len(racks_data)} racks and {len(devices_data)} devices in datacenter {dc.name}")
    session.commit()
    return {"success": True, "racks_count": len(racks_data), "devices_count": len(devices_data)}

@app.get("/datacenters/{dc_id}/export")
def export_datacenter_csv(dc_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    dc = session.get(Datacenter, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Datacenter not found")
    
    # Get all active fields
    active_fields = session.exec(select(DeviceField).where(DeviceField.is_active == True)).all()
    
    # Base headers that always exist
    headers = ["Name", "Type", "Rack", "Start U", "Height", "Status", "Last Checked", "Deleted At"]
    # Dynamic active headers
    for f in active_fields:
        headers.append(f.label)
        
    # Get all racks in this DC
    racks = session.exec(select(Rack).where(Rack.datacenter_id == dc_id)).all()
    if not racks:
        # Return empty CSV with headers
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        output.seek(0)
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=dc_{dc.name}_export.csv"})

    rack_ids = [r.id for r in racks]
    rack_map = {r.id: r.name for r in racks}
    
    # Get all devices in these racks, including deleted ones
    statement = select(Device).where(Device.rack_id.in_(rack_ids))
    devices = session.exec(statement).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(headers)
    
    for d in devices:
        row = [
            d.name, d.device_type, rack_map.get(d.rack_id, "Unknown"), 
            d.start_u, d.u_height, d.status,
            d.last_checked.isoformat() if d.last_checked else "Never",
            d.deleted_at.isoformat() if d.deleted_at else "Active"
        ]
        # Append dynamic active fields values
        for f in active_fields:
            val = None
            if not f.is_custom:
                # Built-in field
                val = getattr(d, f.name, None)
            else:
                # Custom field
                if d.custom_values:
                    val = d.custom_values.get(f.name, None)
            
            # Format datetime dynamically if it's installation_date or date type
            if isinstance(val, datetime):
                row.append(val.isoformat())
            else:
                row.append(str(val) if val is not None else "")
            
        writer.writerow(row)
    
    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=dc_{dc.name}_export.csv"}
    )

# --- Rack Routes ---

@app.post("/racks/", response_model=RackRead)
def create_rack(rack: RackCreate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    db_rack = Rack.from_orm(rack)
    session.add(db_rack)
    log_activity(session, current_user.username, "Create Rack", f"Placed rack {db_rack.name} on coordinates ({db_rack.x_coord}, {db_rack.y_coord})")
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
def update_rack(rack_id: int, rack_update: RackUpdate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Update Rack", f"Updated rack {db_rack.name}")
    session.commit()
    session.refresh(db_rack)
    return db_rack

@app.delete("/racks/{rack_id}")
def delete_rack(rack_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    rack = session.get(Rack, rack_id)
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    
    # Delete associated devices
    for device in rack.devices:
        session.delete(device)
        
    log_activity(session, current_user.username, "Delete Rack", f"Deleted rack {rack.name}")
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
def create_device(device: DeviceCreate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    validate_device_placement(session, device.rack_id, device.start_u, device.u_height)
    
    # Validate and clean dynamic fields
    device_dict = device.dict()
    validate_device_fields(session, device_dict)
    
    # Create the device with the updated/cleaned dict
    db_device = Device(**device_dict)
    session.add(db_device)
    log_activity(session, current_user.username, "Create Device", f"Added device {db_device.name} to rack U{db_device.start_u}")
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
def update_device(device_id: int, device_update: DeviceUpdate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Update Device", f"Updated device {db_device.name}")
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

@app.get("/devices/{device_id}/ping")
async def ping_device_endpoint(device_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.ip_addresses:
        raise HTTPException(status_code=400, detail="Device does not have any configured IP address")
    
    primary_ip = device.ip_addresses.split(',')[0].strip()
    if not primary_ip:
        raise HTTPException(status_code=400, detail="Device IP address list is empty")
         
    command = ["ping", "-c", "4", "-W", "2", primary_ip]
    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        output = stdout.decode('utf-8', errors='ignore') + stderr.decode('utf-8', errors='ignore')
        is_online = process.returncode == 0
        
        new_status = "Online" if is_online else "Offline"
        device.status = new_status
        device.last_checked = datetime.utcnow()
        session.add(device)
        
        history = StatusHistory(device_id=device.id, status=new_status)
        session.add(history)
        session.commit()
        
        return {
            "success": is_online,
            "ip": primary_ip,
            "output": output,
            "status": new_status,
            "timestamp": device.last_checked.isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "ip": primary_ip,
            "output": f"Failed to execute ping diagnostic: {str(e)}",
            "status": "Unknown",
            "timestamp": datetime.utcnow().isoformat()
        }

@app.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    # Soft delete
    device.deleted_at = datetime.utcnow()
    session.add(device)
    log_activity(session, current_user.username, "Delete Device", f"Soft-deleted device {device.name}")
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
def update_config(config_update: SystemConfigUpdate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    config = session.exec(select(SystemConfig)).first()
    if not config:
        config = SystemConfig()
    
    if config_update.check_interval_seconds is not None:
        config.check_interval_seconds = config_update.check_interval_seconds
    if config_update.retention_days is not None:
        config.retention_days = config_update.retention_days
        
    session.add(config)
    log_activity(session, current_user.username, "Update Config", f"Updated retention days to {config.retention_days}, check interval to {config.check_interval_seconds}s")
    session.commit()
    session.refresh(config)
    return config

def log_activity(session: Session, username: str, action: str, details: str):
    log = ActivityLog(username=username, action=action, details=details)
    session.add(log)

@app.get("/activity-logs/", response_model=List[ActivityLogRead])
def read_activity_logs(offset: int = 0, limit: int = 500, session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    statement = select(ActivityLog).order_by(ActivityLog.timestamp.desc()).offset(offset).limit(limit)
    logs = session.exec(statement).all()
    return logs

# --- Device Field Config Routes ---

@app.get("/device-fields/", response_model=List[DeviceField])
def read_device_fields(session: Session = Depends(get_session), _: User = Depends(get_current_active_user)):
    fields = session.exec(select(DeviceField)).all()
    return fields

@app.post("/device-fields/", response_model=DeviceField)
def create_device_field(field: DeviceFieldCreate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Create Device Field", f"Created custom field: {db_field.label} ({db_field.field_type})")
    session.commit()
    session.refresh(db_field)
    return db_field

@app.patch("/device-fields/{field_id}", response_model=DeviceField)
def update_device_field(field_id: int, field_update: DeviceFieldUpdate, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
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
    log_activity(session, current_user.username, "Update Device Field", f"Updated field: {db_field.label}")
    session.commit()
    session.refresh(db_field)
    return db_field

@app.delete("/device-fields/{field_id}")
def delete_device_field(field_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_admin)):
    db_field = session.get(DeviceField, field_id)
    if not db_field:
        raise HTTPException(status_code=404, detail="Device field not found")
        
    if not db_field.is_custom:
        # Built-in fields cannot be deleted from the schema, only deactivated/removed from view!
        db_field.is_active = False
        session.add(db_field)
        log_activity(session, current_user.username, "Update Device Field", f"Deactivated built-in field: {db_field.label}")
        session.commit()
        return {"ok": True, "message": "Built-in field deactivated"}
    
    log_activity(session, current_user.username, "Delete Device Field", f"Deleted custom field: {db_field.label}")
    session.delete(db_field)
    session.commit()
    return {"ok": True}

