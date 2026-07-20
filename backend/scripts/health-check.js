#!/usr/bin/env node
/**
 * npm run health — Check the unified API gateway on port 8000
 */

const http = require("http");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const GATEWAY = "http://localhost:8000";
const PROBE_ENDPOINTS = [
  { name: "gateway health",  path: "/health" },
  { name: "API root",        path: "/api/v1" },
  { name: "auth (register)", path: "/api/v1/auth/register", method: "OPTIONS" },
  { name: "listings",        path: "/api/v1/listings" },
  { name: "search",          path: "/api/v1/search?q=test" },
  { name: "subscriptions",   path: "/api/v1/subscriptions/tiers" },
];

function httpRequest(url, method = "GET") {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? require("https") : http;
    const req = lib.request(url, { method, timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 500, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 500, status: res.statusCode, body: {} }); }
      });
    });
    req.on("error", () => resolve({ ok: false, status: 0, body: {} }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0, body: {} }); });
    req.end();
  });
}

(async () => {
  console.log("\nVelontri — API Gateway Health (port 8000)\n");

  let allOk = true;

  for (const ep of PROBE_ENDPOINTS) {
    const { ok, status, body } = await httpRequest(`${GATEWAY}${ep.path}`, ep.method || "GET");
    const icon = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const detail = body.status || body.service || `HTTP ${status}`;
    console.log(`  ${icon} ${ep.name.padEnd(20)} ${detail}`);
    if (!ok) allOk = false;
  }

  console.log("");
  if (allOk) {
    console.log(`${GREEN}Gateway is healthy.${RESET}`);
    console.log(`  Frontend base URL: ${GATEWAY}/api/v1`);
    console.log(`  Swagger UI:        ${GATEWAY}/docs\n`);
  } else {
    console.log(`${YELLOW}Gateway is not reachable.${RESET}`);
    console.log(`  Start with: npm run dev\n`);
  }
})();
