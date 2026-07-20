# Velontri — start the full local stack on Windows
# Run from the project root: pwsh scripts/start.ps1

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

Write-Host "=== Velontri Local Stack ===" -ForegroundColor Cyan

# 1. Check secrets exist
if (-not (Test-Path "secrets\jwt_private_key.pem")) {
    Write-Host "[1/3] Generating JWT key pair..." -ForegroundColor Yellow
    Write-Host "  Run: bash scripts/generate_jwt_keys.sh (requires Git Bash or WSL)"
    Write-Host "  OR generate manually with OpenSSL and place in secrets/"
    exit 1
} else {
    Write-Host "[1/3] JWT keys found." -ForegroundColor Green
}

# 2. Build and start
Write-Host "[2/3] Building and starting services..." -ForegroundColor Yellow
docker compose up --build -d

# 3. Status
Write-Host "[3/3] Services started. Waiting 15 seconds for readiness..." -ForegroundColor Yellow
Start-Sleep 15

Write-Host ""
Write-Host "=== Velontri is running ===" -ForegroundColor Green
Write-Host ""
Write-Host "Auth:         http://localhost:8001/docs"
Write-Host "User:         http://localhost:8002/docs"
Write-Host "Marketplace:  http://localhost:8003/docs"
Write-Host "Search:       http://localhost:8004/docs"
Write-Host "AI:           http://localhost:8005/docs"
Write-Host "Chat:         http://localhost:8006/docs"
Write-Host "Payment:      http://localhost:8007/docs"
Write-Host "Wallet:       http://localhost:8008/docs"
Write-Host "Inventory:    http://localhost:8009/docs"
Write-Host "Logistics:    http://localhost:8010/docs"
Write-Host "Analytics:    http://localhost:8011/docs"
Write-Host "Notification: http://localhost:8012/docs"
Write-Host "CRM:          http://localhost:8013/docs"
Write-Host "Subscription: http://localhost:8014/docs"
Write-Host ""
Write-Host "RabbitMQ:     http://localhost:15672  (velontri/velontri)"
Write-Host "MinIO:        http://localhost:9001   (minioadmin/minioadmin)"
Write-Host "Grafana:      http://localhost:3000   (admin/velontri)"
Write-Host ""
Write-Host "Stop: docker compose down" -ForegroundColor Yellow
