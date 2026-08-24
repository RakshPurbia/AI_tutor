import os
import psycopg2

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

def apply_sql_file(conn, filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()
    with conn.cursor() as cur:
        print(f"Executing {os.path.basename(filepath)}...")
        cur.execute(sql)
    conn.commit()
    print(f"Successfully executed {os.path.basename(filepath)}")

def main():
    try:
        conn = psycopg2.connect(DB_URL)
        print("Connected to Ghost Database!")
        
        # Files to execute in order
        base_dir = os.path.dirname(__file__)
        files = [
            "schema.sql",
            "01_seed_users_profiles.sql",
            "02_seed_classes_enrollments.sql",
            "03_seed_content_lessons.sql",
            "04_seed_quizzes.sql",
            "05_seed_quiz_attempts.sql"
        ]
        
        for file in files:
            filepath = os.path.join(base_dir, file)
            if os.path.exists(filepath):
                apply_sql_file(conn, filepath)
            else:
                print(f"Warning: {filepath} not found.")
                
        conn.close()
        print("All schema and seed data applied successfully!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
