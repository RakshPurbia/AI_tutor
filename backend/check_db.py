import sqlite3
conn = sqlite3.connect('ai_tutor.db')
conn.row_factory = sqlite3.Row
cur = conn.execute('SELECT * FROM lessons')
rows = cur.fetchall()
if not rows:
    print("NO ROWS IN LESSONS TABLE")
else:
    for row in rows:
        print(dict(row))
