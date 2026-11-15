# Frontend Authentication Context (`frontend/src/context`)

## Overview
React authentication context provider and hook managing JWT session state, current user profile, admin role derivation, and `localStorage` persistence across the frontend application.

## Interface
- `[AuthContext.tsx:AuthProvider]` `React.FC<{ children: React.ReactNode }>` providing `AuthContextType` (`{ user: User | null, token: string | null, login: (token: string, user: User) => void, logout: () => void, isAdmin: boolean }`)
- `[AuthContext.tsx:useAuth]` `() => AuthContextType` hook returning the active authentication context

## Invariants
- `[AuthContext.tsx:useAuth]` Throws `Error("useAuth must be used within AuthProvider")` if invoked outside an `AuthProvider` tree.
- `[AuthContext.tsx:AuthProvider]` Sets `isAdmin` to `true` if and only if `user?.role === "admin"`.
- `[AuthContext.tsx:AuthProvider]` Restores `user` state from `localStorage.getItem("user")` on mount/token change only when both `savedUser` and `token` are truthy.

## Side Effects
- `[AuthContext.tsx:AuthProvider]` Reads `"token"` and `"user"` from `window.localStorage` during state initialization and inside `useEffect`.
- `[AuthContext.tsx:login]` Writes `"token"` and JSON-serialized `"user"` to `window.localStorage` and updates React state.
- `[AuthContext.tsx:logout]` Removes `"token"` and `"user"` from `window.localStorage` and clears `token` and `user` state to `null`.

## Verification
- Run: `npm run build && npm run lint`
