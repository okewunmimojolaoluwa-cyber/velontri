# ============================================================================
# Velontri Category System Migration - Windows PowerShell Script
# ============================================================================
#
# This script runs all three steps of the category system migration:
#   1. Database migration (001_category_system.sql)
#   2. Category and attribute seeding (seed_categories.py)
#   3. Existing listing migration (migrate_existing_listings.py)
#
# Usage:
#   .\run_category_migration.ps1
#   .\run_category_migration.ps1 -DryRun      # Test mode, no changes
#   .\run_category_migration.ps1 -StepOnly 1  # Run only step 1
#
# ============================================================================

param(
    [switch]$DryRun = $false,
    [int]$StepOnly = 0  # 0 = all steps, 1-3 = specific step only
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header { param($msg) Write-Host "`n========================================" -ForegroundColor Cyan; Write-Host $msg -ForegroundColor Cyan; Write-Host "========================================`n" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error-Msg { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Warning-Msg { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Blue }

# ============================================================================
# CONFIGURATION
# ============================================================================

$PROJECT_ROOT = $PSScriptRoot
$BACKEND_DIR = Join-Path $PROJECT_ROOT "backend"
$MIGRATIONS_DIR = Join-Path $BACKEND_DIR "migrations"
$SCRIPTS_DIR = Join-Path $BACKEND_DIR "scripts"

$MIGRATION_FILE = Join-Path $MIGRATIONS_DIR "001_category_system.sql"
$SEED_SCRIPT = Join-Path $SCRIPTS_DIR "seed_categories.py"
$MIGRATE_SCRIPT = Join-Path $SCRIPTS_DIR "migrate_existing_listings.py"

# Load environment variables
$ENV_FILE = Join-Path $BACKEND_DIR ".env"
if (Test-Path $ENV_FILE) {
    Get-Content $ENV_FILE | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $key = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Success "Loaded environment from $ENV_FILE"
} else {
    Write-Warning-Msg ".env file not found at $ENV_FILE"
}

$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Error-Msg "DATABASE_URL not found in environment variables"
    Write-Info "Please set DATABASE_URL in backend\.env file"
    exit 1
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check Python
    try {
        $pythonVersion = python --version 2>&1
        Write-Success "Python found: $pythonVersion"
    } catch {
        Write-Error-Msg "Python not found. Please install Python 3.8+"
        exit 1
    }
    
    # Check psql (PostgreSQL client)
    try {
        $psqlVersion = psql --version 2>&1
        Write-Success "PostgreSQL client found: $psqlVersion"
    } catch {
        Write-Warning-Msg "psql not found. Will use Python for database operations."
        return $false
    }
    
    # Check files exist
    if (-not (Test-Path $MIGRATION_FILE)) {
        Write-Error-Msg "Migration file not found: $MIGRATION_FILE"
        exit 1
    }
    
    if (-not (Test-Path $SEED_SCRIPT)) {
        Write-Error-Msg "Seed script not found: $SEED_SCRIPT"
        exit 1
    }
    
    if (-not (Test-Path $MIGRATE_SCRIPT)) {
        Write-Error-Msg "Migration script not found: $MIGRATE_SCRIPT"
        exit 1
    }
    
    Write-Success "All prerequisite checks passed"
    return $true
}

function Invoke-Step1-DatabaseMigration {
    Write-Header "STEP 1: Running Database Migration"
    Write-Info "File: $MIGRATION_FILE"
    
    if ($DryRun) {
        Write-Warning-Msg "DRY RUN MODE - Would execute migration but skipping"
        return $true
    }
    
    try {
        # Try psql first
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            Write-Info "Using psql to run migration..."
            $env:PGPASSWORD = ""  # Password should be in DATABASE_URL
            psql $DATABASE_URL -f $MIGRATION_FILE
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Database migration completed successfully"
                return $true
            } else {
                throw "psql returned exit code $LASTEXITCODE"
            }
        } else {
            # Fallback to Python
            Write-Info "Using Python to run migration..."
            $migrationContent = Get-Content $MIGRATION_FILE -Raw
            
            $pythonScript = @"
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path('$BACKEND_DIR')))
from sqlalchemy import text
from shared.database import get_db_session

async def run_migration():
    async with get_db_session() as session:
        migration_sql = '''$migrationContent'''
        await session.execute(text(migration_sql))
        await session.commit()
        print('Migration completed successfully')

asyncio.run(run_migration())
"@
            
            $pythonScript | python
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Database migration completed successfully"
                return $true
            } else {
                throw "Python migration failed with exit code $LASTEXITCODE"
            }
        }
    } catch {
        Write-Error-Msg "Migration failed: $_"
        Write-Info "Check database logs for details"
        return $false
    }
}

function Invoke-Step2-SeedCategories {
    Write-Header "STEP 2: Seeding Categories and Attributes"
    Write-Info "Script: $SEED_SCRIPT"
    
    if ($DryRun) {
        Write-Warning-Msg "DRY RUN MODE - Would seed categories but skipping"
        return $true
    }
    
    try {
        Set-Location $PROJECT_ROOT
        python $SEED_SCRIPT
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Category seeding completed successfully"
            return $true
        } else {
            throw "Seed script returned exit code $LASTEXITCODE"
        }
    } catch {
        Write-Error-Msg "Category seeding failed: $_"
        return $false
    }
}

function Invoke-Step3-MigrateListings {
    Write-Header "STEP 3: Migrating Existing Listings"
    Write-Info "Script: $MIGRATE_SCRIPT"
    
    if ($DryRun) {
        Write-Info "Running migration in DRY RUN mode..."
        
        # Run migration script in dry-run mode
        $process = Start-Process -FilePath "python" -ArgumentList $MIGRATE_SCRIPT -NoNewWindow -PassThru -Wait
        
        # Simulate dry-run input
        Start-Sleep -Seconds 1
        # Note: Automated input for dry-run is complex in PowerShell
        # User will need to type "dry-run" when prompted
        
        Write-Info "Review the dry-run output above"
        return $true
    }
    
    Write-Warning-Msg "This will modify existing listings. Continue? (yes/no)"
    $confirmation = Read-Host
    
    if ($confirmation -ne "yes") {
        Write-Warning-Msg "Listing migration skipped by user"
        return $false
    }
    
    try {
        Set-Location $PROJECT_ROOT
        
        # Run the migration script
        # User will be prompted to confirm again in the script
        python $MIGRATE_SCRIPT
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Listing migration completed successfully"
            return $true
        } else {
            throw "Migration script returned exit code $LASTEXITCODE"
        }
    } catch {
        Write-Error-Msg "Listing migration failed: $_"
        return $false
    }
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Write-Header "Velontri Category System Migration"
    
    if ($DryRun) {
        Write-Warning-Msg "🔍 DRY RUN MODE - No changes will be committed"
    } else {
        Write-Info "🚀 LIVE MODE - Changes will be applied to database"
    }
    
    Write-Info "Database: $($DATABASE_URL -replace ':[^:@]+@', ':****@')"  # Hide password
    
    # Check prerequisites
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    Write-Host ""
    Write-Info "Starting migration process..."
    Write-Host ""
    
    $allSuccess = $true
    
    # Step 1: Database Migration
    if ($StepOnly -eq 0 -or $StepOnly -eq 1) {
        if (-not (Invoke-Step1-DatabaseMigration)) {
            $allSuccess = $false
            Write-Error-Msg "Step 1 failed. Aborting."
            exit 1
        }
    }
    
    # Step 2: Seed Categories
    if ($StepOnly -eq 0 -or $StepOnly -eq 2) {
        if (-not (Invoke-Step2-SeedCategories)) {
            $allSuccess = $false
            Write-Error-Msg "Step 2 failed. Aborting."
            exit 1
        }
    }
    
    # Step 3: Migrate Listings
    if ($StepOnly -eq 0 -or $StepOnly -eq 3) {
        if (-not (Invoke-Step3-MigrateListings)) {
            $allSuccess = $false
            Write-Warning-Msg "Step 3 failed or was skipped."
            # Don't exit - listing migration is optional
        }
    }
    
    # Summary
    Write-Header "Migration Summary"
    
    if ($allSuccess) {
        Write-Success "✅ All migration steps completed successfully!"
        Write-Host ""
        Write-Info "Next steps:"
        Write-Host "  1. Verify categories in database"
        Write-Host "  2. Check listing migration results"
        Write-Host "  3. Proceed with Phase 2 (Backend API)"
        Write-Host ""
    } else {
        Write-Warning-Msg "⚠️  Some steps failed or were skipped"
        Write-Host ""
        Write-Info "Review the output above for details"
        Write-Host ""
    }
}

# Run main function
try {
    Main
} catch {
    Write-Error-Msg "Unexpected error: $_"
    exit 1
} finally {
    Set-Location $PROJECT_ROOT
}
