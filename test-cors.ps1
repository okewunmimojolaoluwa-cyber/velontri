#!/usr/bin/env pwsh
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Velontri CORS Testing Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$BACKEND_URL = "https://velontri.onrender.com/api/v1"
$FRONTEND_ORIGIN = "https://velontri.pxxl.click"

# Test 1: Backend Health
Write-Host "[TEST 1] Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://velontri.onrender.com/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  ✓ Backend is online" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Backend offline: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: OPTIONS Preflight
Write-Host "`n[TEST 2] Testing CORS preflight (OPTIONS)..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = $FRONTEND_ORIGIN
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "authorization,content-type"
    }
    
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/listings" -Method Options -Headers $headers -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    
    Write-Host "  ✓ OPTIONS successful ($($response.StatusCode))" -ForegroundColor Green
    Write-Host "    Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor White
    Write-Host "    Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])" -ForegroundColor White
} catch {
    Write-Host "  ✗ OPTIONS failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "    ⚠ 400 error - deployment may still be in progress" -ForegroundColor Yellow
    }
}

# Test 3: GET Request
Write-Host "`n[TEST 3] Testing GET request..." -ForegroundColor Yellow
try {
    $headers = @{ "Origin" = $FRONTEND_ORIGIN }
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/listings?page=1&page_size=6" -Method Get -Headers $headers -TimeoutSec 10 -ErrorAction Stop
    
    $count = $response.items.Count
    Write-Host "  ✓ GET successful - $count listings retrieved" -ForegroundColor Green
} catch {
    Write-Host "  ✗ GET failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'If all tests passed, hard refresh the frontend:' -ForegroundColor Green
Write-Host '  https://velontri.pxxl.click' -ForegroundColor White
Write-Host '  Press Ctrl+Shift+R in browser to refresh' -ForegroundColor White
Write-Host ''
