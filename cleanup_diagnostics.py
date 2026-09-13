import psycopg2

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

def cleanup_diagnostics():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Get all diagnostic content IDs
    cur.execute("SELECT id FROM content WHERE title = 'Diagnostic Assessment Content'")
    contents = cur.fetchall()
    print(f"Found {len(contents)} diagnostic assessments.")
    
    if len(contents) > 1:
        # Keep the first one, delete the rest
        contents_to_delete = contents[1:]
        print(f"Deleting {len(contents_to_delete)} assessments...")
        
        for c in contents_to_delete:
            content_id = c[0]
            cur.execute("DELETE FROM content WHERE id = %s", (content_id,))
            
        conn.commit()
        print("Cleanup successful.")
    else:
        print("Only 1 or 0 diagnostic assessments found. No cleanup needed.")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    cleanup_diagnostics()
