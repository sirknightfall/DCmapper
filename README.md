# DCmapper Blueprint 🖥️📍

## System Overview
DCmapper is a containerized full-stack web application for mapping physical datacenter locations, managing 2D rack floor coordinates, inventorying rack-mounted hardware down to individual U-slots, and monitoring live device statuses with an asynchronous background ICMP ping engine.

The system is orchestrated with **Docker Compose** (`[docker-compose.yml:services]`), pairing a **FastAPI + SQLModel + SQLite** backend (`dcmapper-backend` isolated on internal port `8000`) with a **React + TypeScript + Vite + Nginx** frontend (`dcmapper-frontend` on HTTP port `3000 -> 80`).

## Subdirectories & System Boundaries
- `backend`: [`./backend/README.md`](./backend/README.md) - Containerized Python backend subsystem and build configuration.
  - `backend/app`: [`./backend/app/README.md`](./backend/app/README.md) - FastAPI application (`[main.py:app]`), SQLModel database schema (`[models.py:*]`), Pydantic DTOs (`[schemas.py:*]`), OAuth2/JWT authentication (`[auth.py:*]`), SQLite engine (`[database.py:*]`), and background ICMP monitor & soft-delete cleanup tasks (`[tasks.py:*]`).
- `frontend`: [`./frontend/README.md`](./frontend/README.md) - Vite/React/TypeScript build configuration and Nginx HTTP reverse-proxy container (`[nginx.conf:*]`).
  - `frontend/src`: [`./frontend/src/README.md`](./frontend/src/README.md) - Frontend SPA entry point (`[main.tsx:createRoot]`), router shell (`[App.tsx:App]`), Axios API client (`[api.ts:*]`), and shared TypeScript interfaces (`[types.ts:*]`).
  - `frontend/src/components`: [`./frontend/src/components/README.md`](./frontend/src/components/README.md) - Feature views and modals (`Config`, `Dashboard`, `GridView`, `Login`, `Modal`, `RackView`, `UserManagement`).
  - `frontend/src/context`: [`./frontend/src/context/README.md`](./frontend/src/context/README.md) - React authentication context (`AuthProvider`, `useAuth`).

## Global Invariants
- **Authentication & Role Enforcement:** All backend endpoints except `POST /token` (`[backend/app/main.py:login_for_access_token]`) require an active authenticated user via `[backend/app/auth.py:get_current_active_user]`; mutating endpoints require `current_user.role == "admin"` via `[backend/app/auth.py:require_admin]`. On the frontend, `[frontend/src/App.tsx:MainContent]` gates all routes behind `<Login />` when unauthenticated, and `[frontend/src/api.ts:api]` clears `localStorage` and redirects to `'/'` on HTTP 401.
- **User Account Integrity:** `[backend/app/main.py:create_user]` enforces unique `User.username`, and both `[backend/app/main.py:delete_user]` and `[frontend/src/components/UserManagement.tsx:handleDeleteUser]` prevent a user from deleting their own account.
- **Datacenter Floor Grid & Rack Coordinate Integrity:** `[backend/app/main.py:update_datacenter]` blocks shrinking `width` or `height` if any rack has `x_coord >= new_width` or `y_coord >= new_height`. `[backend/app/main.py:update_rack]` and `[backend/app/main.py:analyze_import]` enforce `0 <= x_coord < dc.width`, `0 <= y_coord < dc.height`, and no coordinate overlap between racks in the same datacenter.
- **Rack Elevation & U-Slot Non-Overlap:** `[backend/app/main.py:update_rack]` prevents lowering `height_u` below the top slot (`start_u + u_height - 1`) of any active mounted device. `[backend/app/main.py:validate_device_placement]` and `[backend/app/main.py:analyze_import]` enforce `1 <= start_u`, `start_u + u_height - 1 <= rack.height_u`, and zero U-slot overlap across active (`deleted_at is None`) devices in the target rack.
- **Dynamic Custom Fields & Built-in Field Protection:** `[backend/app/main.py:validate_device_fields]` strips inactive/unregistered keys from `Device.custom_values` and enforces non-empty values for active required fields (`DeviceField.required == True`). `[backend/app/main.py:delete_device_field]` prevents hard-deleting built-in fields (`is_custom == False`), deactivating them (`is_active = False`) instead.
- **Soft-Delete Visibility & History Retention:** `[backend/app/main.py:delete_device]` soft-deletes devices by setting `Device.deleted_at`. Read endpoints exclude soft-deleted devices (`deleted_at is not None`), `[backend/app/tasks.py:status_monitor_task]` purges `StatusHistory` records older than 24 hours on every monitor cycle, and `[backend/app/tasks.py:cleanup_deleted_devices_task]` permanently purges soft-deleted devices older than `SystemConfig.retention_days` every 24 hours.
- **Bulk CSV Import Size Limit (< 1 MB):** `[frontend/src/components/GridView.tsx:handleImportFileChange]`, `[frontend/nginx.conf:client_max_body_size]` (`1m`), and `[backend/app/main.py:analyze_import]` (`MAX_IMPORT_FILE_BYTES = 1048576`) reject bulk CSV import payloads of `1,048,576` bytes (`1 MB`) or larger.

## Global Side Effects
- **SQLite Persistence & Schema Bootstrap:** `[docker-compose.yml:services.backend]` mounts Docker volume `db_data` at `/app/data` with `DATABASE_URL=sqlite:///./data/dcmapper.db`. On startup, `[backend/app/main.py:on_startup]` creates SQLModel tables, executes `ALTER TABLE` schema migrations, seeds default `DeviceField`, `SystemConfig`, and `admin`/`viewer` `User` records, and starts background tasks.
- **ICMP Network Probing:** `[docker-compose.yml:services.backend]` grants `NET_RAW` capability. `[backend/app/tasks.py:status_monitor_task]` periodically spawns `ping -c 1 -W 1 <ip>` for active devices, and `[backend/app/main.py:ping_device_endpoint]` spawns `ping -c 4 -W 2 <ip>` for interactive diagnostics, both updating `Device.status`, `Device.last_checked`, and `StatusHistory`.
- **Audit Logging:** Mutating API operations record entries in the `ActivityLog` table via `[backend/app/main.py:log_activity]`.
- **Browser Storage & Reverse Proxy:** Frontend authentication persists `'token'` and `'user'` in `window.localStorage` (`[frontend/src/context/AuthContext.tsx:AuthProvider]`), and `[frontend/nginx.conf:proxy_pass]` listens on HTTP port 80 (mapped to host port `3000`), preserves `X-Forwarded-Proto`, enforces `client_max_body_size 1m;`, and proxies `/api/` traffic to internal `http://backend:8000/`.

## System Verification
- Run: `cd frontend && npm run build && npm run lint`

---

## 🛠️ Architecture & Tech Stack

```mermaid
graph TD
    User([User Web Browser]) -->|HTTP (or Upstream TLS Proxy) / REST & JWT| Frontend[React SPA / Nginx Container]
    Frontend -->|API Requests| Backend[FastAPI Backend Container]
    Backend -->|SQLModel ORM| DB[(SQLite Database File)]
    Backend -->|Async Ping Engine| Net[Network Devices]
    
    subgraph Containerized Orchestration
        Frontend
        Backend
        DB
    end
```

### Stack Highlights
*   **Backend:** Python 3.11, **FastAPI** (asynchronous runtime), **SQLModel** (SQLAlchemy + Pydantic integration) for the database schema.
*   **Frontend:** React, TypeScript, Tailwind CSS, built via **Vite** and served by **Nginx**.
*   **Database:** **SQLite** with an asynchronous SQLite driver (`aiosqlite`), persisted via Docker volumes.
*   **Monitoring:** Background worker executing concurrent ICMP ping queries via `asyncio`.

---

## ✨ Core Features & Enterprise Features

### 🏛️ Core Platform
1.  **Multi-Site Dashboard:** A bird's-eye view card list of all configured locations capturing physical addresses, contact records, and general description notes.
2.  **Interactive Floor Grid:** A 2D coordinate system ($X \times Y$) for placing rack enclosures onto exact coordinates. Includes movement boundary checks and cabinet overlap validation.
3.  **Rack "U" Elevation View:** Vertical schematic representing individual slots (up to 42U or custom heights). Shows accurate sizing, hardware models, and live status lights.
4.  **Device Inventory:** Track hostname, device type (Server, Switch, PDU, Patch Panel), hardware vendor, IP addresses, installation dates, and out-of-band management endpoints (with external dashboard quick-links).
5.  **Live Ping Monitor:** An automated background service that scans all devices with active IPs, issues concurrent ICMP pings, records histories, and notifies the UI in near real-time.
6.  **Soft-Deletion & Archiving:** Pruned resources are placed into archives and kept for a configurable retention window before being permanently destroyed.

### 🚀 Premium Advanced Features
*   **Advanced Search & Recursive Attribute Filtering:** Scans built-in and dynamic custom fields. Renders search matches across multi-site cards, floor coordinates, and vertical rack slots in real-time with vibrant pulsing blue animation alerts.
*   **Interactive Diagnostics Console:** A web-based CLI emulator that triggers non-blocking, multi-packet live ICMP ping checks on remote hosts, streams real-time console outputs, and dynamically updates system statuses.
*   **Dynamic & Authenticated CSV Export:** Enables on-the-fly CSV exports, seamlessly integrating custom-defined schema fields into the generated sheet. Downloads are securely processed using JWT tokens.
*   **Bulk Datacenter Import Wizard:** A wizard UI allowing transaction-backed bulk CSV/JSON imports of full racks and nested devices with syntax validation, grid boundary collision detection, and instant status previews.
*   **User Activity Audit Logging:** A relational, system-wide transaction logging system recording every CRUD operation, configuration adjustment, password update, and import action into an immutable audit trail, complete with a beautiful visual timeline under the configuration page.

---

## 🚀 Quick Start (Docker Compose)

### Prerequisites
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### Deploying the Application
Launch both services using Docker Compose from the root directory:

```bash
docker compose up -d --build
```

The stack starts the following services:
*   **React Frontend:** [http://localhost:3000](http://localhost:3000) (plain HTTP; can be placed behind an F5 load balancer or Nginx TLS reverse proxy)
*   **API Interactive Documentation (Swagger):** [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (proxied through the frontend container; backend port `8000` is internal to the Docker network)

> [!IMPORTANT]
> The backend container requires ICMP raw socket permissions to execute ping requests. This is handled automatically by adding the `NET_RAW` capability in `docker-compose.yml`.

### Default Credentials
*   **Admin:** `username: admin` | `password: admin` (Full write privileges)
*   **Viewer:** `username: viewer` | `password: viewer` (Read-only access)

---

## 📖 Backend API Reference

All requests to the backend APIs require token-based authentication using an **OAuth2 Bearer JWT** token, except for the login endpoint. Pass the token via the `Authorization` header: `Authorization: Bearer <token>`.

### Endpoint Summary

| Category | HTTP Method | Path | Access Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/token` | Public | Authenticate user and obtain access token |
| | `GET` | `/users/me/` | Viewer / Admin | Retrieve current user profile |
| | `PATCH` | `/users/me/password` | Viewer / Admin | Update own user password |
| | `GET` | `/users/` | Admin | List all registered users |
| | `POST` | `/users/` | Admin | Register a new user |
| | `PATCH` | `/users/{user_id}/password` | Admin | Reset a user's password |
| | `DELETE` | `/users/{user_id}` | Admin | Delete a user (cannot delete self) |
| **Datacenters** | `GET` | `/datacenters/` | Viewer / Admin | List all datacenter sites |
| | `POST` | `/datacenters/` | Admin | Create a new datacenter site |
| | `GET` | `/datacenters/{dc_id}` | Viewer / Admin | Retrieve site layout & nested racks |
| | `PATCH` | `/datacenters/{dc_id}` | Admin | Update site detail / resize floor layout |
| | `DELETE` | `/datacenters/{dc_id}` | Admin | Cascade delete a datacenter and contents |
| | `GET` | `/datacenters/{dc_id}/export` | Viewer / Admin | Export all devices in site to CSV (includes dynamic fields) |
| | `POST` | `/datacenters/{dc_id}/import/analyze` | Admin | Dry-run validation of a bulk CSV/JSON import file |
| | `POST` | `/datacenters/{dc_id}/import/commit` | Admin | Commit and apply a transaction-backed bulk import |
| **Racks** | `GET` | `/racks/` | Viewer / Admin | List all rack enclosures |
| | `POST` | `/racks/` | Admin | Place a new rack onto coordinate grid |
| | `GET` | `/racks/{rack_id}` | Viewer / Admin | Retrieve rack slot elevation (active devices) |
| | `PATCH` | `/racks/{rack_id}` | Admin | Shift coordinates / resize rack slots |
| | `DELETE` | `/racks/{rack_id}` | Admin | Permanently delete rack and housed units |
| **Devices** | `POST` | `/devices/` | Admin | Mount a device into a rack U-slot |
| | `GET` | `/devices/{device_id}` | Viewer / Admin | Retrieve device details |
| | `PATCH` | `/devices/{device_id}` | Admin | Update specs or change U-slot mounting |
| | `GET` | `/devices/{device_id}/ping` | Viewer / Admin | Trigger live non-blocking interactive ping check |
| | `GET` | `/devices/{device_id}/history` | Viewer / Admin | Get health monitoring logs for device |
| | `DELETE` | `/devices/{device_id}` | Admin | Soft-delete equipment (sent to archives) |
| **Config** | `GET` | `/config/` | Viewer / Admin | Get background loop interval / retention |
| | `PATCH` | `/config/` | Admin | Edit background timings / retention days |
| **Device Fields** | `GET` | `/device-fields/` | Viewer / Admin | List all device attributes/fields configuration |
| | `POST` | `/device-fields/` | Admin | Create a completely new custom field |
| | `PATCH` | `/device-fields/{field_id}` | Admin | Update field label, type, required status, or toggle active/inactive |
| | `DELETE` | `/device-fields/{field_id}` | Admin | Delete custom field (or deactivate built-in field) |
| **Audit Logs** | `GET` | `/activity-logs/` | Viewer / Admin | Fetch full activity audit trail of last 500 system operations |

---

## 🔒 Relational Logic & Constraints

The API protects infrastructure mapping integrity using strict transactional and layout check assertions before executing database writes:

*   **Floor Grid Resizing Check:** You cannot shrink the dimensions (`width` or `height`) of a datacenter if there are any configured racks located on coordinates outside the new boundaries.
*   **Rack Overlap Check:** Relocating a rack (`PATCH /racks/{rack_id}`) or importing racks (`POST /datacenters/{dc_id}/import/analyze`) onto grid coordinates already occupied by another cabinet is rejected.
*   **Rack Boundary Check:** Relocated or imported cabinets cannot be placed outside the dimensions of the parent datacenter.
*   **Cabinet Shrinkage Check:** Lowering the total U-slots of a rack is blocked if there are active equipment mounted in the slots being trimmed.
*   **U-Slot Collisions:** Registering or moving devices to slots already occupied by active equipment inside the target rack will return a conflict error.
