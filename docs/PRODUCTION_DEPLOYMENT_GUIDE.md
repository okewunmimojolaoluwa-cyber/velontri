# Velontri Production Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- A PostgreSQL 15+ server (or managed RDS)
- Redis 7+
- RabbitMQ 3.12+
- Elasticsearch 8+
- An S3-compatible bucket (AWS S3 or MinIO)
- Domain DNS pointing to your server

---

## Docker Compose Production Override

Save as `docker-compose.prod.yml` and run:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/ssl/velontri:/etc/ssl/velontri:ro
    depends_on:
      - auth-service
      - marketplace-service
      - chat-service
    restart: unless-stopped

  auth-service:
    image: velontri/auth-service:${SERVICE_VERSION:-latest}
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${AUTH_DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private_key
      - JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
      - TOTP_ENCRYPTION_KEY=${TOTP_ENCRYPTION_KEY}
    secrets:
      - jwt_private_key
      - jwt_public_key
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  marketplace-service:
    image: velontri/marketplace-service:${SERVICE_VERSION:-latest}
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${MARKETPLACE_DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
      - AWS_S3_BUCKET=${AWS_S3_BUCKET}
      - AWS_REGION=${AWS_REGION}
    secrets:
      - jwt_public_key
      - aws_credentials
    deploy:
      replicas: 2

  payment-service:
    image: velontri/payment-service:${SERVICE_VERSION:-latest}
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${PAYMENT_DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
      - PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY}
      - FLUTTERWAVE_SECRET_KEY=${FLUTTERWAVE_SECRET_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    secrets:
      - jwt_public_key
    deploy:
      replicas: 1  # Payment service: single instance to prevent double-processing

  wallet-service:
    image: velontri/wallet-service:${SERVICE_VERSION:-latest}
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${WALLET_DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
    secrets:
      - jwt_public_key
    deploy:
      replicas: 1  # Wallet: single instance for transaction safety

  chat-service:
    image: velontri/chat-service:${SERVICE_VERSION:-latest}
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=${CHAT_DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - RABBITMQ_URL=${RABBITMQ_URL}
      - JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public_key
    secrets:
      - jwt_public_key
    deploy:
      replicas: 3  # More replicas for WebSocket load

secrets:
  jwt_private_key:
    file: ./secrets/jwt_private_key.pem
  jwt_public_key:
    file: ./secrets/jwt_public_key.pem
  aws_credentials:
    file: ./secrets/aws_credentials
```

---

## Secret Management

**Never store secrets in environment variables directly in docker-compose.yml.** Use Docker secrets or a vault.

### Docker Secrets Setup

```bash
# Generate RSA key pair for JWT
openssl genrsa -out secrets/jwt_private_key.pem 4096
openssl rsa -in secrets/jwt_private_key.pem -pubout -out secrets/jwt_public_key.pem

# Add to git ignore
echo "secrets/*.pem" >> .gitignore
echo "secrets/aws_credentials" >> .gitignore
echo ".env.production" >> .gitignore
```

### HashiCorp Vault (recommended for enterprise)

```bash
# Store JWT private key
vault kv put secret/velontri/jwt private_key=@secrets/jwt_private_key.pem

# Read in Docker entrypoint
vault kv get -field=private_key secret/velontri/jwt > /run/secrets/jwt_private_key
```

---

## TLS / SSL Setup

### Let's Encrypt (Certbot)

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d api.velontri.com

# Auto-renewal (add to crontab)
0 3 * * * certbot renew --quiet --post-hook "nginx -s reload"
```

### Manual Certificate

```bash
# Copy certificates
mkdir -p /etc/ssl/velontri
cp fullchain.pem /etc/ssl/velontri/
cp privkey.pem /etc/ssl/velontri/
chmod 600 /etc/ssl/velontri/privkey.pem
```

---

## Database Backup Strategy

### Automated PostgreSQL Backup

```bash
#!/bin/bash
# infra/scripts/backup_postgres.sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgres
S3_BUCKET=${AWS_S3_BUCKET:-velontri-backups}
DATABASES=(velontri_auth velontri_marketplace velontri_wallet velontri_payments velontri_chat)

mkdir -p "$BACKUP_DIR"

for DB in "${DATABASES[@]}"; do
  FILENAME="${DB}_${TIMESTAMP}.sql.gz"
  pg_dump -h postgres -U velontri -d "$DB" | gzip > "$BACKUP_DIR/$FILENAME"
  aws s3 cp "$BACKUP_DIR/$FILENAME" "s3://${S3_BUCKET}/backups/postgres/$FILENAME"
  rm "$BACKUP_DIR/$FILENAME"
  echo "Backed up $DB → s3://${S3_BUCKET}/backups/postgres/$FILENAME"
done
```

**Cron schedule:** Daily at 2 AM, keep 30 days

```cron
0 2 * * * /opt/velontri/infra/scripts/backup_postgres.sh >> /var/log/velontri/backup.log 2>&1
```

### Point-in-Time Recovery (AWS RDS)

Enable automated backups with 7-day retention in RDS. Use a read replica for analytics queries.

---

## Kubernetes Deployment Summary

See `infra/k8s/` for full manifests. Key resources per service:

```yaml
# infra/k8s/auth-service.yaml (abbreviated)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: velontri
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: velontri/auth-service:latest
          ports:
            - containerPort: 8001
          envFrom:
            - secretRef:
                name: velontri-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 20
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: velontri
spec:
  selector:
    app: auth-service
  ports:
    - port: 8001
      targetPort: 8001
```

**HPA (Horizontal Pod Autoscaler)** — see `infra/k8s/hpa.yml`:
- Auth: 2–5 replicas (CPU > 70%)
- Marketplace: 2–8 replicas (CPU > 70%)
- Chat: 3–10 replicas (connection count metric)

---

## Health Check Configuration

Every service exposes `GET /health`:
```json
{
  "service": "auth-service",
  "version": "1.0.0",
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "rabbitmq": "ok"
  }
}
```

Nginx upstream health check (Nginx Plus or OpenResty):
```nginx
upstream auth_service {
  server auth-service:8001;
  health_check interval=10s fails=2 passes=2 uri=/health;
}
```

---

## Zero-Downtime Deployment

### Rolling update with Docker Compose

```bash
# Build new image
docker build -t velontri/auth-service:v1.2.0 ./auth-service

# Update service with no-downtime rolling restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps --scale auth-service=3 auth-service

# Wait for health checks to pass
sleep 30

# Remove old instances
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps --scale auth-service=2 auth-service
```

### Kubernetes rolling update

```bash
# Update image tag
kubectl set image deployment/auth-service \
  auth-service=velontri/auth-service:v1.2.0 \
  -n velontri

# Monitor rollout
kubectl rollout status deployment/auth-service -n velontri

# Rollback if needed
kubectl rollout undo deployment/auth-service -n velontri
```

### Database migrations (run before deployment)

```bash
# Run Alembic migrations before deploying new code
docker run --rm \
  -e DATABASE_URL="${AUTH_DATABASE_URL}" \
  velontri/auth-service:v1.2.0 \
  alembic upgrade head
```

Always make migrations backward-compatible (additive only). Never drop columns in the same release as the code change.

---

## Monitoring Endpoints

| Endpoint | Service | Description |
|---|---|---|
| `GET /health` | All | Service health (DB, Redis, MQ) |
| `GET /metrics` | All | Prometheus metrics |

Access metrics with HTTP basic auth (password in `METRICS_PASSWORD` env var).

Prometheus scrape config:
```yaml
scrape_configs:
  - job_name: velontri
    static_configs:
      - targets:
          - auth-service:8001
          - marketplace-service:8003
          - wallet-service:8008
          - payment-service:8007
    basic_auth:
      username: prometheus
      password_file: /etc/prometheus/metrics_password
    metrics_path: /metrics
```
