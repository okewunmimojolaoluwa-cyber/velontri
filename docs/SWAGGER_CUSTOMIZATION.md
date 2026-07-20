# Velontri Swagger & API Documentation

## Accessing Swagger UI

Each microservice exposes Swagger UI **only in development and staging** (disabled in production via `docs_url=None` when `ENVIRONMENT=production`).

| Service | Swagger URL | ReDoc URL |
|---|---|---|
| Auth | http://localhost:8001/docs | http://localhost:8001/redoc |
| User | http://localhost:8002/docs | http://localhost:8002/redoc |
| Marketplace | http://localhost:8003/docs | http://localhost:8003/redoc |
| Search | http://localhost:8004/docs | http://localhost:8004/redoc |
| AI | http://localhost:8005/docs | http://localhost:8005/redoc |
| Chat | http://localhost:8006/docs | http://localhost:8006/redoc |
| Payment | http://localhost:8007/docs | http://localhost:8007/redoc |
| Wallet | http://localhost:8008/docs | http://localhost:8008/redoc |
| Inventory | http://localhost:8009/docs | http://localhost:8009/redoc |
| Logistics | http://localhost:8010/docs | http://localhost:8010/redoc |
| Analytics | http://localhost:8011/docs | http://localhost:8011/redoc |
| Notification | http://localhost:8012/docs | http://localhost:8012/redoc |
| CRM | http://localhost:8013/docs | http://localhost:8013/redoc |
| Subscription | http://localhost:8014/docs | http://localhost:8014/redoc |

OpenAPI JSON schemas available at: `http://localhost:800{N}/openapi.json`

---

## Authenticating in Swagger UI

1. Open any Swagger UI (e.g., http://localhost:8003/docs)
2. Call `POST /api/v1/auth/login` first to get a token:
   - Click the endpoint in the Auth service Swagger, enter credentials, Execute
3. Copy the `access_token` from the response
4. Click the **Authorize** button (🔓) at the top right
5. In the `HTTPBearer` field, paste the token
6. Click **Authorize**, then **Close**

All subsequent requests in Swagger will include `Authorization: Bearer <token>`.

---

## Consolidated Swagger UI (All Services)

To view all 14 services in one Swagger UI, use the `docs/openapi/velontri_openapi.yaml` file with a local Swagger viewer:

```bash
# Using swagger-ui-serve (Node.js)
npx swagger-ui-serve docs/openapi/velontri_openapi.yaml

# Using docker
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/api/velontri_openapi.yaml \
  -v $(pwd)/docs/openapi:/api \
  swaggerapi/swagger-ui
```

Access at http://localhost:8080

---

## FastAPI Swagger Customization

To customize the Swagger UI per service, update the `create_app()` function:

```python
from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

def create_app() -> FastAPI:
    app = FastAPI(
        title="Velontri Marketplace Service",
        description="""
## Marketplace Service

Manage listings, bookings, reviews, and stores.

### Authentication
All write operations require `Authorization: Bearer <token>`.
Browse and search are public.

### Pagination
All list endpoints return `meta.total`, `meta.has_next`, `meta.total_pages`.
        """,
        version="1.0.0",
        contact={
            "name": "Velontri Engineering",
            "email": "dev@velontri.com",
        },
        license_info={
            "name": "Proprietary",
        },
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        swagger_ui_parameters={
            "persistAuthorization": True,     # Remember token across page refresh
            "displayRequestDuration": True,   # Show request timing
            "filter": True,                   # Show filter bar
            "tryItOutEnabled": True,          # Auto-enable "Try it out"
            "syntaxHighlight.theme": "monokai",
        },
    )
    return app
```

### Custom Swagger OAuth2 Config

```python
app = FastAPI(
    swagger_ui_init_oauth={
        "clientId": "velontri-swagger",
        "appName": "Velontri API",
        "usePkceWithAuthorizationCodeGrant": True,
    },
)
```

---

## ReDoc Alternative

ReDoc provides a cleaner, read-only documentation view suited for external developers.

Access at: `http://localhost:800{N}/redoc`

To set a custom logo in ReDoc:
```python
from fastapi import FastAPI
from fastapi.openapi.docs import get_redoc_html
from fastapi.responses import HTMLResponse

@app.get("/redoc", include_in_schema=False)
async def custom_redoc():
    return get_redoc_html(
        openapi_url="/openapi.json",
        title="Velontri API Reference",
        redoc_logo_url="https://media.velontri.com/brand/logo-dark.svg",
        redoc_favicon_url="https://velontri.com/favicon.ico",
    )
```

---

## Hiding Internal Endpoints

Internal endpoints (e.g., `/internal/wallet/credit`) are excluded from the public OpenAPI schema using `include_in_schema=False`:

```python
@router.post("/internal/wallet/credit", include_in_schema=False)
async def internal_credit(...):
    ...
```

These endpoints are protected by network policy and never exposed to external traffic.

---

## API Versioning

Current version: `v1`

All endpoints are prefixed `/api/v1/`. When `v2` is needed:
- New router is registered at `/api/v2/`
- `v1` is maintained for 12 months
- Breaking changes are documented in `docs/CHANGELOG.md`
- The `Sunset` header will be set on deprecated v1 endpoints

---

## Generating a Client SDK from OpenAPI

```bash
# Install openapi-generator
npm install @openapitools/openapi-generator-cli -g

# TypeScript/Axios client
openapi-generator-cli generate \
  -i docs/openapi/velontri_openapi.yaml \
  -g typescript-axios \
  -o sdk/generated/typescript \
  --additional-properties=npmName=@velontri/api-client

# Dart/Flutter client
openapi-generator-cli generate \
  -i docs/openapi/velontri_openapi.yaml \
  -g dart-dio \
  -o sdk/generated/dart
```
