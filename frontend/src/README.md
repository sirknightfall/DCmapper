# Frontend Source (`frontend/src`)

## Overview
Root TypeScript/React source package containing the application entry point, top-level router and navigation shell, Axios REST API client, shared TypeScript domain interfaces, authentication context, and view components.

## Interface
- `[main.tsx:createRoot]` Application bootstrap mounting `<StrictMode><App /></StrictMode>` into `#root`
- `[App.tsx:App]` Default exported root React component wrapping `AuthProvider`, `BrowserRouter`, and `MainContent` (`/` -> `Dashboard`, `/datacenter/:id` -> `GridView`, `/rack/:id` -> `RackView`, `/config` -> `Config`, `/users` -> `UserManagement`)
- `[types.ts:Datacenter]`, `[types.ts:DatacenterWithRacks]`
- `[types.ts:Rack]`, `[types.ts:RackWithDevices]`
- `[types.ts:Device]`, `[types.ts:DeviceField]`, `[types.ts:SystemConfig]`, `[types.ts:StatusHistory]`
- `[api.ts:login]`, `[api.ts:getMe]`, `[api.ts:getUsers]`, `[api.ts:createUser]`, `[api.ts:updateOwnPassword]`, `[api.ts:resetPassword]`, `[api.ts:deleteUser]`
- `[api.ts:getDatacenters]`, `[api.ts:getDatacenter]`, `[api.ts:createDatacenter]`, `[api.ts:updateDatacenter]`, `[api.ts:deleteDatacenter]`, `[api.ts:downloadDatacenterExport]`, `[api.ts:analyzeImport]`, `[api.ts:commitImport]`
- `[api.ts:getRack]`, `[api.ts:getRacks]`, `[api.ts:createRack]`, `[api.ts:updateRack]`, `[api.ts:deleteRack]`
- `[api.ts:createDevice]`, `[api.ts:updateDevice]`, `[api.ts:deleteDevice]`, `[api.ts:getDeviceHistory]`, `[api.ts:pingDevice]`
- `[api.ts:getConfig]`, `[api.ts:updateConfig]`, `[api.ts:getDeviceFields]`, `[api.ts:createDeviceField]`, `[api.ts:updateDeviceField]`, `[api.ts:deleteDeviceField]`, `[api.ts:getActivityLogs]`
- Subdirectories:
  - [`./components/README.md`](./components/README.md) - View and modal React components (`Config`, `Dashboard`, `GridView`, `Login`, `Modal`, `RackView`, `UserManagement`)
  - [`./context/README.md`](./context/README.md) - Authentication React context provider and hook (`AuthProvider`, `useAuth`)

## Invariants
- `[types.ts:Device]` Constrains `Device.status` to `'Online' | 'Offline' | 'Unknown'`.
- `[types.ts:StatusHistory]` Constrains `StatusHistory.status` to `'Online' | 'Offline'`.
- `[App.tsx:MainContent]` Renders `<Login />` instead of the navigation shell and routes whenever `user` from `useAuth()` is null.
- `[api.ts:getBaseUrl]` Resolves the backend API base URL in order: `import.meta.env.VITE_API_URL`, `'/api'` when `import.meta.env.PROD` is true, or `${window.location.protocol}//${window.location.hostname}:8000`.

## Side Effects
- `[main.tsx:createRoot]` Mounts the React application into `#root` on module execution.
- `[api.ts:api]` Registers a request interceptor that reads `'token'` from `window.localStorage` and attaches `Authorization: Bearer ${token}`, and a response interceptor that clears `'token'` and `'user'` from `window.localStorage` and redirects to `'/'` (`window.location.href = '/'`) on HTTP 401 responses.
- `[api.ts:downloadDatacenterExport]` Creates a blob URL and temporary DOM `<a>` element to trigger a browser file download (`dc_${dcName}_export.csv`), then revokes the object URL.

## Verification
- Run: `npm run build && npm run lint`
