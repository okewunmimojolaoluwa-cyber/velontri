import json
import os
from pathlib import Path
from sqlalchemy import create_engine, MetaData, Table, text

def import_data(json_path: Path, db_url: str):
    if not json_path.exists():
        print(f"File {json_path} not found.")
        return

    print(f"Loading data from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Connecting to Postgres at {db_url}...")
    engine = create_engine(db_url)
    metadata = MetaData()
    metadata.reflect(bind=engine)

    with engine.begin() as conn:
        for table_name, rows in data.items():
            if not rows:
                print(f"Skipping {table_name}: empty")
                continue
            
            if table_name not in metadata.tables:
                print(f"Warning: Table {table_name} not found in Postgres schema. Skipping.")
                continue
                
            table = metadata.tables[table_name]
            print(f"Inserting {len(rows)} rows into {table_name}...")
            
            # Use raw SQL or SQLAlchemy Core insert. Core insert handles parameterization safely.
            # But we must be careful with conflict resolution or just use TRUNCATE before insert if needed, 
            # or just INSERT since we assume empty DB.
            
            try:
                # Disable foreign key checks for the transaction if needed, though Postgres doesn't have a simple 
                # session-level 'SET session_replication_role = replica;' requires superuser.
                # So we just insert in order or hope constraints are satisfied.
                conn.execute(table.insert(), rows)
            except Exception as e:
                print(f"Error inserting into {table_name}: {e}")
                print("Trying to insert row by row to skip duplicates/errors...")
                success = 0
                for r in rows:
                    try:
                        conn.execute(table.insert().values(**r))
                        success += 1
                    except Exception as err:
                        pass
                print(f"Inserted {success}/{len(rows)} rows into {table_name}")

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    dev_dump = base_dir / "sqlite_dump_dev.json"
    velontri_dump = base_dir / "sqlite_dump_velontri.json"
    
    env_path = base_dir / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()

    url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://velontri:velontri@localhost:5432/velontri")
    url = url.replace('+asyncpg', '+psycopg2')
    
    import_data(dev_dump, url)
    print("Import complete.")
