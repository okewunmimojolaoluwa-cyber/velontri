#!/usr/bin/env bash
# Generate RSA-2048 JWT key pair for local development.
# Run from the project root:
#   bash scripts/generate_jwt_keys.sh
# Requires: openssl (comes with Git Bash, WSL, or macOS/Linux)

set -euo pipefail

SECRETS_DIR="$(dirname "$0")/../secrets"
PRIVATE_KEY="$SECRETS_DIR/jwt_private_key.pem"
PUBLIC_KEY="$SECRETS_DIR/jwt_public_key.pem"

mkdir -p "$SECRETS_DIR"

if [ -f "$PRIVATE_KEY" ] && [ -f "$PUBLIC_KEY" ]; then
  echo "[jwt-keygen] Keys already exist — skipping generation."
  echo "  Private: $PRIVATE_KEY"
  echo "  Public:  $PUBLIC_KEY"
  exit 0
fi

echo "[jwt-keygen] Generating RSA-2048 key pair..."

# Generate private key (PKCS#1 PEM, traditional OpenSSL format)
openssl genrsa -out "$PRIVATE_KEY" 2048 2>/dev/null

# Extract public key
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY" 2>/dev/null

chmod 600 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

echo "[jwt-keygen] Done."
echo "  Private: $PRIVATE_KEY"
echo "  Public:  $PUBLIC_KEY"
