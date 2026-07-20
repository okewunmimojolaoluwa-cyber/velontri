# Velontri Commerce Platform

Pan-African, AI-powered commerce operating system built as 14 independently
deployable Python/FastAPI microservices, with a Next.js frontend workspace.

---

## Monorepo layout

```
velontri/
├── backend/               # APIs, services, Docker, tests, scripts
│   ├── auth-service/
│   ├── gateway/
│   ├── shared/
│   ├── scripts/
│   ├── tests/
│   ├── docker-compose.yml
│   └── package.json
├── frontend/              # Next.js UI (src/, components, pages)
│   ├── src/
│   ├── middleware.ts
│   └── package.json
├── docs/                  # PRD, integration guides, Postman collection
├── package.json           # Workspace scripts (delegates to backend/frontend)
├── README.md
└── .gitignore
```

All backend code lives under `backend/`. All frontend code lives under `frontend/`.

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop/ |
| Docker Compose | v2 (bundled with Docker Desktop) | included |
| PowerShell | 7+ (pwsh) | https://aka.ms/powershell |
| Git | any | https://git-scm.com |
| Python | 3.12+ | https://www.python.org (for unit tests only) |
| OpenSSL | any | bundled with Git for Windows |

---

## Quick Start (3 steps)

### Step 1 — Generate JWT keys

The Auth Service signs tokens with RSA-2048. You need to create the key pair once:

**Windows (PowerShell):**
```powershell
pwsh backend/scripts/generate_jwt_keys.ps1
```

**macOS / Linux / Git Bash:**
```bash
bash backend/scripts/generate_jwt_keys.sh
```

This creates `backend/secrets/jwt_private_key.pem` and `backend/secrets/jwt_public_key.pem`.
These files are gitignored and never committed.

---

### Step 2 — Start the API (single port 8000)

**Fastest — no Docker (recommended for frontend dev):**
```powershell
npm run dev
# or: cd backend && npm run dev
```

All 14 services run in one process on **port 8000**. First start takes ~15 seconds.

**Full Docker stack (Postgres, Redis, RabbitMQ, etc.):**
```powershell
npm run dev:docker
```

**Start the Next.js frontend (separate terminal):**
```powershell
npm run dev:frontend
# or: cd frontend && npm run dev
```

Frontend connects to the same single URL in both modes:
```
http://localhost:8000/api/v1
```

---

### Step 3 — Verify and connect your frontend

```powershell
npm run health
```

Set this in `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Swagger UI (all endpoints):** http://localhost:8000/docs

**WebSocket chat:** `ws://localhost:8000/api/v1/ws/chat?token=<jwt>`

---

### Legacy: per-service ports (debug only)

When running `npm run dev:docker`, individual Swagger UIs remain on ports 8001–8014:

Infrastructure dashboards:

| Tool | URL | Credentials |
|------|-----|-------------|
| RabbitMQ management | http://localhost:15672 | velontri / velontri |
| MinIO (S3) | http://localhost:9001 | minioadmin / minioadmin |
| Grafana | http://localhost:3000 | admin / velontri |
| Prometheus | http://localhost:9090 | — |
| Elasticsearch | http://localhost:9200 | — |

---

### Step 5 — Run unit tests (no Docker needed)

Unit tests run entirely in-memory with SQLite/mocks. No Docker required.

```powershell
# Run a single service (from backend/)
cd backend
python -m pytest auth-service/tests -v

# Run all services via npm
npm run test

# Run shared tests (observability + FX)
python -m pytest tests/test_observability.py tests/test_fx_utils.py -v
```

**Expected total: 402 tests passing.**

---

## Run integration tests (Task 23 — requires Docker stack)

After the Docker stack is running (`npm run dev:docker` from repo root):

```powershell
cd backend
pip install httpx pytest pytest-timeout
npm run test:e2e
```

The 3 flows tested:

1. **Purchase flow** — Registration → Listing → Search → Payment → Escrow
2. **Inventory flow** — Branch Creation → Stock → Transfer → Low-Stock Alert
3. **Subscription flow** — Upgrade → Quota Increase → Feature Gate Unlock

The integration tests also verify that all 14 `/health` and `/metrics` endpoints
respond correctly.

---

## Database migrations

Each service with a PostgreSQL database has Alembic migrations.
In `ENVIRONMENT=development` mode (the default in docker-compose) migrations are
applied automatically on startup via `Base.metadata.create_all`.

To apply migrations manually:
```bash
# From inside the container
docker compose exec auth-service alembic upgrade head

# Or all services at once
for svc in auth-service user-service marketplace-service payment-service \
           wallet-service inventory-service chat-service analytics-service \
           crm-service logistics-service subscription-service notification-service; do
  docker compose exec $svc alembic upgrade head
done
```

---

## Stop the stack

```powershell
# Stop all containers (preserves volumes/data)
docker compose down

# Stop AND delete all data (full reset)
docker compose down -v
```

---

## Architecture overview

```
Client (Web / Mobile)
       │ HTTPS
  API Gateway (port routing)
       │
  ┌────┴────────────────────────────────────┐
  │  14 FastAPI microservices               │
  │  (auth · user · marketplace · search    │
  │   ai · chat · payment · wallet          │
  │   inventory · logistics · analytics     │
  │   notification · crm · subscription)    │
  └──────────────┬──────────────────────────┘
                 │ async events
            RabbitMQ (port 5672)
                 │
  ┌──────────────┴──────────────────────────┐
  │  Shared infrastructure                   │
  │  PostgreSQL × 12  Redis  Elasticsearch   │
  │  MinIO (S3)  Prometheus  Grafana         │
  └─────────────────────────────────────────┘
```

Each service owns its own database (database-per-service pattern).
Services communicate asynchronously via RabbitMQ topic exchange `velontri.events`.
Synchronous calls (JWT introspection, Search → AI, Payment → Wallet) use HTTP/REST.

---

## Project structure

See **Monorepo layout** at the top of this file. Key backend paths:

| Path | Purpose |
|------|---------|
| `backend/gateway/` | Unified API on port 8000 |
| `backend/shared/` | JWT, RabbitMQ, S3, database utilities |
| `backend/infra/` | Prometheus, Grafana, nginx, k8s manifests |
| `backend/tests/integration/` | End-to-end Docker Compose flows |
| `backend/scripts/` | Dev gateway, keygen, health checks |
| `frontend/src/` | Next.js app router pages and components |
| `frontend/middleware.ts` | JWT auth protection middleware |

---

## Troubleshooting

**Docker build fails with "no space left"**
```powershell
docker system prune -f
```

**Service crashes immediately**
```powershell
# Check logs
docker compose logs auth-service --tail=50
```

**JWT key errors**
```powershell
# Regenerate keys
Remove-Item backend\secrets\*.pem -Force
pwsh backend/scripts/generate_jwt_keys.ps1
cd backend; docker compose restart auth-service
```

**RabbitMQ connection refused**
```powershell
# RabbitMQ takes ~30s to start; wait and retry
docker compose restart auth-service user-service
```

**Elasticsearch not ready**
```powershell
# Check ES status
Invoke-RestMethod http://localhost:9200/_cluster/health
# If red/unavailable, wait 60s and retry
```

**Port already in use**
```powershell
# Find what's using a port (e.g. 8001)
netstat -ano | findstr :8001
```
