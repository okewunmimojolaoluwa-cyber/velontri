import re
from pathlib import Path
import yaml

ROOT = Path(r"c:\Users\USER PC\Desktop\velontri\backend")

# 1. Update tests
tests_to_fix = [
    "analytics-service/tests/test_analytics.py",
    "auth-service/tests/test_repository.py",
    "crm-service/tests/test_crm.py",
    "notification-service/tests/test_notification.py",
    "user-service/tests/test_consumers.py",
    "user-service/tests/test_repository.py",
]

for test_rel in tests_to_fix:
    f = ROOT / test_rel
    if not f.exists(): continue
    text = f.read_text(encoding="utf-8")
    
    # Replace the connection string. Using an environment variable or falling back to local postgres
    # We use velontri_test database so we don't accidentally wipe dev DBs.
    text = text.replace(
        '"sqlite+aiosqlite:///:memory:"',
        '__import__("os").environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://velontri:velontri@localhost:5432/velontri_test")'
    )
    
    # In auth test, we also need to remove SQLite INET test hacks if any
    if "test_repository.py" in test_rel:
        text = re.sub(
            r'# SQLite doesn\'t support INET.*?def set_sqlite_pragma.*?\n        pass.*?# Patch INET columns.*?\n',
            '',
            text,
            flags=re.DOTALL
        )
    
    f.write_text(text, encoding="utf-8")
    print(f"Updated {test_rel}")

# 2. Rewrite docker-compose.yml
dc_file = ROOT / "docker-compose.yml"
dc_text = dc_file.read_text(encoding="utf-8")

# We want to replace all postgres-<svc> with a single `postgres` service.
# Let's just do it cleanly via ruamel.yaml if available, or just regex. 
# Since we might not have ruamel.yaml, let's use standard yaml but preserve order as best we can,
# or write a careful regex.
import yaml
with open(dc_file, "r") as f:
    dc = yaml.safe_load(f)

new_services = {}
# Create the single postgres service
new_services["postgres"] = {
    "image": "postgres:16-alpine",
    "<<": "*service-base", # YAML anchors are lost by PyYAML, we will have to insert this manually
    "environment": {
        "POSTGRES_USER": "velontri",
        "POSTGRES_PASSWORD": "velontri",
        "POSTGRES_DB": "velontri"
    },
    "volumes": [
        "postgres-data:/var/lib/postgresql/data"
    ],
    "ports": [
        "5432:5432"
    ]
}

# Add test db (velontri_test) creation hook
new_services["postgres"]["environment"]["POSTGRES_MULTIPLE_DATABASES"] = "velontri_test"
new_services["postgres"]["volumes"].append("./scripts/init-multiple-dbs.sh:/docker-entrypoint-initdb.d/init-multiple-dbs.sh:ro")

for name, svc in dc["services"].items():
    if name.startswith("postgres-"):
        continue # Drop individual postgres DBs
    
    # For microservices, update depends_on and DATABASE_URL
    if "environment" in svc and "DATABASE_URL" in svc["environment"]:
        svc["environment"]["DATABASE_URL"] = "postgresql+asyncpg://velontri:velontri@postgres:5432/velontri"
        
    if "depends_on" in svc:
        new_deps = []
        for dep in svc["depends_on"]:
            if dep.startswith("postgres-"):
                if "postgres" not in new_deps:
                    new_deps.append("postgres")
            else:
                new_deps.append(dep)
        svc["depends_on"] = new_deps
        
    new_services[name] = svc

dc["services"] = new_services

# We also need to fix volumes:
new_vols = {}
if "volumes" in dc:
    for vname, vval in dc["volumes"].items():
        if vname.startswith("postgres-") and vname.endswith("-data"):
            continue
        new_vols[vname] = vval
    new_vols["postgres-data"] = None
    dc["volumes"] = new_vols

# Instead of PyYAML which strips anchors/comments, let's just do regex replacements for the environment variables.
# Actually, the user's docker-compose has yaml anchors. So regex is much better to preserve comments/anchors.

def fix_docker_compose_regex():
    text = dc_file.read_text(encoding="utf-8")
    
    # 1. Replace DATABASE_URL in microservices
    text = re.sub(
        r'DATABASE_URL:\s+postgresql\+asyncpg://velontri:velontri@postgres-[a-z]+:543[0-9]/[a-z_]+',
        r'DATABASE_URL: postgresql+asyncpg://velontri:velontri@postgres:5432/velontri',
        text
    )
    
    # 2. Replace depends_on: - postgres-<svc> with - postgres
    text = re.sub(
        r'-\s+postgres-[a-z]+',
        r'- postgres',
        text
    )
    
    # 3. Clean up duplicate '- postgres' in depends_on blocks if they appear
    # We'll just leave it or clean it up if it happens (should only be 1 per service).
    
    # 4. Remove all postgres-* services and add a single postgres service
    # Find start of postgres-auth and end of postgres-crm (or whatever is last)
    # Actually, they are scattered: postgres-auth, postgres-user, postgres-marketplace...
    # Let's just remove them blocks by blocks
    text = re.sub(
        r'\n  postgres-[a-z]+:.*?(?=\n  [a-z]+:|\n\n)',
        '',
        text,
        flags=re.DOTALL
    )
    
    # Now insert the single postgres service after the Infrastructure header
    single_pg = """
  postgres:
    image: postgres:16-alpine
    <<: *service-base
    environment:
      POSTGRES_USER: velontri
      POSTGRES_PASSWORD: velontri
      POSTGRES_DB: velontri
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
"""
    text = text.replace("  # ── Infrastructure ─────────────────────────────────────────────────────────\n", "  # ── Infrastructure ─────────────────────────────────────────────────────────\n" + single_pg)
    
    # 5. Fix volumes section at the end
    text = re.sub(
        r'postgres-[a-z]+-data:\n?',
        '',
        text
    )
    text = text.replace("volumes:", "volumes:\n  postgres-data:")
    
    dc_file.write_text(text, encoding="utf-8")
    print("Updated docker-compose.yml via regex")

fix_docker_compose_regex()
