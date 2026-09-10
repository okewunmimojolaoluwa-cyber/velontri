# Quick script to check if users exist in database

Write-Host "=" -ForegroundColor Cyan
Write-Host "🔍 CHECKING USER DATA IN DATABASE" -ForegroundColor Cyan  
Write-Host "=" -ForegroundColor Cyan

# Load environment variables
if (Test-Path "backend\.env") {
    Write-Host "`n📝 Loading environment from backend\.env..."
    Get-Content "backend\.env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Check if DATABASE_URL exists
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "❌ DATABASE_URL not found!" -ForegroundColor Red
    Write-Host "`nPlease set it in backend\.env or run:" -ForegroundColor Yellow
    Write-Host '$env:DATABASE_URL="your_database_url"' -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Database URL found" -ForegroundColor Green

# Run the test script
Write-Host "`n🚀 Running diagnostic test...`n" -ForegroundColor Cyan

python test_seller_search.py

Write-Host "`n✅ Diagnostic complete!" -ForegroundColor Green
