#!/usr/bin/env node
/**
 * npm run dev:gateway
 * Start the entire Velontri platform as ONE service on port 8000.
 * All endpoints are available at http://localhost:8000/api/v1/...
 * Swagger UI: http://localhost:8000/docs
 */

const { spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs   = require("fs");

const ROOT = path.resolve(__dirname, "..");

const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const RESET  = "\x1b[0m";

function log(color, tag, msg) {
  console.log(`${color}[${tag}]${RESET} ${msg}`);
}

// ── Load .env file into process.env ───────────────────────────────────────────
function loadDotEnv() {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    // Only set if not already in environment (real env vars take precedence)
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
  log(GREEN, "env", `.env loaded from ${envFile}`);
}

loadDotEnv();

// ── Generate JWT keys if missing ──────────────────────────────────────────────
function generateKeys() {
  const fs = require("fs");
  const priv = path.join(ROOT, "secrets", "jwt_private_key.pem");
  const pub  = path.join(ROOT, "secrets", "jwt_public_key.pem");

  if (fs.existsSync(priv) && fs.existsSync(pub)) {
    log(GREEN, "jwt", "Key pair found.");
    return;
  }

  log(YELLOW, "jwt", "Generating RSA-2048 key pair...");
  fs.mkdirSync(path.join(ROOT, "secrets"), { recursive: true });

  const candidates = [
    "openssl",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
  ];
  const openssl = candidates.find(
    (c) => spawnSync(c, ["version"], { stdio: "pipe" }).status === 0
  );

  if (!openssl) {
    log(RED, "jwt", "openssl not found. Install Git for Windows.");
    process.exit(1);
  }

  spawnSync(openssl, ["genrsa", "-out", priv, "2048"], { stdio: "inherit" });
  spawnSync(openssl, ["rsa", "-in", priv, "-pubout", "-out", pub], { stdio: "inherit" });
  log(GREEN, "jwt", "Key pair generated.");
}

const net = require("net");

// ── Port helpers ──────────────────────────────────────────────────────────────
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

// ── Wait for gateway to open ──────────────────────────────────────────────────
function waitForPort(port, timeout = 900000) {  // 15 minute timeout — 14 services take time to import
  return new Promise((resolve) => {
    const start = Date.now();
    let lastPrint = 0;
    function check() {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          // Accept any 200 from /health — gateway is ready
          if (res.statusCode === 200) {
            return resolve(true);
          }
          retry();
        });
      });
      req.on("error", retry);
      req.setTimeout(3000, retry);
    }
    function retry() {
      const elapsed = Date.now() - start;
      if (elapsed > timeout) return resolve(false);
      // Print a progress dot every 10s so user knows it's still working
      if (elapsed - lastPrint > 10000) {
        lastPrint = elapsed;
        const secs = Math.floor(elapsed / 1000);
        log(YELLOW, "wait", `Still starting... (${secs}s elapsed, importing all 14 service modules)`);
      }
      setTimeout(check, 1000);
    }
    check();
  });
}

// ── Open browser ───────────────────────────────────────────────────────────────
function openBrowser(url) {
  const { spawn } = require("child_process");
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${CYAN}╔══════════════════════════════════════════════════╗
║   Velontri Gateway — Single Port Mode (8000)   ║
╚══════════════════════════════════════════════════╝${RESET}\n`);

  generateKeys();

  const PORT = 8000;
  const portFree = await isPortFree(PORT);
  if (!portFree) {
    log(RED, "port", `Port ${PORT} is already in use.`);
    log(YELLOW, "port", `Free it with: netstat -ano | findstr :${PORT}`);
    log(YELLOW, "port", `Then kill the PID: taskkill /PID <pid> /F`);
    process.exit(1);
  }

  log(CYAN, "start", `Starting gateway on http://localhost:${PORT} ...`);

  const { spawn } = require("child_process");

  const proc = spawn(
    "python",
    [
      "-c",
      `
import sys, os
root = r"${ROOT.replace(/\\/g, "/")}";
sys.path.insert(0, root)
sys.path.insert(0, root + "/scripts")
from native_stubs import apply_patches
apply_patches("gateway")
import uvicorn
uvicorn.run("gateway.main:app", host="0.0.0.0", port=8000, log_level="info", reload=False)
`,
    ],
    {
      cwd: ROOT,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      stdio: ["ignore", "inherit", "inherit"],
    }
  );

  proc.on("exit", (code) => {
    log(code === 0 ? GREEN : RED, "exit", `Gateway exited with code ${code}`);
    process.exit(code || 0);
  });

  log(CYAN, "wait", "Waiting for gateway to become ready...");
  const ready = await waitForPort(8000);

  if (!ready) {
    log(RED, "fail", "Gateway did not start within 15 minutes. Check output above.");
    process.exit(1);
  }

  console.log(`
${GREEN}╔══════════════════════════════════════════════════════════════╗
║           Velontri is running on port 8000 🚀              ║
╚══════════════════════════════════════════════════════════════╝${RESET}

${GREEN}Single base URL for ALL services:${RESET}
  http://localhost:8000/api/v1

${GREEN}Swagger UI (all endpoints in one place):${RESET}
  http://localhost:8000/docs

${GREEN}Key endpoints:${RESET}
  POST http://localhost:8000/api/v1/auth/register
  POST http://localhost:8000/api/v1/auth/login
  GET  http://localhost:8000/api/v1/listings
  GET  http://localhost:8000/api/v1/search?q=...
  GET  http://localhost:8000/api/v1/wallet/balance
  POST http://localhost:8000/api/v1/payments/initiate
  GET  http://localhost:8000/api/v1/subscriptions/tiers

${YELLOW}Health:${RESET}  http://localhost:8000/health
${YELLOW}Metrics:${RESET} http://localhost:8000/metrics
${YELLOW}Stop:${RESET}    Ctrl+C
`);

  // Open Swagger UI
  openBrowser("http://localhost:8000/docs");

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    log(YELLOW, "stop", "Stopping gateway...");
    proc.kill("SIGTERM");
    process.exit(0);
  });
})();
