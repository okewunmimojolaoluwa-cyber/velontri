# ============================================================================
# Velontri Followers/Following Migration Runner
# ============================================================================
# This script helps you run the SQL migration for the user_follows table
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Velontri Followers/Following System - Migration" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
$envFile = "backend\.env"
if (-Not (Test-Path $envFile)) {
    Write-Host "ERROR: backend\.env file not found!" -ForegroundColor Red
    Write-Host "Please make sure you're running this from the project root." -ForegroundColor Yellow
    exit 1
}

# Read DATABASE_URL from .env
$databaseUrl = Get-Content $envFile | Where-Object { $_ -match "^DATABASE_URL=" } | ForEach-Object { $_.Split('=', 2)[1] }

if (-Not $databaseUrl) {
    Write-Host "ERROR: DATABASE_URL not found in backend\.env" -ForegroundColor Red
    exit 1
}

Write-Host "Database URL found (first 50 chars): $($databaseUrl.Substring(0, [Math]::Min(50, $databaseUrl.Length)))..." -ForegroundColor Green
Write-Host ""

# Check if psql is available
$psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue

if ($psqlAvailable) {
    Write-Host "OPTION 1: Run migration using psql (PostgreSQL client)" -ForegroundColor Yellow
    Write-Host "Command:" -ForegroundColor White
    Write-Host "  psql `"$databaseUrl`" -f user_follows_migration.sql" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Would you like to run this now? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host ""
        Write-Host "Running migration..." -ForegroundColor Cyan
        psql "$databaseUrl" -f user_follows_migration.sql
        Write-Host ""
        Write-Host "Migration completed!" -ForegroundColor Green
        exit 0
    }
} else {
    Write-Host "psql command not found on your system." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "OPTION 2: Run migration on Render (production database)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "  1. Go to https://dashboard.render.com" -ForegroundColor Gray
Write-Host "  2. Click on your PostgreSQL database service" -ForegroundColor Gray
Write-Host "  3. Go to 'Shell' tab" -ForegroundColor Gray
Write-Host "  4. Copy and paste the contents of 'user_follows_migration.sql'" -ForegroundColor Gray
Write-Host "  5. Press Enter to execute" -ForegroundColor Gray
Write-Host ""

Write-Host "OPTION 3: Use pgAdmin or another PostgreSQL client" -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "  1. Connect to your database using your preferred client" -ForegroundColor Gray
Write-Host "  2. Open 'user_follows_migration.sql'" -ForegroundColor Gray
Write-Host "  3. Execute the SQL script" -ForegroundColor Gray
Write-Host ""

Write-Host "OPTION 4: Run via Python (if dependencies are installed)" -ForegroundColor Yellow
Write-Host ""
Write-Host "First, install dependencies:" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  pip install -r requirements.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "Then run:" -ForegroundColor White
Write-Host "  cd .." -ForegroundColor Gray
Write-Host "  python run_migration.py" -ForegroundColor Gray
Write-Host ""

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Migration file: user_follows_migration.sql" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Open the SQL file in the default editor
$response = Read-Host "Would you like to open the SQL file now? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Start-Process "user_follows_migration.sql"
}
