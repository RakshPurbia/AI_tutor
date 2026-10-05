import psycopg2
from main import get_conn

def patch_db():
    conn = get_conn()
    
    # 1. Add voice_profiles table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS voice_profiles (
            id UUID PRIMARY KEY,
            student_id UUID NOT NULL,
            persona_name VARCHAR(100) NOT NULL,
            audio_sample_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 2. Add columns to student_profiles
    try:
        conn.execute("ALTER TABLE student_profiles ADD COLUMN active_voice_profile_id UUID")
    except psycopg2.errors.DuplicateColumn:
        conn.execute("ROLLBACK")
    except Exception as e:
        print(f"Error adding column: {e}")
        conn.execute("ROLLBACK")
        
    try:
        conn.execute("ALTER TABLE student_profiles ADD COLUMN tutor_name VARCHAR(100) DEFAULT 'Tutor'")
    except psycopg2.errors.DuplicateColumn:
        conn.execute("ROLLBACK")
    except Exception as e:
        print(f"Error adding column: {e}")
        conn.execute("ROLLBACK")

    conn.commit()
    conn.close()
    print("Database patched successfully!")

if __name__ == "__main__":
    patch_db()
