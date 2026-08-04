import asyncio
import sqlite3
import json
import os
import datetime
from pathlib import Path

# Need to handle JSON serialization for datetime/UUID
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, memoryview):
            return obj.tobytes().hex()
        return super().default(obj)

def dump_sqlite_to_json(sqlite_db_path, output_json_path):
    if not os.path.exists(sqlite_db_path):
        print(f"Database {sqlite_db_path} not found. Skipping dump.")
        return False
        
    print(f"Connecting to {sqlite_db_path}...")
    conn = sqlite3.connect(sqlite_db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row['name'] for row in cursor.fetchall()]
    
    data_dump = {}
    
    for table in tables:
        if table.startswith('sqlite_'):
            continue
        print(f"Dumping table: {table}")
        cursor.execute(f"SELECT * FROM {table}")
        rows = [dict(row) for row in cursor.fetchall()]
        data_dump[table] = rows
        
    conn.close()
    
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(data_dump, f, cls=JSONEncoder, indent=2)
        
    print(f"Successfully dumped data to {output_json_path}")
    return True


if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    dev_db = base_dir / "dev_gateway.db"
    velontri_db = base_dir / "velontri.db"
    
    dump_sqlite_to_json(dev_db, base_dir / "sqlite_dump_dev.json")
    dump_sqlite_to_json(velontri_db, base_dir / "sqlite_dump_velontri.json")
    
    print("\n--- Next Steps ---")
    print("The data has been extracted to JSON. You can write a custom script using asyncpg ")
    print("to insert this JSON data into your PostgreSQL 'velontri' database if needed.")
