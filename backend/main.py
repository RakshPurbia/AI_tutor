"""
AI Learn - Backend (FastAPI + SQLite, runs fully on localhost, no cloud dependency)

Run with:
    pip install fastapi uvicorn --break-system-packages
    uvicorn main:app --reload --port 8000
"""

import psycopg2
import psycopg2.extras
import uuid
import os
from dotenv import load_dotenv
load_dotenv()

AI_SERVER_URL = os.environ.get("AI_SERVER_URL", "http://127.0.0.1:11434/api/generate")
AI_MODEL_NAME = os.environ.get("AI_MODEL_NAME", "llama3")

from datetime import datetime
from typing import Optional, List
import urllib.request
import tempfile
from fastapi.responses import FileResponse

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_URL = "postgresql://tsdbadmin:q93ykcz5vxvx20en@ceadio0qai.sln6s0n1l4.db.ghost.build:5432/tsdb?sslmode=require"

app = FastAPI(title="AI Learn Backend")

# Allow the Next.js frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

class PgConnWrapper:
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
    color_blind: Optional[bool] = False


class TutorAskPayload(BaseModel):
    student_id: str
    question: str
    page_context: Optional[str] = None


class QuizAnswerPayload(BaseModel):
    student_id: str
    quiz_id: str
    answers: List[dict]  # [{question_id, selected_answer}]


class ContentUploadPayload(BaseModel):
    teacher_id: str
    student_ids: List[str]
    class_id: Optional[str] = None
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
    lesson_title: str
    title: str
    student_ids: List[str]
    questions: List[dict]  # [{question_text, options: [...], correct_answer}]

class AIExtractPayload(BaseModel):
    transcript: str
    step: int

class DiagnosticPayload(BaseModel):
    student_id: str
    grade: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def derive_explanation_style(onset_type, age_of_onset, residual_vision, color_blind=False) -> str:
    """
    Derive the core personalization rule based on actual vision level.
    """
    if residual_vision == "none":
        return "audio_first_total_blindness"
    if residual_vision == "low_vision":
        return "visual_accessibility_low_vision"
    if color_blind:
        return "color_safe_deficiency"
    return "standard_accessible"


def build_context_block(profile_row, recent_quizzes, recent_lessons) -> str:
    """
    Converts a stored student profile and their recent history into the short natural-language
    context block injected into the tutor LLM's system prompt.
    """
    if profile_row is None:
        return "No learner profile on file. Use plain, accessible, audio-first language."

    parts = []
    
    residual_vision = profile_row.get("residual_vision") if type(profile_row) is dict else profile_row["residual_vision"]
    color_blind = profile_row.get("color_blind") if type(profile_row) is dict else profile_row["color_blind"]
    
    if residual_vision == "none":
        parts.append("This student has total blindness.")
        parts.append("Do NOT use visual analogies (color, shape-by-sight, 'imagine looking at').")
        parts.append("Use tactile, spatial-by-touch, and sequential/auditory analogies instead.")
        parts.append("FORMAT REQUIREMENT: The output will be read aloud via Text-to-Speech (audio-only). Keep the response conversational, clear, and DO NOT use any visual formatting (tables, bullet points, markdown).")
    elif residual_vision == "low_vision":
        parts.append("This student has low vision.")
        parts.append("Use high-contrast descriptions and focus on large shapes/bold concepts rather than fine visual details.")
    elif color_blind:
        parts.append("This student has a color vision deficiency.")
        parts.append("Do NOT use color as the primary differentiator; rely on patterns, textures, and labels instead.")
    else:
        parts.append("This student uses standard accessible language.")

    braille = profile_row.get("braille_literacy") if type(profile_row) is dict else profile_row["braille_literacy"]
    if braille:
        parts.append(f"Braille literacy: {braille}.")

    style = profile_row.get("explanation_style") if type(profile_row) is dict else profile_row["explanation_style"]
    parts.append(f"Explanation style setting: {style}.")
    
    if recent_quizzes:
        parts.append("\nRecent Quiz Performance:")
        for q in recent_quizzes:
            title = q.get("title") if type(q) is dict else q["title"]
            score = q.get("score") if type(q) is dict else q["score"]
            total = q.get("total") if type(q) is dict else q["total"]
            parts.append(f"- '{title}': scored {score}/{total}")
        parts.append("Use this to encourage the student or suggest reviewing specific topics.")
        
    if recent_lessons:
        parts.append("\nRecent Lessons:")
        for idx, l in enumerate(recent_lessons):
            title = l.get("title") if type(l) is dict else l["title"]
            transcript = l.get("transcript") if type(l) is dict else l["transcript"]
            label = "Latest Lesson" if idx == 0 else "Previous Lesson"
            parts.append(f"--- {label}: {title} ---")
            transcript_snippet = transcript[:1500] if transcript else ""
            parts.append(transcript_snippet)

    return "\n".join(parts)


def generate_tutor_response(question: str, context_block: str) -> str:
    """
    Connects to configured local AI instance. Falls back to mock if unavailable.
    """
    import urllib.request
    import json
    
    system_prompt = f"You are an AI teaching assistant. Keep answers brief, under 3 sentences if possible.\n{context_block}"
    prompt = f"Student question: {question}\nProvide a helpful, concise response."
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\n{prompt}",
            "stream": False
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=60) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                return resp_data.get("response", "I'm not sure how to answer that.")
    except Exception as e:
        print("AI connection failed (is it running?):", e)
        pass # fallback

    # Fallback to mock for testing
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
    if "recap" in q_lower or "last lesson" in q_lower:
        return "In our last lesson, we talked about Ear Anatomy, specifically the Cochlea and how it helps us hear."
        
    if "hi" in q_lower or "hello" in q_lower or "hey" in q_lower:
        return "Hi there! I am your AI Tutor. Since the local AI model isn't running right now, my responses are a bit limited. But you can ask me about 'the cochlea' or for a 'recap' of our last lesson!"
        
    return (f"I heard you ask: '{question}'. "
            f"(Fallback response: Local AI model at {AI_SERVER_URL} could not be reached).")

def generate_quiz_from_text(text: str) -> List[dict]:
    import urllib.request
    import json
    import re
    
    system_prompt = "You are an AI teaching assistant. Given the following lesson text, generate 3 multiple-choice questions. Return ONLY a JSON array of objects. Each object must have 'question_text', 'options' (an array of 4 strings), and 'correct_answer' (must match one of the options exactly). Do not include any markdown formatting, only valid JSON."
    
    prompt = f"Lesson text:\n{text[:3000]}"
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\n{prompt}",
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=120) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "[]")
                # Try to extract JSON array if there's markdown wrapping
                match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if match:
                    response_text = match.group(0)
                questions = json.loads(response_text)
                if isinstance(questions, list) and len(questions) > 0:
                    return questions
    except Exception as e:
        print("AI Quiz Generation failed:", e)
        pass
        
    return []


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
        payload.onset_type, payload.age_of_onset, payload.residual_vision, payload.color_blind
    )

    c.execute(
        """
        INSERT INTO student_profiles
        (user_id, grade, preferred_language, onset_type, age_of_onset,
         braille_literacy, residual_vision, learning_mode, speech_speed,
         explanation_style, focus_areas, color_blind)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, payload.grade, payload.preferred_language,
            payload.onset_type, payload.age_of_onset,
            payload.braille_literacy, payload.residual_vision,
            payload.learning_mode, payload.speech_speed,
            explanation_style, None, payload.color_blind
        ),
    )

    existing_class = conn.execute("SELECT id FROM classes LIMIT 1").fetchone()
    if existing_class:
        class_id = existing_class.get("id") if type(existing_class) is dict else existing_class["id"]
        conn.execute(
            "INSERT OR IGNORE INTO enrollments (class_id, student_id) VALUES (?, ?)",
            (class_id, user_id),
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

@app.post("/api/parse_voice_data")
def extract_onboarding(payload: AIExtractPayload):
    import urllib.request
    import json
    import re
    
    if payload.step == 2:
        system_prompt = "You are an AI extracting user details from spoken text. Extract 'name' (string), 'age' (integer or string), and 'grade' (string, e.g., '12th Grade', 'Class 10'). Return ONLY a valid JSON object. Do not wrap in markdown."
    elif payload.step == 3:
        system_prompt = "You are an AI extracting details about visual impairment from spoken text. Extract 'age_of_onset' (integer) and 'residual_vision' (string: 'none', 'light_perception', or 'low_vision'). If they say they can partially see, it is 'low_vision'. If they only see light, it is 'light_perception'. Return ONLY a valid JSON object. Do not wrap in markdown."
    elif payload.step == 4:
        system_prompt = "You are an AI extracting details about learning preferences from spoken text. Extract 'learning_mode' (string: 'mostly_audio', 'voice', 'audio_text', or 'ai') and 'speech_speed' (string: 'slow', 'normal', or 'fast'). Return ONLY a valid JSON object. Do not wrap in markdown."
    elif payload.step == 5:
        system_prompt = "You are an AI extracting support preferences from spoken text. Extract 'support_type' (string: 'vision', 'audio', 'text', 'other', or 'none'). Return ONLY a valid JSON object. Do not wrap in markdown."
    else:
        return {}

    prompt = f"Transcript:\n{payload.transcript}"
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\n{prompt}",
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=60) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "{}")
                match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if match:
                    response_text = match.group(0)
                return json.loads(response_text)
    except Exception as e:
        print("AI Extraction failed:", e)
        
    return {}

@app.post("/api/onboarding/diagnostic")
def generate_diagnostic(payload: DiagnosticPayload):
    import urllib.request
    import json
    import re
    
    # parse grade to target one below
    match = re.search(r'\d+', payload.grade)
    if match:
        current_grade = int(match.group(0))
        target_grade = current_grade - 1 if current_grade > 1 else current_grade
    else:
        target_grade = "previous"
        
    system_prompt = f"You are an AI generating a diagnostic quiz for a student entering {payload.grade}. Generate 10 multiple-choice questions assessing foundational knowledge from grade {target_grade} science. Return ONLY a JSON array of objects. Each object must have 'question_text', 'options' (array of 4 strings), and 'correct_answer'."
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": system_prompt,
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=120) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "[]")
                match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if match:
                    response_text = match.group(0)
                questions = json.loads(response_text)
                
                # Save to DB
                conn = get_conn()
                class_id = conn.execute("SELECT id FROM classes LIMIT 1").fetchone()["id"]
                content_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO content (id, class_id, title, subject) VALUES (?, ?, 'Diagnostic Assessment Content', 'Science')",
                    (content_id, class_id)
                )
                lesson_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO lessons (id, content_id, title, transcript) VALUES (?, ?, 'Diagnostic Assessment', 'Diagnostic assessment')",
                    (lesson_id, content_id)
                )
                
                quiz_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
                    (quiz_id, lesson_id, f"Grade {target_grade} Diagnostic Quiz")
                )
                
                for q in questions:
                    q_text = q.get("question_text", "Generated Question")
                    options = q.get("options", ["A", "B", "C", "D"])
                    correct = q.get("correct_answer", options[0] if options else "")
                    conn.execute(
                        "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), quiz_id, q_text, json.dumps(options), correct)
                    )
                
                # Link attempt if necessary or just return quiz_id
                conn.commit()
                conn.close()
                return {"quiz_id": quiz_id, "questions_generated": len(questions)}
    except Exception as e:
        print("Diagnostic Generation failed:", e)
        
    return {"error": "Failed to generate diagnostic"}


# ---------------------------------------------------------------------------
# Tutor (always-listening chat endpoint)
# ---------------------------------------------------------------------------

@app.post("/api/tutor/ask")
def ask_tutor(payload: TutorAskPayload):
    conn = get_conn()
    profile = conn.execute(
        "SELECT * FROM student_profiles WHERE user_id = ?", (payload.student_id,)
    ).fetchone()
    
    recent_quizzes = conn.execute(
        """
        SELECT qa.score, q.title, 
               (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ?
        ORDER BY qa.completed_at DESC LIMIT 3
        """, (payload.student_id,)
    ).fetchall()
    
    recent_lessons = conn.execute(
        """
        SELECT l.title, l.transcript, ct.subject, ct.uploaded_at
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        JOIN enrollments e ON e.class_id = ct.class_id
        WHERE e.student_id = ?
        ORDER BY ct.uploaded_at DESC LIMIT 2
        """, (payload.student_id,)
    ).fetchall()
    context_block = build_context_block(profile, recent_quizzes, recent_lessons)

    # 3. Upcoming learning modules & Progress tracking
    completed_lessons = conn.execute(
        """
        SELECT l.title
        FROM student_lesson_progress slp
        JOIN lessons l ON slp.lesson_id = l.id
        WHERE slp.student_id = ? AND slp.status = 'completed'
        ORDER BY slp.completed_at DESC LIMIT 3
        """, (payload.student_id,)
    ).fetchall()
    
    current_lesson = conn.execute(
        """
        SELECT l.id, l.title, l.sequence_order, l.transcript
        FROM student_lesson_progress slp
        JOIN lessons l ON slp.lesson_id = l.id
        WHERE slp.student_id = ? AND slp.status = 'in_progress'
        ORDER BY slp.last_accessed_at DESC LIMIT 1
        """, (payload.student_id,)
    ).fetchone()
    
    upcoming_lessons = []
    if current_lesson:
        seq = current_lesson.get('sequence_order', 0) if type(current_lesson) is dict else current_lesson['sequence_order']
        upcoming_lessons = conn.execute(
            """
            SELECT l.title
            FROM lessons l
            JOIN content ct ON l.content_id = ct.id
            JOIN enrollments e ON ct.class_id = e.class_id
            WHERE e.student_id = ? AND l.sequence_order > ?
            ORDER BY l.sequence_order ASC LIMIT 2
            """, (payload.student_id, seq)
        ).fetchall()
    else:
        upcoming_lessons = conn.execute(
            """
            SELECT l.title
            FROM lessons l
            JOIN content ct ON l.content_id = ct.id
            JOIN enrollments e ON ct.class_id = e.class_id
            WHERE e.student_id = ? AND l.id NOT IN (
                SELECT lesson_id FROM student_lesson_progress WHERE student_id = ? AND status = 'completed'
            )
            ORDER BY l.sequence_order ASC LIMIT 3
            """, (payload.student_id, payload.student_id)
        ).fetchall()
        
    conn.close()
    
    context_block += "\n\n[CURRICULUM PROGRESS TRACKING]\n"
    if completed_lessons:
        titles = [l['title'] if type(l) is dict else l[0] for l in completed_lessons]
        context_block += f"Completed lessons: {', '.join(titles)}\n"
    if current_lesson:
        title = current_lesson.get('title') if type(current_lesson) is dict else current_lesson['title']
        context_block += f"Current active lesson: {title}\n"
    if upcoming_lessons:
        titles = [l['title'] if type(l) is dict else l[0] for l in upcoming_lessons]
        context_block += f"Upcoming lessons (Next to take): {', '.join(titles)}\n"

    
    if payload.page_context == "/dashboard":
        context_block += "\n[SYSTEM NOTE: The student is currently on their Dashboard. The 'Recent Lessons' listed above are actively displayed to them. If they say 'continue my lesson' or similar, recommend one of those lessons.]"
        
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
        "INSERT INTO users (id, name, email, password_hash, mobile, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, payload.name, payload.email, payload.password, payload.mobile, payload.role, datetime.utcnow().isoformat())
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
    user = conn.execute("SELECT * FROM users WHERE email = ? AND password_hash = ? AND role = ?", (payload.email, payload.password, payload.role)).fetchone()
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

@app.get("/api/teacher/{teacher_id}/students")
def get_teacher_students(teacher_id: str):
    conn = get_conn()
    # Ignore class, get all students
    rows = conn.execute("""
        SELECT u.id, u.name, sp.onset_type, sp.residual_vision, sp.color_blind 
        FROM users u
        LEFT JOIN student_profiles sp ON u.id = sp.user_id 
        WHERE u.role = 'student'
    """).fetchall()
        
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/content/upload")
def upload_content(payload: ContentUploadPayload):
    conn = get_conn()
    first_lesson_id = None
    
    for student_id in payload.student_ids:
        content_id = str(uuid.uuid4())
        
        # Check student profile
        profile = conn.execute("SELECT residual_vision, color_blind, onset_type FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
        
        # 1. AI Personalization (Mocked for prototype)
        base_text = payload.ocr_text
        if profile:
            if profile.get('residual_vision') == 'none' or profile.get('onset_type') == 'congenital':
                # Kshitij: Total Loss
                base_text = "Tactile & Spatial Focus: The heart is like a house with four rooms. The top rooms collect blood, and the bottom rooms pump it out. " + base_text
            elif profile.get('color_blind'):
                # Aarav: Color Blind
                base_text = "Pattern Focus: The left side handles oxygen-rich blood, marked with a striped pattern. " + base_text
            elif profile.get('residual_vision') == 'low_vision':
                # Rudraksh: Partial Sight
                base_text = "High Contrast Focus: Notice the large, bold shapes without focusing on fine details. " + base_text
                
        conn.execute(
            """
            INSERT INTO content (id, student_id, class_id, teacher_id, title, subject, file_name, ocr_text, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (content_id, student_id, payload.class_id, payload.teacher_id, payload.title, payload.subject,
             payload.file_name, payload.ocr_text, datetime.utcnow().isoformat()),
        )
        
        # 2. Chunking Logic (Part A, Part B, Part C)
        parts = ["Part A: Overview", "Part B: Chambers", "Part C: Blood Flow"]
        
        import json
        lesson_ids = [str(uuid.uuid4()) for _ in range(3)]
        if not first_lesson_id:
            first_lesson_id = lesson_ids[0]
        
        for i in range(3):
            l_id = lesson_ids[i]
            next_l_id = lesson_ids[i+1] if i < 2 else None
            title = f"{payload.title} - {parts[i]}"
            chunk_text = f"[{parts[i]}] {base_text} - Details for {parts[i]}."
            
            conn.execute(
                "INSERT INTO lessons (id, content_id, title, transcript, sequence_order, next_lesson_id) VALUES (?, ?, ?, ?, ?, ?)",
                (l_id, content_id, title, chunk_text, i+1, next_l_id),
            )
            
            # Auto-create quiz for this chunk
            quiz_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
                (quiz_id, l_id, f"Quiz: {title}"),
            )
            
            # Add 1 question to the quiz
            q_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                (q_id, quiz_id, f"What did we learn in {parts[i]}?", json.dumps(["Option 1", "Option 2", "Option 3", "Option 4"]), "Option 1"),
            )
            
    conn.commit()
    conn.close()
    return {"message": "Assigned successfully", "lesson_id": first_lesson_id}


@app.post("/api/upload_file")
def upload_file(
    teacher_id: str = Form(...),
    student_id: str = Form(None),
    class_id: str = Form(None),
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
    
    # Check student profile
    profile = conn.execute("SELECT residual_vision, color_blind, onset_type FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
    
    # 1. AI Personalization (Mocked for prototype)
    base_text = ocr_text
    if profile:
        if profile.get('residual_vision') == 'none' or profile.get('onset_type') == 'congenital':
            # Kshitij: Total Loss
            base_text = "Tactile & Spatial Focus: The heart is like a house with four rooms. The top rooms collect blood, and the bottom rooms pump it out. " + base_text
        elif profile.get('color_blind'):
            # Aarav: Color Blind
            base_text = "Pattern Focus: The left side handles oxygen-rich blood, marked with a striped pattern. " + base_text
        elif profile.get('residual_vision') == 'low_vision':
            # Rudraksh: Partial Sight
            base_text = "High Contrast Focus: Notice the large, bold shapes without focusing on fine details. " + base_text
            
    conn.execute(
        """
        INSERT INTO content (id, student_id, class_id, teacher_id, title, subject, file_name, ocr_text, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (content_id, student_id, class_id, teacher_id, title, subject, file.filename, ocr_text, datetime.utcnow().isoformat()),
    )
    
    # 2. Chunking Logic (Part A, Part B, Part C)
    parts = ["Part A: Overview", "Part B: Chambers", "Part C: Blood Flow"]
    lesson_ids = [str(uuid.uuid4()) for _ in range(3)]
    first_lesson_id = lesson_ids[0]
    
    import json
    for i in range(3):
        l_id = lesson_ids[i]
        next_l_id = lesson_ids[i+1] if i < 2 else None
        chunk_title = f"{title} - {parts[i]}"
        chunk_text = f"[{parts[i]}] {base_text} - Details for {parts[i]}."
        
        conn.execute(
            "INSERT INTO lessons (id, content_id, title, transcript, sequence_order, next_lesson_id) VALUES (?, ?, ?, ?, ?, ?)",
            (l_id, content_id, chunk_title, chunk_text, i+1, next_l_id),
        )
        
        quiz_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
            (quiz_id, l_id, f"Quiz: {chunk_title}"),
        )
        
        q_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
            (q_id, quiz_id, f"What did we learn in {parts[i]}?", json.dumps(["Option 1", "Option 2", "Option 3", "Option 4"]), "Option 1"),
        )
        
    conn.commit()
    conn.close()
    
    return {"content_id": content_id, "lesson_id": first_lesson_id, "extracted_text": ocr_text}


@app.post("/api/teacher/quiz")
def create_quiz(payload: QuizCreatePayload):
    conn = get_conn()
    
    questions = payload.questions
    if not questions:
        # Fetch lesson transcript to generate questions
        lesson = conn.execute("SELECT transcript FROM lessons WHERE id = ?", (payload.lesson_id,)).fetchone()
        if lesson and lesson.get("transcript"):
            ai_questions = generate_quiz_from_text(lesson["transcript"])
            if ai_questions:
                questions = ai_questions

    quiz_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
        (quiz_id, payload.lesson_id, payload.title),
    )
    import json
    for q in questions:
        # Fallback for poorly formatted AI questions
        q_text = q.get("question_text", "Generated Question")
        options = q.get("options", ["A", "B", "C", "D"])
        correct = q.get("correct_answer", options[0] if options else "")
        conn.execute(
            "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), quiz_id, q_text, json.dumps(options), correct),
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
        """SELECT l.id, l.title, 
                  COALESCE((SELECT name FROM users WHERE id = ct.student_id), cl.name) as class_name 
           FROM lessons l
           JOIN content ct ON l.content_id = ct.id
           LEFT JOIN classes cl ON ct.class_id = cl.id
           WHERE ct.teacher_id = ?
           ORDER BY ct.uploaded_at DESC""",
        (teacher_id,)
    ).fetchall()

    quiz_ids = [q["id"] for q in conn.execute(
        """SELECT q.id FROM quizzes q 
           JOIN lessons l ON q.lesson_id = l.id
           JOIN content ct ON l.content_id = ct.id 
           WHERE ct.teacher_id = ?""",
        (teacher_id,)
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


@app.get("/api/teacher/{teacher_id}/students-progress")
def teacher_students_progress(teacher_id: str):
    conn = get_conn()
    
    # Ignore class, get all students
    students = conn.execute("SELECT id, name FROM users WHERE role = 'student'").fetchall()
        
    results = []
    
    for st in students:
        s_id = st["id"]
        s_name = st["name"]
        
        # Get class name
        c_row = conn.execute(
            """
            SELECT c.name FROM classes c
            JOIN enrollments e ON c.id = e.class_id
            WHERE e.student_id = ? LIMIT 1
            """, (s_id,)
        ).fetchone()
        class_name = c_row["name"] if c_row else "Unassigned"
        
        # Check assignment/quiz completion
        # Fetch their latest quiz attempt to see if they got anything wrong
        # To make it realistic for the demo, we check student_answers
        recent_quiz_attempt = conn.execute(
            """
            SELECT qa.id, qa.score, 
                   (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = qa.quiz_id) as total_q
            FROM quiz_attempts qa
            WHERE qa.student_id = ?
            ORDER BY qa.completed_at DESC LIMIT 1
            """, (s_id,)
        ).fetchone()
        
        assignment_done = bool(recent_quiz_attempt)
        quiz_done = bool(recent_quiz_attempt)
        remark = "No assignments completed yet."
        
        if recent_quiz_attempt:
            attempt_id = recent_quiz_attempt["id"]
            incorrect = conn.execute(
                """
                SELECT qq.question_text 
                FROM student_answers sa 
                JOIN quiz_questions qq ON sa.question_id = qq.id
                WHERE sa.attempt_id = ? AND sa.is_correct = FALSE LIMIT 1
                """, (attempt_id,)
            ).fetchone()
            
            if incorrect:
                incorrect_q = incorrect["question_text"]
                remark = f"Got a problem in: '{incorrect_q}'. Needs more revision input."
            else:
                remark = "Excellent progress, concepts are clear."
                
        results.append({
            "id": s_id,
            "name": s_name,
            "class_name": class_name,
            "assignment_done": assignment_done,
            "quiz_done": quiz_done,
            "remark": remark
        })
        
    conn.close()
    return results

# Parent: view linked student's dashboard stats
@app.get("/api/parent/{parent_id}/dashboard")
def parent_dashboard(parent_id: str):
    conn = get_conn()
    
    # Get the linked student
    link = conn.execute("SELECT student_id FROM parent_student_links WHERE parent_id = ?", (parent_id,)).fetchone()
    if not link:
        conn.close()
        return {"error": "No student linked"}
        
    student_id = link["student_id"]
    
    # Get student name
    student = conn.execute("SELECT name FROM users WHERE id = ?", (student_id,)).fetchone()
    student_name = student["name"] if student else "Student"
    
    # Get total enrolled classes for lessons context
    enrollments = conn.execute("SELECT class_id FROM enrollments WHERE student_id = ?", (student_id,)).fetchall()
    class_ids = [e["class_id"] for e in enrollments]
    
    lessons_completed = 0
    avg_score_pct = 0
    total_study_time = "0m"
    streak = "0"
    
    if class_ids:
        placeholders = ",".join("?" for _ in class_ids)
        # Lessons completed (we can approximate this by quizzes attempted, or just use quiz attempts as proxy)
        quiz_ids = [q["id"] for q in conn.execute(
            f"""SELECT q.id FROM quizzes q JOIN lessons l ON q.lesson_id = l.id
                JOIN content ct ON l.content_id = ct.id WHERE ct.class_id IN ({placeholders})""",
            class_ids,
        ).fetchall()]
        
        if quiz_ids:
            qp = ",".join("?" for _ in quiz_ids)
            attempts = conn.execute(
                f"""SELECT qa.score, (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = qa.quiz_id) as total
                    FROM quiz_attempts qa WHERE qa.student_id = ? AND qa.quiz_id IN ({qp})""",
                [student_id] + quiz_ids,
            ).fetchall()
            
            if attempts:
                lessons_completed = len(attempts)
                pct_scores = [(a["score"] / a["total"]) * 100 for a in attempts if a["total"]]
                if pct_scores:
                    avg_score_pct = round(sum(pct_scores) / len(pct_scores))
                    
                total_study_time = f"{len(attempts) * 15}m" # fake proxy
                streak = "1 🔥"
                
    conn.close()
    return {
        "student_name": student_name,
        "lessons_completed": lessons_completed,
        "avg_score_pct": avg_score_pct,
        "total_study_time": total_study_time,
        "streak": streak
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
        SELECT DISTINCT l.id, l.title, l.transcript, ct.subject
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        WHERE ct.student_id = ? OR e.student_id = ?
        """,
        (student_id, student_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/student/{student_id}/lessons/{lesson_id}/complete")
def complete_lesson(student_id: str, lesson_id: str):
    conn = get_conn()
    
    # Check if a record already exists
    record = conn.execute(
        "SELECT status FROM student_lesson_progress WHERE student_id = ? AND lesson_id = ?",
        (student_id, lesson_id)
    ).fetchone()
    
    now = datetime.now()
    if record:
        conn.execute(
            """
            UPDATE student_lesson_progress 
            SET status = 'completed', progress_percentage = 100, completed_at = ?, last_accessed_at = ?
            WHERE student_id = ? AND lesson_id = ?
            """,
            (now, now, student_id, lesson_id)
        )
    else:
        conn.execute(
            """
            INSERT INTO student_lesson_progress (student_id, lesson_id, status, progress_percentage, completed_at, last_accessed_at)
            VALUES (?, ?, 'completed', 100, ?, ?)
            """,
            (student_id, lesson_id, now, now)
        )
        
    # Also mark next lesson as in_progress if it exists
    current_lesson = conn.execute("SELECT sequence_order FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    if current_lesson:
        seq = current_lesson["sequence_order"]
        # Find next lesson in the same class... this requires joining content
        # For simplicity, just get the next sequence order lesson that the student is enrolled in
        next_lesson = conn.execute(
            """
            SELECT l.id FROM lessons l
            JOIN content ct ON l.content_id = ct.id
            JOIN enrollments e ON ct.class_id = e.class_id
            WHERE e.student_id = ? AND l.sequence_order > ?
            ORDER BY l.sequence_order ASC LIMIT 1
            """,
            (student_id, seq)
        ).fetchone()
        
        if next_lesson:
            nl_id = next_lesson["id"]
            nl_record = conn.execute(
                "SELECT status FROM student_lesson_progress WHERE student_id = ? AND lesson_id = ?",
                (student_id, nl_id)
            ).fetchone()
            if not nl_record:
                conn.execute(
                    """
                    INSERT INTO student_lesson_progress (student_id, lesson_id, status, progress_percentage, last_accessed_at)
                    VALUES (?, ?, 'in_progress', 0, ?)
                    """,
                    (student_id, nl_id, now)
                )

    conn.commit()
    conn.close()
    return {"status": "success", "message": "Lesson marked as complete."}


@app.get("/api/student/{student_id}/quizzes")
def student_quizzes(student_id: str):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT q.id as quiz_id, q.title, q.difficulty_level, l.title as lesson_title,
               (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND student_id = ?) as attempted
        FROM quizzes q
        JOIN lessons l ON q.lesson_id = l.id
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        WHERE ct.student_id = ? OR e.student_id = ?
        """,
        (student_id, student_id, student_id),
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
        is_correct = True if q and q["correct_answer"] == a["selected_answer"] else False
        correct_count += 1 if is_correct else 0
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
        "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, 'Ms. Rao', 'demo@school.com', 'password', 'teacher', ?)",
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

@app.get("/api/tutor/progress/{student_id}")
def tutor_progress(student_id: str):
    conn = get_conn()
    
    # 1. Fetch completed quizzes
    quizzes = conn.execute(
        """
        SELECT q.title, qa.score, 
               (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as total
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ?
        ORDER BY qa.completed_at DESC
        LIMIT 5
        """, (student_id,)
    ).fetchall()
    
    # 2. Fetch next upcoming lesson
    upcoming = conn.execute(
        """
        SELECT l.title 
        FROM lessons l
        JOIN content c ON l.content_id = c.id
        WHERE c.student_id = ? 
          AND l.id NOT IN (
              SELECT q.lesson_id FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = ?
          )
        ORDER BY c.uploaded_at ASC, l.sequence_order ASC
        LIMIT 1
        """, (student_id, student_id)
    ).fetchone()
    
    conn.close()
    
    response_text = "Here is your progress update. "
    if quizzes:
        response_text += "Recently, you completed "
        for q in quizzes:
            title = q["title"].replace("Quiz: ", "")
            score = q["score"]
            total = q["total"]
            response_text += f"the {title} quiz with a score of {score} out of {total}, "
    else:
        response_text += "You haven't completed any quizzes yet. "
        
    if upcoming:
        response_text += f". Your next upcoming module is {upcoming['title']}."
    else:
        response_text += ". You have no new modules assigned right now."
        
    return {"message": response_text}
