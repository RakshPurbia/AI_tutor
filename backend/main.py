"""
AI Learn - Backend (FastAPI + SQLite, runs fully on localhost, no cloud dependency)

Run with:
    pip install fastapi uvicorn --break-system-packages
    uvicorn main:app --reload --port 8000
"""

import sqlite3
import uuid
import os
from datetime import datetime
from typing import Optional, List
import urllib.request
import tempfile
from fastapi.responses import FileResponse

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.path.join(os.path.dirname(__file__), "ai_tutor.db")

app = FastAPI(title="AI Learn Backend")

# Allow the Next.js frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            password TEXT,
            mobile TEXT,
            school TEXT,
            role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'parent')),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS student_profiles (
            user_id TEXT PRIMARY KEY REFERENCES users(id),
            grade TEXT,
            preferred_language TEXT,
            onset_type TEXT CHECK(onset_type IN ('congenital', 'acquired', NULL)),
            age_of_onset INTEGER,
            braille_literacy TEXT CHECK(braille_literacy IN ('fluent', 'learning', 'none', NULL)),
            residual_vision TEXT CHECK(residual_vision IN ('none', 'light_perception', 'low_vision', NULL)),
            learning_mode TEXT,
            speech_speed TEXT DEFAULT 'normal',
            explanation_style TEXT,
            focus_areas TEXT
        );

        CREATE TABLE IF NOT EXISTS parent_links (
            parent_id TEXT REFERENCES users(id),
            student_id TEXT REFERENCES users(id),
            PRIMARY KEY (parent_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY,
            teacher_id TEXT REFERENCES users(id),
            name TEXT NOT NULL,
            subject TEXT
        );

        CREATE TABLE IF NOT EXISTS enrollments (
            class_id TEXT REFERENCES classes(id),
            student_id TEXT REFERENCES users(id),
            PRIMARY KEY (class_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS content (
            id TEXT PRIMARY KEY,
            class_id TEXT REFERENCES classes(id),
            teacher_id TEXT REFERENCES users(id),
            title TEXT NOT NULL,
            subject TEXT,
            file_name TEXT,
            ocr_text TEXT,
            uploaded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            content_id TEXT REFERENCES content(id),
            title TEXT NOT NULL,
            transcript TEXT
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id TEXT PRIMARY KEY,
            lesson_id TEXT REFERENCES lessons(id),
            title TEXT NOT NULL,
            difficulty_level TEXT DEFAULT 'medium'
        );

        CREATE TABLE IF NOT EXISTS quiz_questions (
            id TEXT PRIMARY KEY,
            quiz_id TEXT REFERENCES quizzes(id),
            question_text TEXT NOT NULL,
            options TEXT NOT NULL,     -- JSON-encoded list
            correct_answer TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id TEXT PRIMARY KEY,
            quiz_id TEXT REFERENCES quizzes(id),
            student_id TEXT REFERENCES users(id),
            score INTEGER,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS student_answers (
            id TEXT PRIMARY KEY,
            attempt_id TEXT REFERENCES quiz_attempts(id),
            question_id TEXT REFERENCES quiz_questions(id),
            selected_answer TEXT,
            is_correct INTEGER
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id TEXT PRIMARY KEY,
            student_id TEXT REFERENCES users(id),
            quiz_id TEXT REFERENCES quizzes(id),
            weak_topics TEXT,
            recommendation TEXT,
            generated_at TEXT
        );
        """
    )
    conn.commit()
    conn.close()


init_db()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OnboardingPayload(BaseModel):
    name: str
    age: Optional[int] = None
    grade: Optional[str] = None
    preferred_language: Optional[str] = "English"
    support_type: str  # "vision" | "audio" | "text" | "other" | "none"
    onset_type: Optional[str] = None       # "congenital" | "acquired"
    age_of_onset: Optional[int] = None
    braille_literacy: Optional[str] = None  # "fluent" | "learning" | "none"
    residual_vision: Optional[str] = None   # "none" | "light_perception" | "low_vision"
    learning_mode: Optional[str] = "mostly_audio"
    speech_speed: Optional[str] = "normal"


class TutorAskPayload(BaseModel):
    student_id: str
    question: str


class QuizAnswerPayload(BaseModel):
    student_id: str
    quiz_id: str
    answers: List[dict]  # [{question_id, selected_answer}]


class ContentUploadPayload(BaseModel):
    teacher_id: str
    class_id: str
    title: str
    subject: Optional[str] = None
    file_name: str
    ocr_text: str  # in production this comes from PaddleOCR; here it's passed in directly


class RegisterPayload(BaseModel):
    name: str
    email: str
    password: str
    role: str
    mobile: Optional[str] = None
    school: Optional[str] = None
    activation_code: Optional[str] = None

class LoginPayload(BaseModel):
    email: str
    password: str
    role: str


class QuizCreatePayload(BaseModel):
    teacher_id: str
    lesson_id: str
    title: str
    questions: List[dict]  # [{question_text, options: [...], correct_answer}]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def derive_explanation_style(onset_type, age_of_onset, residual_vision) -> str:
    """
    This is the core personalization rule discussed in planning:
    congenital blindness -> avoid visual analogies entirely.
    acquired blindness -> visual analogies are usually still fine,
    since visual memory exists.
    """
    if onset_type == "congenital":
        return "non_visual_tactile_sequential"
    if onset_type == "acquired":
        # very early acquired onset behaves closer to congenital
        if age_of_onset is not None and age_of_onset <= 4:
            return "non_visual_tactile_sequential"
        return "visual_analogies_allowed"
    if residual_vision in ("light_perception", "low_vision"):
        return "high_contrast_visual_allowed"
    return "audio_first_default"


def build_context_block(profile_row) -> str:
    """
    Converts a stored student profile into the short natural-language
    context block injected into the tutor LLM's system prompt.
    No AI call happens here - this is pure templating, as discussed.
    """
    if profile_row is None:
        return "No learner profile on file. Use plain, accessible, audio-first language."

    parts = []
    onset = profile_row["onset_type"]
    if onset == "congenital":
        parts.append("This student has been blind since birth.")
        parts.append("Do NOT use visual analogies (color, shape-by-sight, 'imagine looking at').")
        parts.append("Use tactile, spatial-by-touch, and sequential/auditory analogies instead.")
    elif onset == "acquired":
        age = profile_row["age_of_onset"]
        parts.append(f"This student became blind later in life (around age {age}).")
        parts.append("Visual analogies are acceptable since visual memory exists.")

    braille = profile_row["braille_literacy"]
    if braille:
        parts.append(f"Braille literacy: {braille}.")

    style = profile_row["explanation_style"]
    parts.append(f"Explanation style setting: {style}.")

    return " ".join(parts)


def generate_tutor_response(question: str, context_block: str) -> str:
    """
    // API: Placeholder for Gemini 2.5 Flash for Tutor Response
    
    To wire in the real model:
        import google.generativeai as genai
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        model = genai.GenerativeModel("gemini-2.5-flash")
        resp = model.generate_content(f"{context_block}\\n\\nStudent question: {question}")
        return resp.text

    For local/demo purposes (no API key required), this returns a
    context-aware canned response so the full pipeline is testable end-to-end.
    """
    q_lower = question.lower()
    if "cochlea" in q_lower:
        if "non_visual" in context_block or "tactile" in context_block:
            return ("The cochlea is a spiral-shaped structure that curls inward, "
                    "narrowing as it winds toward its center - like a tightly coiled "
                    "rope. Sound vibrations travel through fluid inside it and get "
                    "converted into signals your brain reads as sound.")
        return ("The cochlea is a snail-shell-shaped structure in your inner ear. "
                "Sound vibrations travel through fluid inside it and get converted "
                "into electrical signals your brain reads as sound.")
    return (f"Here's what I can tell you about that: {question} "
            f"(this is a placeholder response - connect your Gemini API key "
            f"in generate_tutor_response() for real answers).")


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------

@app.post("/api/onboarding")
def submit_onboarding(payload: OnboardingPayload):
    conn = get_conn()
    c = conn.cursor()

    user_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO users (id, name, email, role, created_at) VALUES (?, ?, ?, 'student', ?)",
        (user_id, payload.name, None, datetime.utcnow().isoformat()),
    )

    explanation_style = derive_explanation_style(
        payload.onset_type, payload.age_of_onset, payload.residual_vision
    )

    c.execute(
        """
        INSERT INTO student_profiles
        (user_id, grade, preferred_language, onset_type, age_of_onset,
         braille_literacy, residual_vision, learning_mode, speech_speed,
         explanation_style, focus_areas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, payload.grade, payload.preferred_language,
            payload.onset_type, payload.age_of_onset,
            payload.braille_literacy, payload.residual_vision,
            payload.learning_mode, payload.speech_speed,
            explanation_style, None,
        ),
    )

    # Demo simplification: auto-enroll the new student into the first
    # available class, so a teacher's uploaded content is immediately
    # visible on the student's dashboard without a separate "join class"
    # flow. In production this would instead be an explicit teacher action
    # (adding a student roster) or a class code the student enters.
    existing_class = conn.execute("SELECT id FROM classes LIMIT 1").fetchone()
    if existing_class:
        conn.execute(
            "INSERT OR IGNORE INTO enrollments (class_id, student_id) VALUES (?, ?)",
            (existing_class["id"], user_id),
        )

    conn.commit()
    conn.close()

    return {
        "user_id": user_id,
        "explanation_style": explanation_style,
        "message": "Profile created successfully.",
    }


@app.get("/api/profile/{user_id}")
def get_profile(user_id: str):
    conn = get_conn()
    row = conn.execute(
        """
        SELECT u.name, u.role, p.*
        FROM users u LEFT JOIN student_profiles p ON u.id = p.user_id
        WHERE u.id = ?
        """,
        (user_id,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


# ---------------------------------------------------------------------------
# Tutor (always-listening chat endpoint)
# ---------------------------------------------------------------------------

@app.post("/api/tutor/ask")
def ask_tutor(payload: TutorAskPayload):
    conn = get_conn()
    profile = conn.execute(
        "SELECT * FROM student_profiles WHERE user_id = ?", (payload.student_id,)
    ).fetchone()
    conn.close()

    context_block = build_context_block(profile)
    answer = generate_tutor_response(payload.question, context_block)

    return {
        "question": payload.question,
        "answer": answer,
        "context_used": context_block,
    }


# ---------------------------------------------------------------------------
# Teacher: login/setup, content upload, quiz creation, dashboard stats
# ---------------------------------------------------------------------------

@app.post("/api/auth/register")
def register(payload: RegisterPayload):
    conn = get_conn()
    existing = conn.execute("SELECT id FROM users WHERE email = ? AND role = ?", (payload.email, payload.role)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Account with this email already exists.")

    user_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO users (id, name, email, password, mobile, school, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, payload.name, payload.email, payload.password, payload.mobile, payload.school, payload.role, datetime.utcnow().isoformat())
    )

    if payload.role == "teacher":
        class_id = str(uuid.uuid4())
        conn.execute("INSERT INTO classes (id, teacher_id, name, subject) VALUES (?, ?, 'Demo Class', 'General')", (class_id, user_id))
    elif payload.role == "student":
        default_class = conn.execute("SELECT id FROM classes LIMIT 1").fetchone()
        if default_class:
            conn.execute("INSERT OR IGNORE INTO enrollments (class_id, student_id) VALUES (?, ?)", (default_class["id"], user_id))

    conn.commit()
    conn.close()
    return {"user_id": user_id, "name": payload.name, "role": payload.role}

@app.post("/api/auth/login")
def login(payload: LoginPayload):
    conn = get_conn()
    # Simple prototype check
    user = conn.execute("SELECT * FROM users WHERE email = ? AND password = ? AND role = ?", (payload.email, payload.password, payload.role)).fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    return {"user_id": user["id"], "name": user["name"], "role": user["role"]}


@app.get("/api/teacher/{teacher_id}/classes")
def get_teacher_classes(teacher_id: str):
    conn = get_conn()
    rows = conn.execute("SELECT * FROM classes WHERE teacher_id = ?", (teacher_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/content/upload")
def upload_content(payload: ContentUploadPayload):
    conn = get_conn()
    content_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO content (id, class_id, teacher_id, title, subject, file_name, ocr_text, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (content_id, payload.class_id, payload.teacher_id, payload.title, payload.subject,
         payload.file_name, payload.ocr_text, datetime.utcnow().isoformat()),
    )
    # auto-create a lesson from the OCR'd text (mirrors your OCR -> lesson pipeline)
    lesson_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO lessons (id, content_id, title, transcript) VALUES (?, ?, ?, ?)",
        (lesson_id, content_id, payload.title, payload.ocr_text),
    )
    conn.commit()
    conn.close()
    return {"content_id": content_id, "lesson_id": lesson_id}


@app.post("/api/upload_file")
def upload_file(
    teacher_id: str = Form(...),
    class_id: str = Form(...),
    title: str = Form(...),
    subject: str = Form(...),
    file: UploadFile = File(...)
):
    # API: PyMuPDF is working here for PDF Text Extraction
    # API: Placeholder for PaddleOCR for image/handwriting extraction (Next phase)
    import fitz # PyMuPDF
    import tempfile
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name
        
    try:
        doc = fitz.open(tmp_path)
        ocr_text = ""
        for page in doc:
            ocr_text += page.get_text()
        doc.close()
    except Exception as e:
        ocr_text = "Could not extract text: " + str(e)
    finally:
        import os
        os.remove(tmp_path)
        
    conn = get_conn()
    content_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO content (id, class_id, teacher_id, title, subject, file_name, ocr_text, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (content_id, class_id, teacher_id, title, subject, file.filename, ocr_text, datetime.utcnow().isoformat()),
    )
    lesson_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO lessons (id, content_id, title, transcript) VALUES (?, ?, ?, ?)",
        (lesson_id, content_id, title, ocr_text),
    )
    conn.commit()
    conn.close()
    
    return {"content_id": content_id, "lesson_id": lesson_id, "extracted_text": ocr_text}


@app.post("/api/teacher/quiz")
def create_quiz(payload: QuizCreatePayload):
    conn = get_conn()
    quiz_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
        (quiz_id, payload.lesson_id, payload.title),
    )
    import json
    for q in payload.questions:
        conn.execute(
            "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), quiz_id, q["question_text"], json.dumps(q["options"]), q["correct_answer"]),
        )
    conn.commit()
    conn.close()
    return {"quiz_id": quiz_id}


@app.get("/api/teacher/{teacher_id}/dashboard")
def teacher_dashboard(teacher_id: str):
    conn = get_conn()
    classes = conn.execute("SELECT * FROM classes WHERE teacher_id = ?", (teacher_id,)).fetchall()
    class_ids = [c["id"] for c in classes]

    if not class_ids:
        conn.close()
        return {"classes": [], "assigned": 0, "students": 0, "completed": 0, "avg_score_pct": None, "recent_lessons": []}

    placeholders = ",".join("?" for _ in class_ids)

    students = conn.execute(
        f"SELECT COUNT(DISTINCT student_id) as n FROM enrollments WHERE class_id IN ({placeholders})",
        class_ids,
    ).fetchone()["n"]

    lessons = conn.execute(
        f"""SELECT l.id, l.title, cl.name as class_name FROM lessons l
            JOIN content ct ON l.content_id = ct.id
            JOIN classes cl ON ct.class_id = cl.id
            WHERE ct.class_id IN ({placeholders})
            ORDER BY ct.uploaded_at DESC""",
        class_ids,
    ).fetchall()

    quiz_ids = [q["id"] for q in conn.execute(
        f"""SELECT q.id FROM quizzes q JOIN lessons l ON q.lesson_id = l.id
            JOIN content ct ON l.content_id = ct.id WHERE ct.class_id IN ({placeholders})""",
        class_ids,
    ).fetchall()]

    completed = 0
    avg_score_pct = None
    if quiz_ids:
        qp = ",".join("?" for _ in quiz_ids)
        completed = conn.execute(
            f"SELECT COUNT(DISTINCT student_id) as n FROM quiz_attempts WHERE quiz_id IN ({qp})",
            quiz_ids,
        ).fetchone()["n"]

        attempts = conn.execute(
            f"""SELECT qa.score, (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = qa.quiz_id) as total
                FROM quiz_attempts qa WHERE qa.quiz_id IN ({qp})""",
            quiz_ids,
        ).fetchall()
        if attempts:
            pct_scores = [(a["score"] / a["total"]) * 100 for a in attempts if a["total"]]
            if pct_scores:
                avg_score_pct = round(sum(pct_scores) / len(pct_scores))

    recent_lessons = []
    for l in lessons[:5]:
        has_attempts = conn.execute(
            """SELECT 1 FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id
               WHERE q.lesson_id = ? LIMIT 1""",
            (l["id"],),
        ).fetchone()
        recent_lessons.append({
            "lesson_id": l["id"],
            "title": l["title"],
            "class_name": l["class_name"],
            "status": "Completed" if has_attempts else "Assigned",
        })

    conn.close()
    return {
        "classes": [dict(c) for c in classes],
        "assigned": students,
        "students": students,
        "completed": completed,
        "avg_score_pct": avg_score_pct,
        "recent_lessons": recent_lessons,
    }


# ---------------------------------------------------------------------------
# Student: lessons, quizzes, and progress (scoped to enrolled classes)
# ---------------------------------------------------------------------------

@app.get("/api/lessons")
def list_lessons():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM lessons").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/student/{student_id}/lessons")
def student_lessons(student_id: str):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT l.id, l.title, l.transcript, ct.subject
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        JOIN enrollments e ON e.class_id = ct.class_id
        WHERE e.student_id = ?
        """,
        (student_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/student/{student_id}/quizzes")
def student_quizzes(student_id: str):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT q.id as quiz_id, q.title, q.difficulty_level, l.title as lesson_title,
               (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND student_id = ?) as attempted
        FROM quizzes q
        JOIN lessons l ON q.lesson_id = l.id
        JOIN content ct ON l.content_id = ct.id
        JOIN enrollments e ON e.class_id = ct.class_id
        WHERE e.student_id = ?
        """,
        (student_id, student_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/student/{student_id}/progress")
def student_progress(student_id: str):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT qa.id, qa.score, qa.completed_at, q.title as quiz_title,
               (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ?
        ORDER BY qa.completed_at DESC
        """,
        (student_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Quiz
# ---------------------------------------------------------------------------

@app.get("/api/quiz/{quiz_id}")
def get_quiz(quiz_id: str):
    conn = get_conn()
    quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = conn.execute(
        "SELECT id, question_text, options FROM quiz_questions WHERE quiz_id = ?", (quiz_id,)
    ).fetchall()
    conn.close()
    return {"quiz": dict(quiz), "questions": [dict(q) for q in questions]}


@app.post("/api/quiz/attempt")
def submit_quiz_attempt(payload: QuizAnswerPayload):
    conn = get_conn()
    attempt_id = str(uuid.uuid4())
    correct_count = 0

    for a in payload.answers:
        q = conn.execute(
            "SELECT correct_answer FROM quiz_questions WHERE id = ?", (a["question_id"],)
        ).fetchone()
        is_correct = 1 if q and q["correct_answer"] == a["selected_answer"] else 0
        correct_count += is_correct
        conn.execute(
            """
            INSERT INTO student_answers (id, attempt_id, question_id, selected_answer, is_correct)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), attempt_id, a["question_id"], a["selected_answer"], is_correct),
        )

    score = correct_count
    conn.execute(
        """
        INSERT INTO quiz_attempts (id, quiz_id, student_id, score, completed_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (attempt_id, payload.quiz_id, payload.student_id, score, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()

    return {"attempt_id": attempt_id, "score": score, "total": len(payload.answers)}


# ---------------------------------------------------------------------------
# Dev seed endpoint - creates a sample class/lesson/quiz so the frontend has
# something to show immediately without manual setup
# ---------------------------------------------------------------------------

@app.post("/api/dev/seed")
def seed_demo_data():
    conn = get_conn()
    c = conn.cursor()

    teacher_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, 'Ms. Rao', 'demo@school.com', 'password', 'teacher', ?)",
        (teacher_id, datetime.utcnow().isoformat()),
    )

    class_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO classes (id, teacher_id, name, subject) VALUES (?, ?, '7th Grade Science', 'Science')",
        (class_id, teacher_id),
    )

    content_id = str(uuid.uuid4())
    ocr_text = ("The cochlea is a spiral shaped part of the inner ear that converts "
                "sound vibrations into nerve signals sent to the brain.")
    c.execute(
        """INSERT INTO content (id, class_id, teacher_id, title, file_name, ocr_text, uploaded_at)
           VALUES (?, ?, ?, 'Ear Anatomy Chapter 3', 'ear_anatomy.pdf', ?, ?)""",
        (content_id, class_id, teacher_id, ocr_text, datetime.utcnow().isoformat()),
    )

    lesson_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO lessons (id, content_id, title, transcript) VALUES (?, ?, 'The Cochlea', ?)",
        (lesson_id, content_id, ocr_text),
    )

    quiz_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, 'Ear Anatomy Quiz', 'medium')",
        (quiz_id, lesson_id),
    )

    import json
    questions = [
        ("Which part of the ear detects vibrations?",
         ["Eardrum", "Ossicles", "Cochlea", "Ear Canal"], "Cochlea"),
        ("What shape is the cochlea?",
         ["Square", "Spiral", "Flat", "Triangular"], "Spiral"),
    ]
    for q_text, options, correct in questions:
        c.execute(
            "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), quiz_id, q_text, json.dumps(options), correct),
        )
    conn.commit()
    conn.close()
    return {"message": "Demo data seeded successfully."}

# ---------------------------------------------------------------------------
# Piper TTS (Text-to-Speech) API Endpoint
# ---------------------------------------------------------------------------

PIPER_MODEL_PATH = os.path.join(os.path.dirname(__file__), "en_US-lessac-medium.onnx")
PIPER_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "en_US-lessac-medium.onnx.json")

def ensure_piper_model():
    if not os.path.exists(PIPER_MODEL_PATH):
        print("Downloading Piper TTS model (en_US-lessac-medium)...")
        urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true", PIPER_MODEL_PATH)
    if not os.path.exists(PIPER_CONFIG_PATH):
        urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true", PIPER_CONFIG_PATH)

class TTSPayload(BaseModel):
    text: str

@app.post("/api/tts")
def generate_tts(payload: TTSPayload):
    # API: PiperTTS is working here for Text-to-Speech
    ensure_piper_model()
    
    import subprocess
    import sys
    
    # Create a temporary file for the wav output
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    
    try:
        # We use python -m piper instead of the python bindings to avoid ONNX thread-locking issues on Windows
        process = subprocess.run(
            [sys.executable, "-m", "piper", "-m", PIPER_MODEL_PATH, "-c", PIPER_CONFIG_PATH, "-f", path],
            input=payload.text.encode("utf-8"),
            capture_output=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print("Piper CLI Error:", e.stderr.decode("utf-8"))
        raise HTTPException(status_code=500, detail="Failed to generate audio")
        
    return FileResponse(path, media_type="audio/wav")

@app.get("/")
def root():
    return {"status": "AI Learn backend running", "docs": "/docs"}

