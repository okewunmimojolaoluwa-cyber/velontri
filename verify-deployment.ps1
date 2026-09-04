# Velontri Deployment Verification Script
# Tests that both frontend and backend are working correctly

Write-Host "🔍 Velontri Deployment Verification" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

$apiUrl = "https://velontri.onrender.com/api/v1"
$frontendUrl = "https://velontri.pxxl.click"

# Test 1: Backend Health Check
Write-Host "1️⃣  Testing backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/../health" -Method Get -TimeoutSec 30
    Write-Host "✓ Backend is healthy" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend health check failed: $_" -ForegroundColor Red
}

# Test 2: API Listings Endpoint
Write-Host "`n2️⃣  Testing listings API..." -ForegroundColor Yellow
try {
    $listings = Invoke-RestMethod -Uri "$apiUrl/listings?page=1&page_size=12" -Method Get -TimeoutSec 30
    $count = if ($listings.data) { $listings.data.Count } else { 0 }
    $total = if ($listings.meta.total) { $listings.meta.total } else { 0 }
    
    Write-Host "✓ Listings API working" -ForegroundColor Green
    Write-Host "   Returned: $count listings" -ForegroundColor Gray
    Write-Host "   Total in DB: $total listings" -ForegroundColor Gray
    
    if ($total -eq 0) {
        Write-Host "   ⚠️  Warning: No listings in database" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Listings API failed: $_" -ForegroundColor Red
}

# Test 3: Frontend Accessibility
Write-Host "`n3️⃣  Testing frontend accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $frontendUrl -Method Get -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Frontend is accessible" -ForegroundColor Green
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        
        # Check if API URL is in the HTML
        if ($response.Content -match "velontri\.onrender\.com") {
            Write-Host "   ✓ Production API URL found in build" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Production API URL not detected" -ForegroundColor Yellow
            Write-Host "   This might mean the frontend was built with localhost" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Frontend check failed: $_" -ForegroundColor Red
}

# Test 4: CORS Configuration
Write-Host "`n4️⃣  Testing CORS configuration..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = $frontendUrl
        "Access-Control-Request-Method" = "GET"
    }
    $corsResponse = Invoke-WebRequest -Uri "$apiUrl/listings" -Method Options -Headers $headers -TimeoutSec 10
    
    $allowOrigin = $corsResponse.Headers["Access-Control-Allow-Origin"]
    if ($allowOrigin -eq $frontendUrl -or $allowOrigin -eq "*") {
        Write-Host "✓ CORS properly configured" -ForegroundColor Green
        Write-Host "   Allowed origin: $allowOrigin" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  CORS might have issues" -ForegroundColor Yellow
        Write-Host "   Allowed origin: $allowOrigin" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  CORS check skipped (not critical): $_" -ForegroundColor Yellow
}

# Summary
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Backend API: $apiUrl" -ForegroundColor White
Write-Host "Frontend: $frontendUrl" -ForegroundColor White
Write-Host "`nIf listings still show as 0 on the frontend:" -ForegroundColor Yellow
Write-Host "1. Check browser DevTools > Console for errors" -ForegroundColor White
Write-Host "2. Check browser DevTools > Network > Filter 'listings'" -ForegroundColor White
Write-Host "3. Verify the request goes to: $apiUrl/listings" -ForegroundColor White
Write-Host "4. Clear browser cache and hard refresh (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "`nIf API URL is wrong, rebuild frontend:" -ForegroundColor Yellow
Write-Host "   .\deploy.ps1" -ForegroundColor Cyan
Write-Host ""
