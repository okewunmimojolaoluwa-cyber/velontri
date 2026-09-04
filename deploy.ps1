# Velontri Deployment Script
# Rebuilds frontend with production environment and pushes to Git

Write-Host "Velontri Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Check if we're in the right directory
if (-not (Test-Path "pxxl.toml")) {
    Write-Host "ERROR: pxxl.toml not found. Run this from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found project root" -ForegroundColor Green

# Step 2: Clean frontend build
Write-Host "`n[STEP 1] Cleaning frontend build cache..." -ForegroundColor Yellow
if (Test-Path "frontend\.next") {
    Remove-Item -Recurse -Force "frontend\.next"
    Write-Host "[OK] Removed .next directory" -ForegroundColor Green
} else {
    Write-Host "[OK] .next directory doesn't exist (clean)" -ForegroundColor Green
}

# Step 3: Set production environment variables
Write-Host "`n[STEP 2] Setting production environment..." -ForegroundColor Yellow
$env:NEXT_PUBLIC_API_URL = "https://velontri.onrender.com/api/v1"
$env:NEXT_PUBLIC_SITE_URL = "https://velontri.pxxl.click"
$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID = "99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com"
$env:NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d"

Write-Host "[OK] API URL: $env:NEXT_PUBLIC_API_URL" -ForegroundColor Green
Write-Host "[OK] Site URL: $env:NEXT_PUBLIC_SITE_URL" -ForegroundColor Green

# Step 4: Install dependencies (if needed)
Write-Host "`n[STEP 3] Checking dependencies..." -ForegroundColor Yellow
Push-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
Write-Host "[OK] Dependencies ready" -ForegroundColor Green

# Step 5: Build frontend
Write-Host "`n[STEP 4] Building frontend for production..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "[OK] Build successful" -ForegroundColor Green

Pop-Location

# Step 6: Test locally (optional)
Write-Host "`n[OPTIONAL] Test build locally? (y/n)" -ForegroundColor Yellow
$test = Read-Host
if ($test -eq "y") {
    Write-Host "Starting production server on http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop and continue deployment`n" -ForegroundColor Yellow
    Push-Location frontend
    npm start
    Pop-Location
}

# Step 7: Git commit and push
Write-Host "`n[STEP 5] Preparing Git commit..." -ForegroundColor Yellow
git add .
git status

Write-Host "`nEnter commit message (or press Enter for default):" -ForegroundColor Yellow
$commitMsg = Read-Host
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "deploy: rebuild frontend with production API URL"
}

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: No changes to commit or commit failed" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Committed changes" -ForegroundColor Green
}

Write-Host "`nPush to remote? (y/n)" -ForegroundColor Yellow
$push = Read-Host
if ($push -eq "y") {
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Git push failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Pushed to remote" -ForegroundColor Green
}

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "SUCCESS: Deployment prepared!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Your code is pushed to GitHub" -ForegroundColor White
Write-Host "2. pxxl.click will auto-deploy with production config" -ForegroundColor White
Write-Host "3. Visit https://velontri.pxxl.click to verify" -ForegroundColor White
Write-Host "4. Check DevTools > Network > listings request" -ForegroundColor White
Write-Host "`nBackend API: https://velontri.onrender.com/api/v1" -ForegroundColor Cyan
Write-Host "Frontend: https://velontri.pxxl.click`n" -ForegroundColor Cyan
