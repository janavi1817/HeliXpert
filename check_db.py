import sqlite3

db_path = r'C:\Users\Janavipatel\OneDrive\Documents\HeliXpert\data\database\helixpert.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

for table in ['helicopters', 'components', 'sensor_parameters', 'maintenance_records']:
    print(f"\n=== {table} columns ===")
    cur.execute(f"PRAGMA table_info([{table}])")
    cols = cur.fetchall()
    for c in cols:
        print(f"  {c[1]} ({c[2]})")
    cur.execute(f"SELECT * FROM [{table}] LIMIT 2")
    rows = cur.fetchall()
    print(f"  Sample rows ({len(rows)}):", rows)

conn.close()
