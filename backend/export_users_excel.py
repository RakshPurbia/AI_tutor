"""
Export all existing users (students, teachers, parents) from the database
into the credentials Excel file (AI_Tutor_Users.xlsx) on the Desktop.

Run from the backend folder:
    venv\\Scripts\\python.exe export_users_excel.py

New registrations are also appended automatically by main.py
(save_credentials_to_excel is called in /api/auth/register and the
student/teacher login endpoints), so this script only needs to be run
once to backfill existing users.
"""

import os
from openpyxl import Workbook, load_workbook

from main import get_conn  # reuses the same DB connection logic as the API

HEADERS = ["Role", "Name", "Email", "Password"]


def get_desktop_path():
    return r"E:\ai_project_git"


def upsert_rows(path, rows):
    """Upsert (Role, Email)-keyed rows into the xlsx file."""
    if os.path.isfile(path):
        wb = load_workbook(path)
        ws = wb.active
        existing = [list(r) for r in ws.iter_rows(min_row=2, values_only=True) if r]
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = "Users"
        ws.append(HEADERS)
        existing = []

    keys = {(str(r[0]), str(r[2])) for r in existing if len(r) >= 4}
    for row in rows:
        key = (str(row[0]), str(row[2]))
        if key not in keys:
            existing.append(row)
            keys.add(key)

    ws.delete_rows(2, ws.max_row)
    for r in existing:
        ws.append(list(r)[:4])
    wb.save(path)
    return len(existing)


def main_export():
    conn = get_conn()
    cur = conn.execute("SELECT name, email, password_hash, role FROM users ORDER BY role, name")
    users = cur.fetchall()
    conn.close()

    xlsx_path = os.path.join(get_desktop_path(), "AI_Tutor_Users.xlsx")

    rows = []
    for u in users:
        # RealDictCursor returns dicts
        rows.append([
            u.get("role", ""),
            u.get("name", ""),
            u.get("email", ""),
            u.get("password_hash", ""),
        ])

    total = upsert_rows(xlsx_path, rows)
    print(f"Exported {len(rows)} users from the database.")
    print(f"Excel file now contains {total} credential rows:")
    print(f"  {xlsx_path}")
    for r in rows:
        print(f"  - [{r[0]}] {r[1]} <{r[2]}>")


if __name__ == "__main__":
    main_export()
