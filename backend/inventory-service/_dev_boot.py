
import sys, os
from pathlib import Path
ROOT = Path("C:/Users/USER PC/Desktop/velontri").as_posix()
SVC  = Path("C:/Users/USER PC/Desktop/velontri/inventory-service").as_posix()
# Ensure shared + service dirs are importable
for p in [ROOT, SVC]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Apply infrastructure stubs (SQLite, fake Redis/RabbitMQ) BEFORE any service import
sys.path.insert(0, str(Path(ROOT) / "scripts"))
from native_stubs import apply_patches
apply_patches("inventory-service")

# Now import and run the service app via uvicorn
import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=8009, log_level="warning", reload=False)
