Write-Host ""
Write-Host "CORS Test for Velontri" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

$URL = "https://velontri.onrender.com/api/v1"

Write-Host "[1] Testing backend health..." -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "https://velontri.onrender.com/health" -Method Get -TimeoutSec 10
    Write-Host "  OK - Backend is online" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - Backend offline" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2] Testing OPTIONS preflight..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = "https://velontri.pxxl.click"
        "Access-Control-Request-Method" = "GET"
    }
    $r = Invoke-WebRequest -Uri "$URL/listings" -Method Options -Headers $headers -UseBasicParsing -TimeoutSec 10
    Write-Host "  OK - Status: $($r.StatusCode)" -ForegroundColor Green
    Write-Host "  Allow-Origin: $($r.Headers['Access-Control-Allow-Origin'])" -ForegroundColor White
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[3] Testing GET listings..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$URL/listings?page=1&page_size=6" -Method Get -TimeoutSec 10
    Write-Host "  OK - Retrieved $($r.items.Count) listings" -ForegroundColor Green
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "If tests passed, refresh https://velontri.pxxl.click" -ForegroundColor Green
Write-Host ""
