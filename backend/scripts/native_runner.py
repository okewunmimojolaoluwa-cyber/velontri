"""
Native development runner.

Starts each of the 14 services as a separate subprocess with its own
environment. Uses a minimal bootstrap that applies patches without any
stagger delay — all 14 start concurrently.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CYAN   = "\x1b[36m"
GREEN  = "\x1b[32m"
YELLOW = "\x1b[33m"
RED    = "\x1b[31m"
RESET  = "\x1b[0m"

SERVICES = [
    ("auth-service",         8001),
    ("user-service",         8002),
    ("marketplace-service",  8003),
    ("search-service",       8004),
    ("ai-service",           8005),
    ("chat-service",         8006),
    ("payment-service",      8007),
    ("wallet-service",       8008),
    ("inventory-service",    8009),
    ("logistics-service",    8010),
    ("analytics-service",    8011),
    ("notification-service", 8012),
    ("crm-service",          8013),
    ("subscription-service", 8014),
]

# One boot script, parameterised at runtime via env vars — no file writes needed
BOOT_CODE = r"""
import sys, os
from pathlib import Path

ROOT = Path(os.environ["VELONTRI_ROOT"])
SVC_NAME = os.environ["VELONTRI_SVC"]
PORT     = int(os.environ["VELONTRI_PORT"])
SVC_DIR  = ROOT / SVC_NAME

sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(SVC_DIR))
sys.path.insert(0, str(ROOT / "scripts"))

from native_stubs import apply_patches
apply_patches(SVC_NAME)

import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=PORT,
            log_level="warning", access_log=False)
"""


def log(color, tag, msg):
    print(f"{color}[{tag}]{RESET} {msg}", flush=True)


def generate_keys():
    priv = ROOT / "secrets" / "jwt_private_key.pem"
    pub  = ROOT / "secrets" / "jwt_public_key.pem"
    if priv.exists() and pub.exists():
        log(GREEN, "jwt", "Key pair found.")
        return
    log(YELLOW, "jwt", "Generating RSA-2048 key pair...")
    (ROOT / "secrets").mkdir(exist_ok=True)
    candidates = ["openssl",
                  r"C:\Program Files\Git\usr\bin\openssl.exe",
                  r"C:\Program Files\OpenSSL-Win64\bin\openssl.exe"]
    openssl = next(
        (c for c in candidates
         if subprocess.run([c, "version"], capture_output=True).returncode == 0),
        None
    )
    if not openssl:
        log(RED, "jwt", "openssl not found. Install Git for Windows.")
        sys.exit(1)
    subprocess.run([openssl, "genrsa", "-out", str(priv), "2048"],
                   capture_output=True, check=True)
    subprocess.run([openssl, "rsa", "-in", str(priv), "-pubout", "-out", str(pub)],
                   capture_output=True, check=True)
    log(GREEN, "jwt", "Done.")


def start_service(svc_name: str, port: int) -> subprocess.Popen:
    env = os.environ.copy()
    env["VELONTRI_ROOT"] = str(ROOT)
    env["VELONTRI_SVC"]  = svc_name
    env["VELONTRI_PORT"] = str(port)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    # Forward PATH so openssl / python are findable
    return subprocess.Popen(
        [sys.executable, "-c", BOOT_CODE],
        cwd=str(ROOT / svc_name),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def wait_for_port(port: int, timeout: float = 90.0) -> bool:
    import socket
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1.0):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def open_browser(url: str) -> None:
    if sys.platform == "win32":
        os.startfile(url)


def print_table(ready_ports: set[int]) -> None:
    total = len(SERVICES)
    up    = len(ready_ports)
    print(f"""
{CYAN}╔══════════════════════════════════════════════════════════════╗
║           Velontri is running (native mode) 🚀               ║
╚══════════════════════════════════════════════════════════════╝{RESET}

{GREEN}Services  ({up}/{total} ready){RESET}""")
    for name, port in SERVICES:
        sym   = "✓" if port in ready_ports else "✗"
        color = GREEN if port in ready_ports else RED
        print(f"  {color}{sym}{RESET}  {name:<24}  http://localhost:{port}/docs")
    print(f"""
{YELLOW}Note:{RESET}  SQLite databases stored as dev_*.db in each service dir.
       Events between services are no-ops in native mode.
{YELLOW}Stop:{RESET}  Ctrl+C
""")


def main():
    print(f"\n{CYAN}=== Velontri Native Dev Stack ==={RESET}\n")
    log(CYAN, "mode", "No Docker — SQLite + in-process stubs")

    generate_keys()

    # Launch all 14 processes simultaneously
    log(CYAN, "start", f"Launching all {len(SERVICES)} services in parallel...")
    procs: list[tuple[str, int, subprocess.Popen]] = []
    for svc_name, port in SERVICES:
        proc = start_service(svc_name, port)
        procs.append((svc_name, port, proc))
        log(GREEN, "launch", f"{svc_name:<24}  port {port}")

    # Wait for all ports concurrently
    log(CYAN, "wait", "Waiting for services to become ready (up to 90s)...")
    ready_ports: set[int] = set()
    lock = threading.Lock()

    def check(svc_name, port, proc):
        ok = wait_for_port(port, timeout=90.0)
        with lock:
            if ok:
                ready_ports.add(port)
                log(GREEN, "up", f"{svc_name}  http://localhost:{port}/docs")
            else:
                # Grab last few lines of output for diagnosis
                out = ""
                try:
                    proc.stdout.flush()
                    lines = []
                    while True:
                        line = proc.stdout.readline()
                        if not line:
                            break
                        lines.append(line.rstrip())
                        if len(lines) > 5:
                            lines.pop(0)
                    out = " | ".join(lines[-3:]) if lines else "(no output)"
                except Exception:
                    pass
                log(RED, "fail", f"{svc_name} port {port} — {out[:120]}")

    check_threads = [
        threading.Thread(target=check, args=(n, p, proc), daemon=True)
        for n, p, proc in procs
    ]
    for t in check_threads:
        t.start()
    for t in check_threads:
        t.join()

    print_table(ready_ports)

    if ready_ports:
        log(CYAN, "browser", "Opening Swagger UIs in browser...")
        for name, port in SERVICES:
            if port in ready_ports:
                open_browser(f"http://localhost:{port}/docs")
                time.sleep(0.2)

    # Handle Ctrl+C
    def shutdown(sig, frame):
        print(f"\n{YELLOW}[stop]{RESET} Stopping all services...")
        for _, _, proc in procs:
            proc.terminate()
        for _, _, proc in procs:
            try:
                proc.wait(timeout=4)
            except subprocess.TimeoutExpired:
                proc.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Stream logs from all services
    def stream(name, proc):
        prefix = f"{CYAN}[{name[:14]:<14}]{RESET}"
        try:
            for line in proc.stdout:
                line = line.rstrip()
                if line and "WARNING" not in line and "Deprecation" not in line:
                    print(f"{prefix} {line}", flush=True)
        except Exception:
            pass

    for svc_name, _, proc in procs:
        threading.Thread(target=stream, args=(svc_name, proc), daemon=True).start()

    log(GREEN, "ok", f"{len(ready_ports)}/{len(SERVICES)} services running. Ctrl+C to stop.\n")

    while all(proc.poll() is None for _, _, proc in procs):
        time.sleep(1)

    log(RED, "exit", "Some services crashed. Check output above.")


if __name__ == "__main__":
    main()
