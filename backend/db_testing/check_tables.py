import psycopg2

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';")
    tables = cur.fetchall()
    print("Tables in Ghost DB:")
    for t in tables:
        print(f" - {t[0]}")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
