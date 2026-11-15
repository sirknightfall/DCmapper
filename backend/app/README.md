# Backend Application (`backend/app`)

## Overview
Core FastAPI backend package implementing the DCmapper REST API, SQLModel/SQLite persistence layer, OAuth2 Bearer JWT authentication, bulk CSV import/export, and asynchronous background tasks for ICMP device status monitoring and soft-deleted device retention cleanup.

## Interface
- `[main.py:MAX_IMPORT_FILE_BYTES]` Module constant (`1048576` bytes / `1 MB`) capping bulk CSV import uploads
- `[main.py:app]` FastAPI application instance (`title="DCmapper API"`, `root_path=os.getenv("ROOT_PATH", "")`) configured with `CORSMiddleware`
- `[main.py:on_startup]` Startup event hook initializing tables, executing schema migrations, seeding default records, and launching background tasks
- `[main.py:login_for_access_token]` `POST /token` -> `Token` (OAuth2 password flow authentication)
- `[main.py:read_users_me]` `GET /users/me/` -> `UserRead`
- `[main.py:update_own_password]` `PATCH /users/me/password` -> `UserRead` (`UserUpdatePassword`)
- `[main.py:read_users]` `GET /users/` -> `List[UserRead]` (admin-only)
- `[main.py:create_user]` `POST /users/` -> `UserRead` (`UserCreate`, admin-only)
- `[main.py:reset_user_password]` `PATCH /users/{user_id}/password` -> `UserRead` (`UserUpdatePassword`, admin-only)
- `[main.py:delete_user]` `DELETE /users/{user_id}` -> `{"ok": True}` (admin-only)
- `[main.py:create_datacenter]` `POST /datacenters/` -> `DatacenterRead` (`DatacenterCreate`, admin-only)
- `[main.py:read_datacenters]` `GET /datacenters/` -> `List[DatacenterWithRacksAndDevices]`
- `[main.py:read_datacenter]` `GET /datacenters/{dc_id}` -> `DatacenterWithRacksAndDevices`
- `[main.py:update_datacenter]` `PATCH /datacenters/{dc_id}` -> `DatacenterRead` (`DatacenterUpdate`, admin-only)
- `[main.py:delete_datacenter]` `DELETE /datacenters/{dc_id}` -> `{"ok": True}` (admin-only)
- `[main.py:analyze_import]` `POST /datacenters/{dc_id}/import/analyze` -> `{"valid": bool, "errors": list, "racks": list, "devices": list}` (multipart CSV `UploadFile`, admin-only)
- `[main.py:commit_import]` `POST /datacenters/{dc_id}/import/commit` -> `{"success": True, "racks_count": int, "devices_count": int}` (admin-only)
- `[main.py:export_datacenter_csv]` `GET /datacenters/{dc_id}/export` -> `text/csv` attachment `dc_{dc.name}_export.csv`
- `[main.py:create_rack]` `POST /racks/` -> `RackRead` (`RackCreate`, admin-only)
- `[main.py:read_racks]` `GET /racks/` -> `List[RackRead]`
- `[main.py:read_rack]` `GET /racks/{rack_id}` -> `RackWithDevices`
- `[main.py:update_rack]` `PATCH /racks/{rack_id}` -> `RackRead` (`RackUpdate`, admin-only)
- `[main.py:delete_rack]` `DELETE /racks/{rack_id}` -> `{"ok": True}` (admin-only)
- `[main.py:validate_device_placement]` Helper `validate_device_placement(session, rack_id, start_u, u_height, exclude_device_id=None)`
- `[main.py:validate_device_fields]` Helper `validate_device_fields(session, device_data, is_update=False, current_device=None)`
- `[main.py:create_device]` `POST /devices/` -> `DeviceRead` (`DeviceCreate`, admin-only)
- `[main.py:read_device]` `GET /devices/{device_id}` -> `DeviceRead`
- `[main.py:update_device]` `PATCH /devices/{device_id}` -> `DeviceRead` (`DeviceUpdate`, admin-only)
- `[main.py:read_device_history]` `GET /devices/{device_id}/history` -> `List[StatusHistoryRead]`
- `[main.py:ping_device_endpoint]` `GET /devices/{device_id}/ping` -> `{"success": bool, "ip": str, "output": str, "status": str, "timestamp": str}`
- `[main.py:delete_device]` `DELETE /devices/{device_id}` -> `{"ok": True}` (soft-delete, admin-only)
- `[main.py:get_config]` `GET /config/` -> `SystemConfigRead`
- `[main.py:update_config]` `PATCH /config/` -> `SystemConfigRead` (`SystemConfigUpdate`, admin-only)
- `[main.py:log_activity]` Helper `log_activity(session, username, action, details)`
- `[main.py:read_activity_logs]` `GET /activity-logs/` -> `List[ActivityLogRead]` (`offset=0`, `limit=500`)
- `[main.py:read_device_fields]` `GET /device-fields/` -> `List[DeviceField]`
- `[main.py:create_device_field]` `POST /device-fields/` -> `DeviceField` (`DeviceFieldCreate`, admin-only)
- `[main.py:update_device_field]` `PATCH /device-fields/{field_id}` -> `DeviceField` (`DeviceFieldUpdate`, admin-only)
- `[main.py:delete_device_field]` `DELETE /device-fields/{field_id}` -> `{"ok": True, ...}` (admin-only)
- `[models.py:Datacenter]` SQLModel table `datacenter` (`id`, `name`, `address`, `description`, `width=10`, `height=10`, `racks`)
- `[models.py:Rack]` SQLModel table `rack` (`id`, `name`, `datacenter_id` -> `datacenter.id`, `x_coord`, `y_coord`, `height_u=42`, `datacenter`, `devices`)
- `[models.py:Device]` SQLModel table `device` (`id`, `name`, `description`, `vendor_model`, `rack_id` -> `rack.id`, `start_u`, `u_height=1`, `ip_addresses`, `management_ip`, `management_link`, `network_ports`, `owner`, `installation_date`, `custom_values` JSON, `status='Unknown'`, `last_checked`, `deleted_at`, `rack`, `status_history`)
- `[models.py:DeviceField]` SQLModel table `devicefield` (`id`, `name` unique indexed, `label`, `field_type='text'`, `required=False`, `is_custom=True`, `is_active=True`)
- `[models.py:StatusHistory]` SQLModel table `statushistory` (`id`, `device_id` -> `device.id`, `status`, `timestamp`, `device`)
- `[models.py:SystemConfig]` SQLModel table `systemconfig` (`id`, `check_interval_seconds=60`, `retention_days=365`)
- `[models.py:User]` SQLModel table `user` (`id`, `username` unique indexed, `hashed_password`, `role='viewer'`, `is_active=True`, `last_login`)
- `[models.py:ActivityLog]` SQLModel table `activitylog` (`id`, `username`, `action`, `details`, `timestamp`)
- `[schemas.py:DatacenterBase]`, `[schemas.py:DatacenterCreate]`, `[schemas.py:DatacenterRead]`, `[schemas.py:DatacenterUpdate]`, `[schemas.py:DatacenterWithRacks]`, `[schemas.py:DatacenterWithRacksAndDevices]`
- `[schemas.py:RackBase]`, `[schemas.py:RackCreate]`, `[schemas.py:RackRead]`, `[schemas.py:RackUpdate]`, `[schemas.py:RackWithDevices]`
- `[schemas.py:DeviceBase]`, `[schemas.py:DeviceCreate]`, `[schemas.py:DeviceRead]`, `[schemas.py:DeviceUpdate]`
- `[schemas.py:DeviceFieldCreate]`, `[schemas.py:DeviceFieldUpdate]`
- `[schemas.py:SystemConfigRead]`, `[schemas.py:SystemConfigUpdate]`
- `[schemas.py:StatusHistoryRead]`, `[schemas.py:ActivityLogRead]`
- `[schemas.py:UserRead]`, `[schemas.py:UserCreate]`, `[schemas.py:UserUpdatePassword]`, `[schemas.py:Token]`, `[schemas.py:TokenData]`
- `[auth.py:SECRET_KEY]`, `[auth.py:ALGORITHM]` (`"HS256"`), `[auth.py:ACCESS_TOKEN_EXPIRE_MINUTES]` (`10080`), `[auth.py:pwd_context]`, `[auth.py:oauth2_scheme]`, `[auth.py:verify_password]`, `[auth.py:get_password_hash]`, `[auth.py:create_access_token]`, `[auth.py:get_current_user]`, `[auth.py:get_current_active_user]`, `[auth.py:require_admin]`
- `[database.py:DATABASE_URL]`, `[database.py:engine]`, `[database.py:create_db_and_tables]`, `[database.py:get_session]`
- `[tasks.py:ping_device]`, `[tasks.py:status_monitor_task]`, `[tasks.py:cleanup_deleted_devices_task]`

## Invariants
- `[auth.py:get_current_user]` Raises HTTP 401 if Bearer JWT is invalid, missing `sub`, or the `User` row does not exist; `[auth.py:get_current_active_user]` raises HTTP 400 if `current_user.is_active` is `False`; `[auth.py:require_admin]` raises HTTP 403 if `current_user.role != "admin"`.
- `[main.py:create_user]` Rejects duplicate `User.username` with HTTP 400; `[main.py:delete_user]` rejects self-deletion (`db_user.username == current_user.username`) with HTTP 400.
- `[main.py:read_datacenters]`, `[main.py:read_datacenter]`, and `[main.py:read_rack]` exclude soft-deleted devices (`d.deleted_at is not None`) from returned rack device lists, whereas `[main.py:export_datacenter_csv]` includes soft-deleted devices with their deletion timestamp.
- `[main.py:update_datacenter]` Blocks shrinking `width` or `height` (HTTP 400) if any `Rack` in the datacenter has `x_coord >= new_width` or `y_coord >= new_height`.
- `[main.py:update_rack]` Enforces `0 <= new_x < dc.width` and `0 <= new_y < dc.height` (HTTP 400) and rejects coordinate collisions with another rack in the same datacenter (HTTP 400) when `x_coord` or `y_coord` changes (note: `[main.py:create_rack]` does not perform coordinate bounds or collision checks).
- `[main.py:update_rack]` Blocks lowering `height_u` (HTTP 400) if any active device (`deleted_at is None`) on the rack has `start_u + u_height - 1 > new_height_u`.
- `[main.py:validate_device_placement]` Enforces `start_u >= 1`, `start_u + u_height - 1 <= rack.height_u`, and no U-slot range overlap (`start_u < device.start_u + device.u_height` and `device.start_u < start_u + u_height`) against active devices (`deleted_at is None`) in the target rack (HTTP 400).
- `[main.py:validate_device_fields]` Strips inactive/unknown keys from `custom_values` (retaining only fields where `DeviceField.is_active == True` and `is_custom == True`) and raises HTTP 400 if any active required field (`field.required == True`) is null or empty.
- `[main.py:analyze_import]` Rejects uploaded files with size `>= 1,048,576` bytes (`1 MB`) with HTTP `400`; requires at least 2 CSV rows; validates rack grid bounds (`0 <= x < dc.width`, `0 <= y < dc.height`) and coordinate uniqueness unless matching an existing rack name case-insensitively; validates device target rack existence, `1 <= start_u`, `start_u + u_height - 1 <= max_height_u`, and U-slot non-overlap against both active database devices and prior CSV rows.
- `[main.py:read_device]`, `[main.py:update_device]`, `[main.py:read_device_history]`, `[main.py:ping_device_endpoint]`, and `[main.py:delete_device]` return HTTP 404 if the device does not exist or has `deleted_at is not None`.
- `[main.py:delete_device_field]` Protects built-in fields (`is_custom == False`) from hard deletion by setting `is_active = False` instead.
- `[tasks.py:status_monitor_task]` Purges `StatusHistory` rows older than 24 hours on every monitor cycle and pings only the first comma-separated IP of active devices (`deleted_at is None` and non-empty `ip_addresses`).
- `[tasks.py:cleanup_deleted_devices_task]` Permanently deletes soft-deleted `Device` rows where `deleted_at < utcnow() - timedelta(days=retention_days)` every 24 hours.

## Side Effects
- `[database.py:engine]` Initializes the SQLite/SQLAlchemy engine at import time from `DATABASE_URL` (default `sqlite:///./dcmapper.db`).
- `[main.py:on_startup]` Creates database tables via `[database.py:create_db_and_tables]`, runs `ALTER TABLE` schema migrations on `datacenter`, `device`, and `systemconfig`, seeds default `DeviceField` definitions, `SystemConfig` (`check_interval_seconds=60`, `retention_days=365`), and default `admin`/`viewer` users, and starts background tasks `[tasks.py:status_monitor_task]` and `[tasks.py:cleanup_deleted_devices_task]`.
- `[main.py:log_activity]` Inserts audit records into `ActivityLog` across mutating endpoints.
- `[main.py:delete_datacenter]` and `[main.py:delete_rack]` cascade-delete child `Device` and `Rack` records in the database; `[main.py:delete_device]` soft-deletes by setting `Device.deleted_at = datetime.utcnow()`.
- `[main.py:ping_device_endpoint]` Spawns OS subprocess `ping -c 4 -W 2 <ip>`, updates `Device.status` and `Device.last_checked`, and appends a `StatusHistory` row.
- `[tasks.py:ping_device]` and `[tasks.py:status_monitor_task]` spawn OS subprocesses `ping -c 1 -W 1 <ip>` over the network and mutate `Device` status and `StatusHistory` rows in the background.
- `[tasks.py:cleanup_deleted_devices_task]` Periodically hard-deletes expired soft-deleted `Device` records from SQLite.

## Verification
- Run: `<test-command>`
