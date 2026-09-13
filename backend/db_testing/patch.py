with open('backend/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("email = %s AND password = %s", "email = %s AND password_hash = %s")

text = text.replace("password, mobile, school, role, created_at", "password_hash, mobile, role, created_at")
text = text.replace("VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", "VALUES (%s, %s, %s, %s, %s, %s, %s)")
text = text.replace("(user_id, payload.name, payload.email, payload.password, payload.mobile, payload.school, payload.role, datetime.utcnow().isoformat())", "(user_id, payload.name, payload.email, payload.password, payload.mobile, payload.role, datetime.utcnow().isoformat())")

text = text.replace("password, role, created_at", "password_hash, role, created_at")

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Patched main.py")
