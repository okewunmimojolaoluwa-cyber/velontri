"""Install all dependencies needed to run the Velontri test suite locally."""
import subprocess
import sys

packages = [
    "structlog",
    "PyJWT[crypto]",
    "pydantic>=2",
    "pydantic-settings>=2",
    "fastapi",
    "sqlalchemy[asyncio]",
    "aiosqlite",
    "bcrypt",
    "pyotp",
    "cryptography",
    "hypothesis",
    "pytest",
    "pytest-asyncio",
    "httpx",
    "python-multipart",
    "prometheus-client",
]

print(f"Installing {len(packages)} packages...")
result = subprocess.run(
    [sys.executable, "-m", "pip", "install", "--quiet"] + packages,
    capture_output=True, text=True
)
if result.returncode == 0:
    print("All dependencies installed successfully.")
else:
    print("STDOUT:", result.stdout[-2000:])
    print("STDERR:", result.stderr[-2000:])
    sys.exit(1)
