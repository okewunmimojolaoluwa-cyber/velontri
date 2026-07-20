#!/usr/bin/env node
/**
 * npm run test — Run all 402 unit tests across all 14 services
 *
 * Runs each service test suite in its own directory (required because each
 * has its own pytest.ini and conftest.py). Collects pass/fail counts and
 * prints a summary table.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";

const SERVICES = [
  "auth-service",
  "user-service",
  "marketplace-service",
  "payment-service",
  "wallet-service",
  "inventory-service",
  "subscription-service",
  "logistics-service",
  "ai-service",
  "chat-service",
  "analytics-service",
  "crm-service",
  "notification-service",
  "search-service",
];

const SHARED_TESTS = [
  "tests/test_observability.py",
  "tests/test_fx_utils.py",
];

function runTests(label, args, cwd) {
  const result = spawnSync(
    "python",
    ["-m", "pytest", ...args, "--tb=short", "-q"],
    { cwd, encoding: "utf8", stdio: "pipe" }
  );

  const output = (result.stdout || "") + (result.stderr || "");
  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const errorMatch = output.match(/ERROR collecting/);

  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const errored = errorMatch ? true : false;

  return { label, passed, failed, errored, output, exitCode: result.status };
}

(async () => {
  console.log(`\n${CYAN}=== Velontri — Unit Test Suite ===${RESET}\n`);

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  // Service tests
  for (const svc of SERVICES) {
    process.stdout.write(`  Running ${svc.padEnd(26)} ...`);
    const testDir = path.join(ROOT, svc, "tests");
    const r = runTests(svc, [testDir], ROOT);
    results.push(r);
    totalPassed += r.passed;
    totalFailed += r.failed;

    if (r.errored || r.failed > 0) {
      process.stdout.write(` ${RED}FAIL${RESET} (${r.passed} passed, ${r.failed} failed)\n`);
    } else {
      process.stdout.write(` ${GREEN}OK${RESET}   ${r.passed} passed\n`);
    }
  }

  // Shared tests
  process.stdout.write(`  Running shared tests               ...`);
  const sharedArgs = SHARED_TESTS.map((t) => path.join(ROOT, t));
  const sr = runTests("shared", sharedArgs, ROOT);
  results.push(sr);
  totalPassed += sr.passed;
  totalFailed += sr.failed;

  if (sr.failed > 0 || sr.errored) {
    process.stdout.write(` ${RED}FAIL${RESET} (${sr.passed} passed, ${sr.failed} failed)\n`);
  } else {
    process.stdout.write(` ${GREEN}OK${RESET}   ${sr.passed} passed\n`);
  }

  // Summary
  console.log(`\n${"─".repeat(50)}`);
  if (totalFailed === 0) {
    console.log(`${GREEN}PASSED${RESET}  ${totalPassed} tests across ${SERVICES.length + 1} suites\n`);
  } else {
    console.log(`${RED}FAILED${RESET}  ${totalPassed} passed, ${totalFailed} failed\n`);

    // Print failing output
    const failing = results.filter((r) => r.failed > 0 || r.errored);
    for (const r of failing) {
      console.log(`\n${RED}─── ${r.label} failures ───${RESET}`);
      console.log(r.output.slice(-2000));
    }

    process.exit(1);
  }
})();
