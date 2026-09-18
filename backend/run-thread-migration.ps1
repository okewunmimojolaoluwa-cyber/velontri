# PowerShell script to run thread consolidation migration on Windows
# Usage: .\run-thread-migration.ps1

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "THREAD CONSOLIDATION MIGRATION - Windows PowerShell" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Set DATABASE_URL from .env file
$DATABASE_URL = "postgresql+asyncpg://postgres.nppxqvgetyetnsiphehm:Okewunmi123@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

Write-Host "Database: Supabase Production (postgres.nppxqvgetyetnsiphehm)" -ForegroundColor Yellow
Write-Host ""

# Confirm before proceeding
Write-Host "This script will:" -ForegroundColor White
Write-Host "  1. Find all duplicate threads (same users, different listings)" -ForegroundColor White
Write-Host "  2. Keep the oldest thread for each user pair" -ForegroundColor White
Write-Host "  3. Migrate all messages to the kept thread" -ForegroundColor White
Write-Host "  4. Delete duplicate threads" -ForegroundColor White
Write-Host "  5. Update database constraint to prevent future duplicates" -ForegroundColor White
Write-Host ""
Write-Host "WARNING: This will modify your production database!" -ForegroundColor Red
Write-Host "Make sure you have a backup before proceeding." -ForegroundColor Red
Write-Host ""

$confirmation = Read-Host "Type 'YES' to continue or 'NO' to cancel"

if ($confirmation -ne "YES") {
    Write-Host ""
    Write-Host "Migration cancelled by user." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "Starting migration..." -ForegroundColor Green
Write-Host ""

# Set environment variable and run Python script
$env:DATABASE_URL = $DATABASE_URL
python scripts/consolidate_duplicate_threads.py

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Migration script completed!" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify the output above for success messages" -ForegroundColor White
Write-Host "  2. Test messaging feature in production" -ForegroundColor White
Write-Host "  3. Verify users have ONE conversation per contact" -ForegroundColor White
Write-Host ""
