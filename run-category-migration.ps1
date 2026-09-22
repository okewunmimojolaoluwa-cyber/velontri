# ==============================================================================
# Velontri Category System - Migration Runner (Windows)
# ==============================================================================
# 
# This script automates the category system migration process on Windows.
# 
# Prerequisites:
# - Python 3.11+ installed
# - PostgreSQL client (psql) installed OR Python database access configured
# - Backend virtual environment activated (if using venv)
# 
# Usage:
#   .\run-category-migration.ps1 [step]
#  
# Steps:
#   all      - Run all migration steps (default)
#   sql      - Step 1: Run SQL migration only
#   seed     - Step 2: Seed categories only
#   migrate  - Step 3: Migrate existing listings only
#   verify   - Step 4: Verify migration only
# 
# ==============================================================================

param(
    [string]$Step = "all",
    [switch]$DryRun = $false,
    [switch]$Help = $false
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Step { Write-Host "`n=====================================================================" -ForegroundColor Magenta; Write-Host $args -ForegroundColor Magenta; Write-Host "=====================================================================" -ForegroundColor Magenta }

# Show help
if ($Help) {
    Write-Info @"

Velontri Category System - Migration Runner

USAGE:
    .\run-category-migration.ps1 [step] [-DryRun] [-Help]

STEPS:
    all      Run all migration steps (default)
    sql      Step 1: Run SQL migration only
    seed     Step 2: Seed categories only  
    migrate  Step 3: Migrate existing listings only
    verify   Step 4: Verify migration only

OPTIONS:
    -DryRun  Run listing migration in dry-run mode (no changes)
    -Help    Show this help message

EXAMPLES:
    .\run-category-migration.ps1
    .\run-category-migration.ps1 all
    .\run-category-migration.ps1 migrate -DryRun
    .\run-category-migration.ps1 verify

"@
    exit 0
}

# Check if we're in the correct directory
if (-not (Test-Path "backend/migrations/001_category_system.sql")) {
    Write-Error "Error: backend/migrations/001_category_system.sql not found!"
    Write-Error "Please run this script from the Velontri root directory."
    exit 1
}

# ==============================================================================
# STEP 1: SQL Migration
# ==============================================================================

function Run-SQLMigration {
    Write-Step "STEP 1: Running SQL Migration"
    
    $sqlFile = "backend/migrations/001_category_system.sql"
    
    if (-not (Test-Path $sqlFile)) {
        Write-Error "SQL migration file not found: $sqlFile"
        return $false
    }
    
    Write-Info "This will create the categories and category_attributes tables."
    Write-Warning "Make sure you have a database backup before proceeding!"
    
    $confirm = Read-Host "`nProceed with SQL migration? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Warning "SQL migration cancelled."
        return $false
    }
    
    # Check if psql is available
    $psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue
    
    if ($psqlAvailable) {
        Write-Info "`nUsing PostgreSQL psql client..."
        Write-Info "Please enter your database connection details:"
        
        $dbHost = Read-Host "Database host (default: localhost)"
        if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }
        
        $dbPort = Read-Host "Database port (default: 5432)"
        if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }
        
        $dbName = Read-Host "Database name (default: velontri_db)"
        if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "velontri_db" }
        
        $dbUser = Read-Host "Database user (default: postgres)"
        if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }
        
        Write-Info "`nRunning migration..."
        $env:PGPASSWORD = Read-Host "Database password" -AsSecureString | ConvertFrom-SecureString -AsPlainText
        
        & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ SQL migration completed successfully!"
            return $true
        } else {
            Write-Error "❌ SQL migration failed. Check the output above for errors."
            return $false
        }
    } else {
        Write-Info "`npsql not found. Using Python script..."
        Write-Info "Make sure backend/.env has correct DATABASE_URL configured."
        
        # Check if Python script exists
        if (Test-Path "run_migration.py") {
            python run_migration.py $sqlFile
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✅ SQL migration completed successfully!"
                return $true
            } else {
                Write-Error "❌ SQL migration failed."
                return $false
            }
        } else {
            Write-Warning "Please run the SQL migration manually:"
            Write-Info "psql -U your_user -d velontri_db -f $sqlFile"
            return $false
        }
    }
}

# ==============================================================================
# STEP 2: Seed Categories
# ==============================================================================

function Run-SeedCategories {
    Write-Step "STEP 2: Seeding Categories & Attributes"
    
    $seedScript = "backend/scripts/seed_categories.py"
    
    if (-not (Test-Path $seedScript)) {
        Write-Error "Seed script not found: $seedScript"
        return $false
    }
    
    Write-Info "This will seed 150+ subcategories and 50+ attributes."
    
    Push-Location backend
    Write-Info "`nRunning seed script..."
    python scripts/seed_categories.py
    $exitCode = $LASTEXITCODE
    Pop-Location
    
    if ($exitCode -eq 0) {
        Write-Success "✅ Category seeding completed successfully!"
        return $true
    } else {
        Write-Error "❌ Category seeding failed."
        return $false
    }
}

# ==============================================================================
# STEP 3: Migrate Existing Listings
# ==============================================================================

function Run-MigrateListings {
    Write-Step "STEP 3: Migrating Existing Listings"
    
    $migrateScript = "backend/scripts/migrate_existing_listings.py"
    
    if (-not (Test-Path $migrateScript)) {
        Write-Error "Migration script not found: $migrateScript"
        return $false
    }
    
    Write-Info "This will map existing listings to the new category system."
    
    if ($DryRun) {
        Write-Warning "`nDRY RUN MODE - No changes will be made`n"
        Push-Location backend
        # Auto-respond with "dry-run"
        "dry-run" | python scripts/migrate_existing_listings.py
        $exitCode = $LASTEXITCODE
        Pop-Location
    } else {
        Write-Warning "`nLIVE MODE - Listings will be updated in database"
        Write-Warning "Run with -DryRun first to preview changes!`n"
        
        Push-Location backend
        python scripts/migrate_existing_listings.py
        $exitCode = $LASTEXITCODE
        Pop-Location
    }
    
    if ($exitCode -eq 0) {
        Write-Success "✅ Listing migration completed successfully!"
        return $true
    } else {
        Write-Error "❌ Listing migration failed."
        return $false
    }
}

# ==============================================================================
# STEP 4: Verify Migration
# ==============================================================================

function Run-Verification {
    Write-Step "STEP 4: Verifying Migration"
    
    Write-Info "Running verification queries..."
    
    # For now, just show what to check
    Write-Info @"

Please verify the migration by running these SQL queries:

-- Count categories by level
SELECT level, COUNT(*) FROM categories GROUP BY level ORDER BY level;

-- Count attributes
SELECT COUNT(*) FROM category_attributes;

-- Check listing migration status  
SELECT 
    COUNT(*) as total,
    COUNT(category_id) as with_category,
    COUNT(subcategory_id) as with_subcategory
FROM listings;

-- View sample migrated listings
SELECT id, title, category, category_id, subcategory, subcategory_id
FROM listings
WHERE category_id IS NOT NULL
LIMIT 10;

"@
    
    Write-Success "✅ Verification queries displayed above."
    return $true
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

Write-Info @"

╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   Velontri Category System - Migration Runner                    ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

"@

$success = $true

switch ($Step.ToLower()) {
    "sql" {
        $success = Run-SQLMigration
    }
    "seed" {
        $success = Run-SeedCategories
    }
    "migrate" {
        $success = Run-MigrateListings
    }
    "verify" {
        $success = Run-Verification
    }
    "all" {
        Write-Info "Running all migration steps...`n"
        
        # Step 1: SQL Migration
        if (-not (Run-SQLMigration)) {
            Write-Error "`nMigration stopped at Step 1 (SQL Migration)"
            exit 1
        }
        
        # Step 2: Seed Categories
        if (-not (Run-SeedCategories)) {
            Write-Error "`nMigration stopped at Step 2 (Seed Categories)"
            exit 1
        }
        
        # Step 3: Migrate Listings
        if (-not (Run-MigrateListings)) {
            Write-Error "`nMigration stopped at Step 3 (Migrate Listings)"
            exit 1
        }
        
        # Step 4: Verify
        Run-Verification
        
        $success = $true
    }
    default {
        Write-Error "Unknown step: $Step"
        Write-Info "Valid steps: all, sql, seed, migrate, verify"
        Write-Info "Use -Help for more information"
        exit 1
    }
}

# ==============================================================================
# COMPLETION
# ==============================================================================

Write-Info "`n"
Write-Info "═══════════════════════════════════════════════════════════════════"

if ($success) {
    Write-Success "`n✅ MIGRATION COMPLETE!`n"
    
    Write-Info "Next Steps:"
    Write-Info "  1. Review CATEGORY_SYSTEM_PHASE1_COMPLETE.md for full documentation"
    Write-Info "  2. Verify database changes using verification queries"
    Write-Info "  3. Proceed to Phase 2: Backend API implementation"
    Write-Info ""
} else {
    Write-Error "`n❌ Migration encountered errors. Please review the output above.`n"
    exit 1
}

Write-Info "═══════════════════════════════════════════════════════════════════`n"
