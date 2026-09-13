import psycopg2
import os

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

def delete_diagnostics():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Try deleting from content, assuming CASCADE. If not, delete individually.
    print("Deleting quizzes...")
    cur.execute("DELETE FROM quizzes WHERE title LIKE '%Diagnostic Quiz%' OR title = 'Diagnostic Assessment'")
    
    print("Deleting lessons...")
    cur.execute("DELETE FROM lessons WHERE title = 'Diagnostic Assessment'")
    
    print("Deleting content...")
    cur.execute("DELETE FROM content WHERE title = 'Diagnostic Assessment Content'")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Successfully deleted diagnostic assessments from the database.")

if __name__ == "__main__":
    delete_diagnostics()
