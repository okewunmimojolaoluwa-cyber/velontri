#!/usr/bin/env node
/**
 * npm run keygen — Generate RSA-2048 JWT key pair
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SECRETS = path.join(ROOT, "secrets");
const PRIVATE_KEY = path.join(SECRETS, "jwt_private_key.pem");
const PUBLIC_KEY = path.join(SECRETS, "jwt_public_key.pem");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

if (fs.existsSync(PRIVATE_KEY) && fs.existsSync(PUBLIC_KEY)) {
  console.log(`${GREEN}[keygen]${RESET} JWT keys already exist in secrets/ — skipping.`);
  console.log(`  Private: ${PRIVATE_KEY}`);
  console.log(`  Public:  ${PUBLIC_KEY}`);
  process.exit(0);
}

if (!fs.existsSync(SECRETS)) {
  fs.mkdirSync(SECRETS, { recursive: true });
}

const candidates = [
  "openssl",
  "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
  "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
];

let opensslBin = null;
for (const c of candidates) {
  if (spawnSync(c, ["version"], { stdio: "pipe" }).status === 0) {
    opensslBin = c;
    break;
  }
}

if (!opensslBin) {
  console.error(`${RED}[keygen]${RESET} openssl not found.`);
  console.error(`  Install Git for Windows (includes openssl): https://git-scm.com`);
  console.error(`  Or: winget install openssl`);
  process.exit(1);
}

console.log(`${YELLOW}[keygen]${RESET} Generating RSA-2048 key pair...`);

spawnSync(opensslBin, ["genrsa", "-out", PRIVATE_KEY, "2048"], { stdio: "inherit" });
spawnSync(opensslBin, ["rsa", "-in", PRIVATE_KEY, "-pubout", "-out", PUBLIC_KEY], { stdio: "inherit" });

console.log(`${GREEN}[keygen]${RESET} Done.`);
console.log(`  Private: ${PRIVATE_KEY}`);
console.log(`  Public:  ${PUBLIC_KEY}`);
