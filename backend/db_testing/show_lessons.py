import psycopg2

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT id, content_id, title, transcript FROM lessons;")
    rows = cur.fetchall()
    
    print("\n--- LESSONS TABLE DATA ---")
    for row in rows:
        print(f"ID: {row[0]}")
        print(f"Content ID: {row[1]}")
        print(f"Title: {row[2]}")
        print(f"Transcript: {row[3]}\n")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
