# Generate RSA-2048 JWT key pair for local development on Windows.
# Run from the project root:
#   pwsh scripts/generate_jwt_keys.ps1
# Requires: openssl.exe  (bundled with Git for Windows, or install via winget)

$ErrorActionPreference = "Stop"

$SecretsDir = Join-Path $PSScriptRoot ".." "secrets"
$PrivateKey  = Join-Path $SecretsDir "jwt_private_key.pem"
$PublicKey   = Join-Path $SecretsDir "jwt_public_key.pem"

if (-not (Test-Path $SecretsDir)) {
    New-Item -ItemType Directory -Path $SecretsDir | Out-Null
}

if ((Test-Path $PrivateKey) -and (Test-Path $PublicKey)) {
    Write-Host "[jwt-keygen] Keys already exist — skipping." -ForegroundColor Green
    exit 0
}

Write-Host "[jwt-keygen] Generating RSA-2048 key pair..." -ForegroundColor Cyan

# Try openssl from PATH (Git Bash / Chocolatey / scoop)
$opensslPath = (Get-Command openssl -ErrorAction SilentlyContinue)?.Source
if (-not $opensslPath) {
    # Fallback: Git for Windows ships OpenSSL here
    $gitOpenSSL = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenSSL) {
        $opensslPath = $gitOpenSSL
    } else {
        Write-Error "openssl not found. Install Git for Windows (includes OpenSSL) or run: winget install openssl"
        exit 1
    }
}

& $opensslPath genrsa -out $PrivateKey 2048 2>&1 | Out-Null
& $opensslPath rsa -in $PrivateKey -pubout -out $PublicKey 2>&1 | Out-Null

Write-Host "[jwt-keygen] Done." -ForegroundColor Green
Write-Host "  Private: $PrivateKey"
Write-Host "  Public:  $PublicKey"
