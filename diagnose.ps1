# Diagnostic Script - Check why listings aren't showing

Write-Host "`n=== VELONTRI DIAGNOSTIC REPORT ===" -ForegroundColor Cyan
Write-Host "Generated: $(Get-Date)`n" -ForegroundColor Gray

# Test 1: Backend API
Write-Host "[1/5] Testing Backend API..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://velontri.onrender.com/api/v1/listings?page=1&page_size=12" -Method Get -TimeoutSec 30
    $count = if ($response.data) { $response.data.Count } else { 0 }
    $total = if ($response.meta) { $response.meta.total } else { 0 }
    
    if ($total -gt 0) {
        Write-Host "  [OK] Backend returns $total listings" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Backend returns 0 listings" -ForegroundColor Red
        Write-Host "  Issue: No listings in database" -ForegroundColor Red
    }
} catch {
    Write-Host "  [FAIL] Cannot reach backend API" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Test 2: Frontend Accessibility
Write-Host "`n[2/5] Testing Frontend..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "https://velontri.pxxl.click" -Method Get -TimeoutSec 30 -UseBasicParsing
    Write-Host "  [OK] Frontend is accessible (HTTP $($frontendResponse.StatusCode))" -ForegroundColor Green
    
    # Check if it contains the API URL
    $content = $frontendResponse.Content
    if ($content -match "velontri\.onrender\.com") {
        Write-Host "  [OK] Production API URL found in page" -ForegroundColor Green
    } elseif ($content -match "localhost:8000") {
        Write-Host "  [FAIL] Still using localhost API URL" -ForegroundColor Red
        Write-Host "  Issue: Frontend not rebuilt with production config" -ForegroundColor Red
    } else {
        Write-Host "  [WARNING] Cannot determine API URL from page source" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] Cannot reach frontend" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Test 3: Check pxxl.toml
Write-Host "`n[3/5] Checking pxxl.toml configuration..." -ForegroundColor Yellow
if (Test-Path "pxxl.toml") {
    $tomlContent = Get-Content "pxxl.toml" -Raw
    if ($tomlContent -match "NEXT_PUBLIC_API_URL.*velontri\.onrender\.com") {
        Write-Host "  [OK] pxxl.toml has correct API URL" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] pxxl.toml missing or incorrect API URL" -ForegroundColor Red
    }
    
    if ($tomlContent -match "\[env\]") {
        Write-Host "  [OK] pxxl.toml has [env] section" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] pxxl.toml missing [env] section" -ForegroundColor Red
    }
} else {
    Write-Host "  [FAIL] pxxl.toml not found" -ForegroundColor Red
}

# Test 4: Check if .next exists (locally)
Write-Host "`n[4/5] Checking local build..." -ForegroundColor Yellow
if (Test-Path "frontend\.next") {
    Write-Host "  [INFO] .next directory exists locally" -ForegroundColor Cyan
    Write-Host "  Note: This is your LOCAL build, not what's deployed" -ForegroundColor Gray
} else {
    Write-Host "  [INFO] No local .next directory" -ForegroundColor Cyan
}

# Test 5: Check Git status
Write-Host "`n[5/5] Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>&1
if ($LASTEXITCODE -eq 0) {
    if ([string]::IsNullOrWhiteSpace($gitStatus)) {
        Write-Host "  [OK] All changes committed" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Uncommitted changes present" -ForegroundColor Yellow
        Write-Host $gitStatus -ForegroundColor Gray
    }
    
    $lastCommit = git log -1 --oneline 2>&1
    Write-Host "  Last commit: $lastCommit" -ForegroundColor Cyan
} else {
    Write-Host "  [WARNING] Not a git repository or git not available" -ForegroundColor Yellow
}

# Summary and Recommendations
Write-Host "`n=== DIAGNOSIS SUMMARY ===" -ForegroundColor Cyan

Write-Host "`nMost likely issues:" -ForegroundColor Yellow
Write-Host "1. pxxl.click hasn't rebuilt with new config yet (wait 5-10 min)" -ForegroundColor White
Write-Host "2. pxxl.click isn't reading pxxl.toml [env] section" -ForegroundColor White
Write-Host "3. Browser cache showing old version (try Ctrl+Shift+R)" -ForegroundColor White
Write-Host "4. Environment variables set in pxxl dashboard override pxxl.toml" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Check pxxl.click dashboard for recent deployment" -ForegroundColor White
Write-Host "2. Look at pxxl build logs for any errors" -ForegroundColor White
Write-Host "3. Try hard refresh: Ctrl+Shift+R on the website" -ForegroundColor White
Write-Host "4. Check browser DevTools > Network > listings request URL" -ForegroundColor White

Write-Host "`nManual checks needed:" -ForegroundColor Yellow
Write-Host "- Open https://velontri.pxxl.click in browser" -ForegroundColor White
Write-Host "- Press F12 to open DevTools" -ForegroundColor White
Write-Host "- Go to Console tab - check for errors" -ForegroundColor White
Write-Host "- Go to Network tab - filter 'listings'" -ForegroundColor White
Write-Host "- Refresh page and check what URL the request goes to" -ForegroundColor White
Write-Host "- Should be: velontri.onrender.com/api/v1/listings" -ForegroundColor White
Write-Host "- If it's localhost, pxxl hasn't rebuilt yet" -ForegroundColor White

Write-Host "`n=== END OF REPORT ===`n" -ForegroundColor Cyan
