import psycopg2
import sys

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

def migrate():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    try:
        print("Adding color_blind column to student_profiles...")
        cur.execute("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS color_blind BOOLEAN DEFAULT false;")
        
        print("Adding sequence_order column to lessons...")
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sequence_order INTEGER DEFAULT 1;")
        
        print("Adding next_lesson_id column to lessons...")
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS next_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;")
        
        print("Creating student_lesson_progress table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS student_lesson_progress (
                student_id UUID REFERENCES users(id) ON DELETE CASCADE,
                lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'not_started',
                progress_percentage INTEGER DEFAULT 0,
                completed_at TIMESTAMP WITH TIME ZONE,
                last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (student_id, lesson_id)
            );
        """)
        
        conn.commit()
        print("Migration successful.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
