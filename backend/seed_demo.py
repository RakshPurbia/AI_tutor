import uuid
from datetime import datetime
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from main import get_conn

def seed_quiz():
    conn = get_conn()
    
    # 1. Get Teacher
    teacher = conn.execute("SELECT id FROM users WHERE email = 'ms.rao@school.com'").fetchone()
    if not teacher:
        print("Teacher not found")
        return
    teacher_id = teacher["id"]
    print(f"Found teacher: {teacher_id}")

    # 2. Get or Create Class
    cls = conn.execute("SELECT id FROM classes WHERE teacher_id = %s", (teacher_id,)).fetchone()
    if not cls:
        class_id = str(uuid.uuid4())
        conn.execute("INSERT INTO classes (id, teacher_id, name, subject) VALUES (%s, %s, '10th Grade Science', 'Science')", (class_id, teacher_id))
    else:
        class_id = cls["id"]
    print(f"Class ID: {class_id}")

    # 3. Enroll Aarav
    student = conn.execute("SELECT id FROM users WHERE email = 'aarav@student.com'").fetchone()
    if student:
        student_id = student["id"]
        conn.execute("INSERT INTO enrollments (class_id, student_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (class_id, student_id))
        print(f"Enrolled Aarav: {student_id}")

    # 4. Upload Content (Lesson)
    content_id = str(uuid.uuid4())
    ocr_text = "The ear consists of the outer ear, middle ear, and inner ear. The cochlea translates vibrations into nerve impulses."
    conn.execute(
        "INSERT INTO content (id, class_id, teacher_id, title, file_name, ocr_text, uploaded_at) VALUES (%s, %s, %s, 'Ear Anatomy Intro', 'ear_intro.pdf', %s, %s)",
        (content_id, class_id, teacher_id, ocr_text, datetime.utcnow().isoformat())
    )

    lesson_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO lessons (id, content_id, title, transcript) VALUES (%s, %s, 'Ear Anatomy Basics', %s)",
        (lesson_id, content_id, ocr_text)
    )
    print(f"Created Lesson: {lesson_id}")

    # 5. Create Quiz
    quiz_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (%s, %s, 'Ear Anatomy Assessment', 'medium')",
        (quiz_id, lesson_id)
    )

    questions = [
        ("Which part of the ear converts vibrations into nerve signals?", ["Eardrum", "Cochlea", "Pinna", "Stapes"], "Cochlea"),
        ("The middle ear contains tiny bones called?", ["Ossicles", "Cilia", "Cartilage", "Tendons"], "Ossicles")
    ]

    for q, options, ans in questions:
        q_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (%s, %s, %s, %s, %s)",
            (q_id, quiz_id, q, json.dumps(options), ans)
        )
    print(f"Created Quiz: {quiz_id}")

    conn.commit()
    conn.close()
    print("Done seeding!")

if __name__ == "__main__":
    seed_quiz()
