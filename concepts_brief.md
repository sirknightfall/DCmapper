# Reusable Plain-HTTP Frontend and Internal-Only Backend Compose Architecture

* **Author:** Gemini CLI
* **Date:** 2026-11-15

## Overview

DCmapper currently builds a self-signed TLS certificate into the frontend Nginx container, redirects all port 80 HTTP traffic to port 443 HTTPS, maps host port 3000 to container port 443, and exposes the FastAPI backend directly on host port 8000. This couples the container to a single deployment topology and causes redirect loops or certificate trust conflicts when placed behind an F5 load balancer or an upstream Nginx reverse proxy that terminates TLS.

This change refactors `frontend/Dockerfile`, `frontend/nginx.conf`, and `docker-compose.yml` so the frontend container serves plain HTTP on container port 80 mapped to host port `3000` (`"3000:80"`) at the root path (`/`), while keeping backend port `8000` internal to the Docker network. Bulk CSV imports are capped below the 1 MB Nginx body limit, and FastAPI is configured with `ROOT_PATH=/api` in Docker Compose so interactive API documentation (`/api/docs`) remains accessible through the frontend proxy without exposing port 8000 on the host.

## Analysis

### Contradictions and Trade-offs Identified by Goldfish Reviewers

1. **Host Port Conflict vs. Reverse Proxy Co-location (`docker-compose.yml`):**
   Binding host port `80` directly in `docker-compose.yml` would conflict with an upstream Nginx reverse proxy running on the same host (which binds ports 80 and 443). Publishing host port `3000` mapped to container port `80` (`"3000:80"`, or `"${FRONTEND_PORT:-3000}:80"`) avoids any conflict with host ports 80/443 while allowing standalone access on `http://<host>:3000` and allowing an F5 load balancer or same-host Nginx reverse proxy to forward traffic to port `3000`.
2. **Upstream Protocol Header Overwrite (`X-Forwarded-Proto` in `frontend/nginx.conf`):**
   `frontend/nginx.conf` currently sets `proxy_set_header X-Forwarded-Proto $scheme;`. When an F5 load balancer or upstream Nginx proxy terminates HTTPS and forwards plain HTTP to the frontend container, `$scheme` inside the container is `http`, overwriting the upstream `X-Forwarded-Proto: https` header. Using an Nginx `map` block to preserve `$http_x_forwarded_proto` when present (and falling back to `$scheme` when absent) preserves accurate protocol metadata for both standalone and proxied deployments.
3. **Enforcing the < 1 MB Import Limit Across Client, Nginx, and Backend:**
   Because all API traffic now flows through the frontend Nginx proxy (`/api/`), Nginx's 1 MB default `client_max_body_size` applies to bulk CSV imports (`POST /api/datacenters/{dc_id}/import/analyze`). If a user uploads a file >= 1 MB, Nginx returns an HTML `413 Request Entity Too Large` page instead of a structured JSON error. Setting `client_max_body_size 1m;` in `frontend/nginx.conf` and enforcing a strict `< 1 MB` (`1,048,576` bytes) check in both `frontend/src/components/GridView.tsx` (before upload) and `backend/app/main.py` (`analyze_import`) gives users a clear validation error before hitting the proxy ceiling.
4. **Swagger UI (`/api/docs`) Accessibility Without Publishing Port 8000:**
   When `backend` port 8000 is internal-only, `http://localhost:8000/docs` is no longer directly reachable from the host. By configuring `FastAPI(title="DCmapper API", root_path=os.getenv("ROOT_PATH", ""))` in `backend/app/main.py` and setting `ROOT_PATH=/api` on the `backend` service in `docker-compose.yml`, Swagger UI is served through the frontend Nginx proxy at `/api/docs` (fetching `/api/openapi.json`) while local non-Docker uvicorn execution (`ROOT_PATH` unset) continues to work at `/docs`.

### Ideal Final Result

A single frontend container image without OpenSSL or baked-in certificates that listens on container port 80 (published on host port `3000`), proxies `/api/` to `http://backend:8000/` on the internal Docker network, enforces a `< 1 MB` import limit with structured feedback, and exposes Swagger UI at `/api/docs`.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Remove `openssl` installation, self-signed certificate generation, and `EXPOSE 443` from `frontend/Dockerfile`.
  * Replace the dual port 80 redirect + port 443 SSL server blocks in `frontend/nginx.conf` with a single port 80 HTTP server block at `/`, preserving upstream `X-Forwarded-Proto` and setting `client_max_body_size 1m;`.
  * Update `docker-compose.yml` to map `"3000:80"` on `frontend`, remove host port `8000:8000` from `backend`, and pass `ROOT_PATH=/api` to `backend`.
  * Configure `root_path=os.getenv("ROOT_PATH", "")` in `backend/app/main.py` so `/api/docs` and `/api/openapi.json` work through the frontend Nginx proxy.
  * Enforce a `< 1 MB` (`1,048,576` bytes) file size limit on bulk CSV imports in `frontend/src/components/GridView.tsx` and `backend/app/main.py`.
  * Update `README.md`, `frontend/README.md`, `backend/app/README.md`, and `frontend/src/components/README.md` to match the new port, proxy, and import constraints.
* **Out-of-Scope Non-Goals:**
  * Subpath hosting (for example, serving DCmapper under `/dcmapper/` instead of `/`).
  * Built-in TLS termination or certificate management inside the `dcmapper-frontend` container.
  * Database schema migrations or changes to existing authentication/authorization roles.

## Alternatives Weighed

* **Binding Host Port 80 (`"80:80"`) in Base `docker-compose.yml`:** Rejected by author in favor of non-privileged host port `3000` (`"3000:80"`) because production deployments sit behind an F5 load balancer or an upstream Nginx reverse proxy that binds ports 80/443.
* **Raising Nginx `client_max_body_size` Above 1 MB:** Rejected by author in favor of enforcing a `< 1 MB` limit on bulk CSV imports.
* **Runtime Environment Variable TLS Mode Switching Inside Container:** Rejected by author in favor of plain HTTP inside the container with TLS handled upstream by F5 or Nginx.
* **Subpath Reverse-Proxy Support (`/dcmapper/`):** Rejected by author because all target deployments host DCmapper at the root path (`/`).

## Key Decisions & Staging for Next Steps

* **Frontend Container & Host Port Mapping:** Container listens on plain HTTP port 80 (`EXPOSE 80`); base `docker-compose.yml` maps host port `3000` to container port `80` (`"3000:80"`).
* **Backend Internal Isolation & Swagger UI:** Remove `ports: - "8000:8000"` from `backend` in `docker-compose.yml`, set `ROOT_PATH=/api` in `docker-compose.yml`, and read `root_path=os.getenv("ROOT_PATH", "")` in `backend/app/main.py` so Swagger UI is accessible at `/api/docs`.
* **Bulk Import File Size Cap (< 1 MB):** Set `client_max_body_size 1m;` in `frontend/nginx.conf` and validate file size `< 1,048,576` bytes in `frontend/src/components/GridView.tsx` and `backend/app/main.py` (`analyze_import`).
