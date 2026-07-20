#!/usr/bin/env bash
# Velontri — start the full local stack
# Run from the project root: bash scripts/start.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Velontri Local Stack ==="

# 1. Generate JWT keys if they don't exist
if [[ ! -f secrets/jwt_private_key.pem ]]; then
    echo "[1/3] Generating JWT key pair..."
    bash scripts/generate_jwt_keys.sh
else
    echo "[1/3] JWT keys already exist — skipping."
fi

# 2. Build and start all services
echo "[2/3] Building Docker images and starting services..."
docker compose up --build -d

# 3. Wait for services to become healthy
echo "[3/3] Waiting for services to be ready..."
sleep 10

echo ""
echo "=== Velontri is running ==="
echo ""
echo "Service endpoints:"
echo "  Auth:         http://localhost:8001/docs"
echo "  User:         http://localhost:8002/docs"
echo "  Marketplace:  http://localhost:8003/docs"
echo "  Search:       http://localhost:8004/docs"
echo "  AI:           http://localhost:8005/docs"
echo "  Chat:         http://localhost:8006/docs"
echo "  Payment:      http://localhost:8007/docs"
echo "  Wallet:       http://localhost:8008/docs"
echo "  Inventory:    http://localhost:8009/docs"
echo "  Logistics:    http://localhost:8010/docs"
echo "  Analytics:    http://localhost:8011/docs"
echo "  Notification: http://localhost:8012/docs"
echo "  CRM:          http://localhost:8013/docs"
echo "  Subscription: http://localhost:8014/docs"
echo ""
echo "Infrastructure:"
echo "  RabbitMQ:     http://localhost:15672  (velontri/velontri)"
echo "  MinIO:        http://localhost:9001   (minioadmin/minioadmin)"
echo "  Grafana:      http://localhost:3000   (admin/velontri)"
echo "  Prometheus:   http://localhost:9090"
echo ""
echo "Stop with: docker compose down"
