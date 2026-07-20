#!/usr/bin/env node
/**
 * npm run dev — Velontri local development startup
 *
 * 1. Checks Docker is running
 * 2. Generates JWT keys if missing
 * 3. Runs docker compose up --build
 * 4. Polls health endpoints until all 14 services are ready
 * 5. Prints the service URL table
 */

const { execSync, spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const SECRETS = path.join(ROOT, "secrets");
const PRIVATE_KEY = path.join(SECRETS, "jwt_private_key.pem");
const PUBLIC_KEY = path.join(SECRETS, "jwt_public_key.pem");

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const SERVICES = [
  { name: "auth-service",         port: 8001 },
  { name: "user-service",         port: 8002 },
  { name: "marketplace-service",  port: 8003 },
  { name: "search-service",       port: 8004 },
  { name: "ai-service",           port: 8005 },
  { name: "chat-service",         port: 8006 },
  { name: "payment-service",      port: 8007 },
  { name: "wallet-service",       port: 8008 },
  { name: "inventory-service",    port: 8009 },
  { name: "logistics-service",    port: 8010 },
  { name: "analytics-service",    port: 8011 },
  { name: "notification-service", port: 8012 },
  { name: "crm-service",          port: 8013 },
  { name: "subscription-service", port: 8014 },
];

function log(color, tag, msg) {
  console.log(`${color}[${tag}]${RESET} ${msg}`);
}

// ── Step 1: Check Docker or fall back to native mode ─────────────────────────

function checkDocker() {
  log(CYAN, "docker", "Checking Docker...");
  const result = spawnSync("docker", ["info"], { stdio: "pipe" });
  if (result.status !== 0) {
    log(YELLOW, "docker", "Docker is not available — switching to native mode.");
    return false;
  }
  log(GREEN, "docker", "Docker is running.");
  return true;
}

function startNativeMode() {
  log(CYAN, "native", "Starting all 14 services with Python + SQLite (no Docker needed)...");
  log(YELLOW, "native", "Services use SQLite databases stored in each service directory.");

  const result = spawnSync(
    "python",
    [path.join(ROOT, "scripts", "native_runner.py")],
    { cwd: ROOT, stdio: "inherit" }
  );

  // native_runner.py handles its own Ctrl+C / shutdown
  process.exit(result.status || 0);
}

// ── Step 2: Generate JWT keys ────────────────────────────────────────────────

function generateKeys() {
  if (fs.existsSync(PRIVATE_KEY) && fs.existsSync(PUBLIC_KEY)) {
    log(GREEN, "jwt", "JWT key pair found.");
    return;
  }

  log(YELLOW, "jwt", "JWT keys not found — generating RSA-2048 key pair...");

  if (!fs.existsSync(SECRETS)) {
    fs.mkdirSync(SECRETS, { recursive: true });
  }

  // Try openssl
  const opensslCandidates = [
    "openssl",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
  ];

  let opensslBin = null;
  for (const candidate of opensslCandidates) {
    const r = spawnSync(candidate, ["version"], { stdio: "pipe" });
    if (r.status === 0) {
      opensslBin = candidate;
      break;
    }
  }

  if (!opensslBin) {
    log(RED, "jwt", "openssl not found.");
    log(RED, "jwt", "Install Git for Windows (includes openssl) or run:");
    log(RED, "jwt", "  winget install openssl");
    log(RED, "jwt", "Then retry: npm run dev");
    process.exit(1);
  }

  const r1 = spawnSync(opensslBin, ["genrsa", "-out", PRIVATE_KEY, "2048"], { stdio: "pipe" });
  if (r1.status !== 0) {
    log(RED, "jwt", "Failed to generate private key: " + r1.stderr?.toString());
    process.exit(1);
  }

  const r2 = spawnSync(opensslBin, ["rsa", "-in", PRIVATE_KEY, "-pubout", "-out", PUBLIC_KEY], { stdio: "pipe" });
  if (r2.status !== 0) {
    log(RED, "jwt", "Failed to extract public key: " + r2.stderr?.toString());
    process.exit(1);
  }

  log(GREEN, "jwt", "RSA-2048 key pair generated in secrets/");
}

// ── Step 3: docker compose up ────────────────────────────────────────────────

function startCompose() {
  log(CYAN, "compose", "Starting all services (docker compose up --build -d)...");
  log(YELLOW, "compose", "First run builds Docker images — this may take 5–10 minutes.");

  const result = spawnSync(
    "docker",
    ["compose", "up", "--build", "-d"],
    { cwd: ROOT, stdio: "inherit" }
  );

  if (result.status !== 0) {
    log(RED, "compose", "docker compose up failed. Check output above.");
    process.exit(1);
  }

  log(GREEN, "compose", "Containers started.");
}

// ── Step 4: Poll health endpoints ────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ ok: res.statusCode === 200, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode === 200, body: {} }); }
      });
    });
    req.on("error", () => resolve({ ok: false, body: {} }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: {} }); });
  });
}

async function waitForServices() {
  log(CYAN, "health", "Waiting for all 14 services to become healthy...");

  const MAX_WAIT_SECONDS = 180;
  const POLL_INTERVAL_MS = 3000;
  const deadline = Date.now() + MAX_WAIT_SECONDS * 1000;

  const ready = new Set();

  while (ready.size < SERVICES.length && Date.now() < deadline) {
    const pending = SERVICES.filter((s) => !ready.has(s.name));

    await Promise.all(
      pending.map(async (svc) => {
        const { ok, body } = await httpGet(`http://localhost:${svc.port}/health`);
        if (ok && body.status) {
          ready.add(svc.name);
          log(GREEN, "ready", `${svc.name} (port ${svc.port}) — ${body.status}`);
        }
      })
    );

    if (ready.size < SERVICES.length) {
      const waiting = SERVICES.filter((s) => !ready.has(s.name)).map((s) => s.name);
      process.stdout.write(
        `\r${YELLOW}[wait]${RESET} ${ready.size}/${SERVICES.length} ready. Waiting for: ${waiting.slice(0, 3).join(", ")}${waiting.length > 3 ? "..." : ""}   `
      );
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  process.stdout.write("\n");

  if (ready.size < SERVICES.length) {
    const notReady = SERVICES.filter((s) => !ready.has(s.name)).map((s) => s.name);
    log(YELLOW, "warn", `${notReady.length} service(s) not yet ready: ${notReady.join(", ")}`);
    log(YELLOW, "warn", "They may still be starting. Run: npm run logs");
  } else {
    log(GREEN, "health", "All 14 services are healthy.");
  }

  return ready;
}

// ── Step 5: Open browser tabs ─────────────────────────────────────────────────

function openBrowser(url) {
  // Works on Windows (start), macOS (open), Linux (xdg-open)
  const cmd =
    process.platform === "win32"  ? ["cmd", ["/c", "start", url]] :
    process.platform === "darwin" ? ["open",  [url]] :
                                    ["xdg-open", [url]];
  spawnSync(cmd[0], cmd[1], { stdio: "ignore", shell: process.platform === "win32" });
}

function openAllPorts(readyServices) {
  log(CYAN, "browser", "Opening API gateway in your browser...");
  openBrowser("http://localhost:8000/docs");
  log(GREEN, "browser", "Opened http://localhost:8000/docs");
}

// ── Step 6: Print URL table ───────────────────────────────────────────────────

function printTable() {
  console.log(`
${CYAN}╔══════════════════════════════════════════════════════════════╗
║              Velontri is running locally 🚀                  ║
╚══════════════════════════════════════════════════════════════╝${RESET}

${GREEN}Frontend — single API URL (use this in your app)${RESET}
  Base URL       http://localhost:8000/api/v1
  Swagger UI     http://localhost:8000/docs
  WebSocket chat ws://localhost:8000/api/v1/ws/chat

${GREEN}Individual services (debug only)${RESET}
  Auth           http://localhost:8001/docs
  User           http://localhost:8002/docs
  Marketplace    http://localhost:8003/docs
  Search         http://localhost:8004/docs
  AI             http://localhost:8005/docs
  Chat           http://localhost:8006/docs
  Payment        http://localhost:8007/docs
  Wallet         http://localhost:8008/docs
  Inventory      http://localhost:8009/docs
  Logistics      http://localhost:8010/docs
  Analytics      http://localhost:8011/docs
  Notification   http://localhost:8012/docs
  CRM            http://localhost:8013/docs
  Subscription   http://localhost:8014/docs

${GREEN}Infrastructure${RESET}
  RabbitMQ       http://localhost:15672   velontri / velontri
  MinIO (S3)     http://localhost:9001    minioadmin / minioadmin
  Grafana        http://localhost:3000    admin / velontri
  Prometheus     http://localhost:9090
  Elasticsearch  http://localhost:9200

${YELLOW}Useful commands${RESET}
  npm run logs          — follow all service logs
  npm run status        — show container status
  npm run test          — run all unit tests
  npm run test:e2e      — run integration tests (stack must be running)
  npm run stop          — stop all containers
  npm run stop:clean    — stop and wipe all data
  npm run health        — check service health without restarting
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n${CYAN}=== Velontri Dev Stack ===${RESET}\n`);

  const hasDocker = checkDocker();

  if (!hasDocker) {
    // No Docker — run all services natively with Python
    generateKeys();
    startNativeMode(); // this blocks until Ctrl+C
    return;
  }

  // Docker path
  generateKeys();
  startCompose();
  const ready = await waitForServices();
  printTable();
  openAllPorts(ready);
})();
