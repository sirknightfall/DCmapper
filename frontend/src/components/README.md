# Frontend UI Components (`frontend/src/components`)

## Overview
React view and modal components implementing the multi-site datacenter dashboard, interactive 2D floor grid, vertical rack U-slot elevation view, live ICMP ping diagnostics console, bulk CSV import/export workflows, system configuration, dynamic device field management, and user administration.

## Interface
- `[Config.tsx:Config]` Default exported `React.FC` component for system configuration (`check_interval_seconds`, `retention_days`), dynamic device field management, personal password updates, and activity audit log viewing
- `[Dashboard.tsx:Dashboard]` Default exported `React.FC` component for listing, searching, creating, and deleting datacenter sites and searching nested devices
- `[GridView.tsx:GridView]` Default exported `React.FC` component rendering the 2D floor grid for datacenter route `:id`, rack placement/editing, CSV export, and bulk CSV import wizard
- `[Login.tsx:Login]` Default exported `React.FC` component for username/password login
- `[Modal.tsx:ModalProps]` Props interface `{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' }`
- `[Modal.tsx:Modal]` Default exported `React.FC<ModalProps>` reusable modal dialog wrapper
- `[RackView.tsx:RackView]` Default exported `React.FC` component rendering vertical U-slot elevation for rack route `:id`, device CRUD, cross-rack/datacenter device relocation with collision preview, 24-hour status history modal, and live ICMP ping diagnostics modal
- `[UserManagement.tsx:UserManagement]` Default exported `React.FC` component for admin user listing, creation, password reset, and deletion (`[UserManagement.tsx:UserData]` internal state shape)

## Invariants
- `[Config.tsx:handleSaveConfig]`, `[Config.tsx:handleAddField]`, `[Config.tsx:handleToggleActive]`, `[Config.tsx:handleToggleRequired]`, `[Config.tsx:handleDeleteField]` Require `isAdmin` to be `true`; `check_interval_seconds` input enforces `min=5, max=3600, required` and `retention_days` enforces `min=1, max=3650, required`; `field_type` is constrained to `'text' | 'number' | 'date' | 'url'`.
- `[Config.tsx:handlePasswordChange]` Requires `passwordData.new === passwordData.confirm` and `passwordData.new.length >= 4`.
- `[Config.tsx:handleDeleteField]` Requires `window.confirm`; removes custom fields (`field.is_custom`) from state while deactivating built-in fields (`is_active = false`).
- `[Dashboard.tsx:handleCreate]` and `[Dashboard.tsx:handleDelete]` Gate datacenter creation and deletion on `isAdmin`; creation form enforces `required` on `name` and `address` and `min=1, max=50` on `width` and `height`.
- `[GridView.tsx:isAdmin]` Gates rack creation (`handleCreate`), rack editing (`handleUpdateRack`), rack deletion (`handleDeleteRack`), datacenter editing (`handleUpdateDC`), datacenter deletion (`handleDeleteDC`), and bulk CSV import controls on `isAdmin`.
- `[GridView.tsx:maxX]` and `[GridView.tsx:maxY]` Derive grid bounds from `dc.width` and `dc.height` (`0 <= x < maxX`, `0 <= y < maxY`); `[GridView.tsx:editRackData]` enforces `0 <= x <= maxX - 1`, `0 <= y <= maxY - 1`, and `1 <= height_u <= 60` (`[GridView.tsx:newRack]` relies on backend validation for coordinates and height); `[GridView.tsx:dcData]` enforces `1 <= width, height <= 100`.
- `[GridView.tsx:handleImportFileChange]` Rejects selected CSV files with `file.size >= 1048576` (`1 MB`) in the browser by setting `importError` without calling `analyzeImport`.
- `[GridView.tsx:executeImport]` Requires `id && importAnalysis && importAnalysis.valid` before committing a bulk CSV import.
- `[Modal.tsx:Modal]` Returns `null` when `isOpen` is `false` and defaults `size` to `'md'`.
- `[RackView.tsx:isAdmin]` Gates device creation (`handleCreate`), updates (`handleUpdate`), moves (`handleMove`), and soft-deletion (`handleDelete`) on `isAdmin`; non-admin clicks on occupied U-slots open the status history modal instead of the edit modal.
- `[RackView.tsx:uSlots]` and `[RackView.tsx:getDeviceAtU]` Render rack elevation from `rack.height_u` down to `1`; a device covers slot `u` when `u >= d.start_u && u < d.start_u + d.u_height` and renders only at `device.start_u === u`.
- `[RackView.tsx:isCollision]` and `[RackView.tsx:isOutOfBounds]` Flag target rack move preview collisions when proposed slots `[moveData.startU, moveData.startU + selectedDevice.u_height - 1]` overlap another device (`d.id !== selectedDevice?.id`) or violate `1 <= startU` and `startU + u_height - 1 <= targetRack.height_u`.
- `[RackView.tsx:renderDynamicFields]` Renders only active fields (`f.is_active`), enforces `required={field.required}`, and maps `field.is_custom` fields to `custom_values[field.name]`.
- `[RackView.tsx:openDiagnosticsModal]` and `[RackView.tsx:runPingCheck]` Enable live ping execution only when `device.ip_addresses` is non-empty and `!diagnosticsLoading`, targeting `ip_addresses.split(',')[0].trim()`.
- `[UserManagement.tsx:UserManagement]` Renders an Access Denied view without fetching users when `!isAdmin`; `[UserManagement.tsx:handleAddUser]` and `[UserManagement.tsx:handleResetPassword]` require matching password and confirmation inputs; `[UserManagement.tsx:handleDeleteUser]` blocks self-deletion (`user.username === currentUser?.username`).

## Side Effects
- `[Config.tsx:Config]` Calls `getConfig`, `getDeviceFields`, `getActivityLogs`, `updateConfig`, `updateOwnPassword`, `createDeviceField`, `updateDeviceField`, and `deleteDeviceField` APIs, and prompts `window.confirm` before field deletion.
- `[Dashboard.tsx:Dashboard]` Calls `getDatacenters`, `createDatacenter`, and `deleteDatacenter` APIs, prompts `window.confirm`/`window.alert`, and navigates via `window.location.href = '/rack/' + device.rack_id` when clicking a device search match.
- `[GridView.tsx:GridView]` Calls `getDatacenter`, `createRack`, `updateRack`, `deleteRack`, `updateDatacenter`, `deleteDatacenter`, `downloadDatacenterExport` (triggers browser CSV download), `analyzeImport`, and `commitImport` APIs, and navigates via `useNavigate`.
- `[Login.tsx:handleSubmit]` Calls `loginApi`, writes `"token"` to `localStorage`, calls `getMe`, and invokes `AuthContext.login`.
- `[RackView.tsx:RackView]` Calls `getRack`, `getDeviceFields`, `createDevice`, `updateDevice`, `deleteDevice`, `getDatacenters`, `getRacks`, `getDeviceHistory`, and `pingDevice` APIs, and prompts `window.confirm`/`window.alert`.
- `[UserManagement.tsx:UserManagement]` Calls `getUsers`, `createUser`, `resetPassword`, and `deleteUser` APIs, and prompts `window.confirm`/`window.alert`.

## Verification
- Run: `npm run build && npm run lint`
