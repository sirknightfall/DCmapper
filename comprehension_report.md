**What this proposes**
This design refactors DCmapper's container and Docker Compose architecture so `dcmapper-frontend` serves the React SPA and `/api/` reverse proxy over plain HTTP on container port `80` (mapped to host port `3000`) instead of terminating TLS with a build-time self-signed certificate on port `443`. It removes host port `8000` publishing from `dcmapper-backend` so the backend is only reachable over the internal Docker network through the frontend Nginx proxy, while configuring FastAPI's `root_path` via `ROOT_PATH=/api` so Swagger UI remains functional at `/api/docs`. Additionally, it preserves upstream `X-Forwarded-Proto` headers when deployed behind an F5 load balancer or Nginx reverse proxy and enforces a `< 1 MB` (`1,048,576` bytes) bulk CSV import size limit across the React UI (`GridView.tsx`), Nginx (`client_max_body_size 1m;`), and the FastAPI import analysis endpoint (`backend/app/main.py`).

**How the existing system works, per this document**
DCmapper is a containerized web application with a React + TypeScript frontend served by Nginx (`dcmapper-frontend`) and a FastAPI + SQLite backend (`dcmapper-backend`). Currently, `frontend/Dockerfile` installs OpenSSL and generates a self-signed certificate (`CN=localhost`) at build time, while `frontend/nginx.conf` redirects all port `80` requests (`301`) to `https://` and terminates TLS on port `443` (mapped to host port `3000`). Meanwhile, `docker-compose.yml` publishes `dcmapper-backend` port `8000` directly to the host network, and the bulk CSV import workflow reads and parses uploaded CSV files synchronously in memory without an explicit application-level `< 1 MB` size check before hitting Nginx's default 1 MB body limit.

---

### Comprehension Findings

1. **Severity**: Nit
   * **Affected Scope**: Detailed Implementation Plan -> Execution Phases & Checkpoints (`docs/designs/reusable-http-frontend-compose.md`, line 154)
   * **Discrepancy Description & Rationale**: Line 154 references "all EGM contracts" without defining the acronym "EGM" in the document (it only appears again in the provenance footer on lines 266–268). Replacing "EGM contracts" with "blueprint and package README contracts" (or defining the acronym inline) keeps the execution plan self-contained for a fresh reader.
