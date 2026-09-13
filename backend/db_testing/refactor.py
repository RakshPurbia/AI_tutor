import os

with open("backend/main.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import sqlite3", "import psycopg2\nimport psycopg2.extras")
content = content.replace('DB_PATH = os.path.join(os.path.dirname(__file__), "ai_tutor.db")', 'DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"')

start = content.find("def get_conn():")
end = content.find("init_db()\n") + len("init_db()\n")

wrapper_code = """class PgConnWrapper:
    def __init__(self, conn):
        self.conn = conn

    def execute(self, query, params=None):
        query = query.replace('?', '%s')
        
        query = query.replace('INSERT OR IGNORE INTO enrollments', 'INSERT INTO enrollments')
        if 'INSERT INTO enrollments' in query and 'ON CONFLICT' not in query:
            query += " ON CONFLICT (class_id, student_id) DO NOTHING"
            
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if params:
            cur.execute(query, params)
        else:
            cur.execute(query)
        return cur

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

def get_conn():
    conn = psycopg2.connect(DB_URL)
    return PgConnWrapper(conn)
"""

if start != -1 and end != -1:
    content = content[:start] + wrapper_code + content[end:]
    with open("backend/main.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully refactored main.py.")
else:
    print("Could not find get_conn or init_db")
