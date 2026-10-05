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
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

from datetime import datetime
from typing import Optional, List, Union
import urllib.request
import tempfile
from fastapi.responses import FileResponse

from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_URL = "postgresql://neondb_owner:npg_pHOmL2cQU1Zf@ep-falling-voice-b50sod4i.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

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

class UpdateLessonPayload(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    transcript: Optional[str] = None
    student_id: Optional[str] = None
    class_id: Optional[str] = None

class TeacherLoginPayload(BaseModel):
    name: str

class StudentLoginPayload(BaseModel):
    name: str

class AIExtractPayload(BaseModel):
    transcript: str
    step: Union[int, float]

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
    parts = []
    if profile_row is None:
        parts.append("No learner profile on file. Use plain, accessible, audio-first language.")
    else:
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



def classify_intent(question: str) -> dict:
    import urllib.request
    import json
    import re
    
    system_prompt = (
        "You are an AI intent classifier. Classify the user's question into one of these intents: "
        "'query_score' (asking about quiz marks/results), "
        "'query_quiz_status' (asking how many quizzes are left or completed), "
        "'query_progress' (asking about lesson progress, what's next, or curriculum status), "
        "'navigate' (asking to go to a specific page like dashboard, lessons, quizzes, tutor, progress, history, profile, settings), "
        "'switch_voice' (asking to change the tutor persona or voice, e.g. 'switch to dad', 'make it prerna', 'i want to hear prerna', or starting conversation with 'hey [name]'), "
        "'general_chat' (anything else). "
        "If 'navigate', also provide 'destination' (e.g. 'dashboard', 'lessons'). "
        "If 'switch_voice', also provide 'target_persona' (e.g. 'dad', 'prerna', 'ai tutor'). "
        "Return ONLY valid JSON format like {\"intent\": \"...\", \"destination\": \"...\", \"target_persona\": \"...\"} without markdown formatting."
    )
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\nQuestion: {question}",
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=5) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "{}")
                match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if match:
                    response_text = match.group(0)
                return json.loads(response_text)
    except Exception as e:
        print("Intent classification failed:", e)
        
    return {"intent": "general_chat"}

def generate_tutor_response(question: str, context_block: str, tutor_name="Tutor", student_name="Student") -> str:

    """
    Connects to configured local AI instance with fast timeout. Falls back cleanly to context knowledge.
    """
    import urllib.request
    import json
    import re
    
    system_prompt = (
        f"You are an AI teaching assistant named {tutor_name}. If asked who you are or what your name is, clearly state that your name is {tutor_name}. You are talking to a student named {student_name}. "
        "Keep answers brief, conversational, and under 3 sentences. Address the student by name occasionally. "
        "Do NOT use markdown, asterisks, bullet points, or tables because your output will be read aloud via Text-to-Speech.\n"
        f"{context_block}"
    )
    prompt = f"Student question: {question}\nProvide a helpful, concise response as {tutor_name}."
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\n{prompt}",
            "stream": False
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=12) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                raw = resp_data.get("response", "").strip()
                if raw:
                    clean = re.sub(r'[\*\#\_`]', '', raw)
                    return clean
    except Exception as e:
        print("AI server request failed or timed out:", e)

    # Intelligent Context Fallback
    q_lower = question.lower()
    if any(k in q_lower for k in ["cochlea", "ear"]):
        if "non_visual" in context_block or "tactile" in context_block:
            return ("The cochlea is a spiral-shaped structure that curls inward, "
                    "narrowing as it winds toward its center like a tightly coiled "
                    "rope. Sound vibrations travel through fluid inside it and get "
                    "converted into signals your brain reads as sound.")
        return ("The cochlea is a snail-shell-shaped structure in your inner ear. "
                "Sound vibrations travel through fluid inside it and get converted "
                "into electrical signals your brain reads as sound.")
                
    if any(k in q_lower for k in ["recap", "last lesson", "previous lesson"]):
        return "In our recent lessons, we covered Ear Anatomy and the Cochlea, as well as Blood Flow through the Heart."

    if any(k in q_lower for k in ["heart", "blood flow", "ventricle", "atrium"]):
        return "The heart has four chambers. The right side receives oxygen-depleted blood from the body and pumps it to the lungs, while the left side receives oxygen-rich blood and pumps it out to your body."

    if any(k in q_lower for k in ["hi", "hello", "hey", "who are you", "your name", "what's your name", "what is your name"]):
        if tutor_name.lower() not in ["tutor", "ai tutor"]:
            return f"Hi there! I'm {tutor_name}, your personalized AI tutor. I can explain your lessons, review your quiz scores, or guide your learning progress. What would you like to explore?"
        else:
            return "Hi there! I am your AI Tutor. I can explain your lessons, review your quiz scores, or guide your learning progress. What would you like to explore?"

    # If recent lessons has text, pull an excerpt
    if "Recent Lessons:" in context_block:
        return f"Based on your recent lessons, keep reviewing your course material. Feel free to ask me, {tutor_name}, to explain any specific topic or test your knowledge with a quiz."

    return (f"I'm {tutor_name}. I heard you ask about {question}. Review your dashboard lessons or ask me about your quiz scores and study progress anytime!")

def generate_quiz_from_text(text: str) -> List[dict]:
    import urllib.request
    import json
    import re
    
    system_prompt = "You are an AI teaching assistant. Given the following lesson text, generate 5 multiple-choice questions. Return ONLY a JSON array of objects. Each object must have 'question_text', 'options' (an array of 4 strings), and 'correct_answer' (must match one of the options exactly). Do not include any markdown formatting, only valid JSON."
    
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

class UpdateProfilePayload(BaseModel):
    speech_speed: Optional[str] = None

@app.put("/api/profile/{user_id}")
def update_profile(user_id: str, payload: UpdateProfilePayload):
    conn = get_conn()
    existing = conn.execute("SELECT user_id FROM student_profiles WHERE user_id = ?", (user_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")
        
    updates = []
    params = []
    
    if payload.speech_speed is not None:
        updates.append("speech_speed = ?")
        params.append(payload.speech_speed)
        
    if updates:
        params.append(user_id)
        query = f"UPDATE student_profiles SET {', '.join(updates)} WHERE user_id = ?"
        conn.execute(query, tuple(params))
        conn.commit()
        
    conn.close()
    return {"message": "Profile updated"}

def heuristic_parse_voice(transcript: str, step: Union[int, float]) -> dict:
    import re
    t = transcript.lower().strip()
    result = {}

    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
        "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
        "nineteen": 19, "twenty": 20
    }

    if step == 2:
        # Age extraction
        age_m = re.search(r'\b(?:age\s+is\s+|i\s+am\s+|i\'m\s+)?([1-9][0-9]?)\b(?:\s+years?\s+old)?', t)
        if age_m:
            val = int(age_m.group(1))
            if 5 <= val <= 80:
                result["age"] = str(val)
        if "age" not in result:
            for w, n in word_to_num.items():
                if re.search(r'\b(?:age\s+is\s+|i\s+am\s+|i\'m\s+)' + w + r'\b', t) or re.search(r'\b' + w + r'\s+years?\s+old\b', t):
                    result["age"] = str(n)
                    break

        # Grade extraction
        grade_m = re.search(r'\b(?:class|grade|standard)\s*(\d{1,2})(?:st|nd|rd|th)?\b', t) or re.search(r'\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|class|standard)?\b', t)
        if grade_m:
            g_num = grade_m.group(1)
            suffix = "th"
            if g_num == "1": suffix = "st"
            elif g_num == "2": suffix = "nd"
            elif g_num == "3": suffix = "rd"
            result["grade"] = f"{g_num}{suffix} Grade"
        else:
            word_grades = {
                "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th", "fifth": "5th",
                "sixth": "6th", "seventh": "7th", "eighth": "8th", "ninth": "9th", "tenth": "10th",
                "eleventh": "11th", "twelfth": "12th"
            }
            for wg, wgs in word_grades.items():
                if re.search(r'\b(?:class|grade)\s+' + wg + r'\b', t) or re.search(r'\b' + wg + r'\s+grade\b', t):
                    result["grade"] = f"{wgs} Grade"
                    break

        # Name extraction
        name_m = re.search(r'\b(?:my\s+name\s+is|name\s+is|i\s+am|call\s+me)\s+([A-Za-z]+)', transcript, re.IGNORECASE)
        if name_m:
            candidate = name_m.group(1).strip()
            if candidate.lower() not in ["a", "in", "the", "from", "and", "class", "grade", "years", "old", "at", "student", "my", "name"]:
                result["name"] = candidate.capitalize()
        elif not result.get("name") and len(t.split()) <= 3 and not re.search(r'\d', t):
            words = [w for w in transcript.split() if w.lower() not in ["hello", "hi", "tutor", "yes", "no", "next", "start", "please", "my", "is"]]
            if words:
                result["name"] = " ".join([w.capitalize() for w in words])

    elif step in [3, 3.0]:
        if any(w in t for w in ["birth", "born", "congenital", "childhood", "since i was born", "option 1", "option one", "first option", "first"]):
            result["onset_type"] = "congenital"
        elif any(w in t for w in ["later", "acquired", "accident", "illness", "disease", "after", "option 2", "option two", "second option", "second"]):
            result["onset_type"] = "acquired"

    elif step in [3.5]:
        if any(w in t for w in ["partial", "light", "shapes", "shadows", "some vision", "low vision", "option 1", "option one", "first option", "first"]):
            result["vision_status"] = "partial_sight"
            result["residual_vision"] = "low_vision"
        elif any(w in t for w in ["color", "colors", "color blind", "colorblind", "distinguish", "option 2", "option two", "second option", "second"]):
            result["vision_status"] = "color_blind"
            result["residual_vision"] = "low_vision"
        elif any(w in t for w in ["total", "blind", "completely", "no vision", "total loss", "nothing", "option 3", "option three", "third option", "third"]):
            result["vision_status"] = "total_loss"
            result["residual_vision"] = "none"

    elif step in [4, 4.0]:
        if any(w in t for w in ["mostly audio", "audio only", "listening only", "sound only", "option 1", "option one", "first option"]):
            result["learning_mode"] = "mostly_audio"
        elif any(w in t for w in ["voice", "conversation", "interactive", "speaking", "talk", "dialogue", "option 2", "option two", "second option"]):
            result["learning_mode"] = "voice"
        elif any(w in t for w in ["both", "audio and text", "audio plus text", "text and audio", "reading and listening", "option 3", "option three", "third option"]):
            result["learning_mode"] = "audio_text"
        elif any(w in t for w in ["ai", "let ai decide", "you decide", "decide for me", "smart", "automatic", "option 4", "option four", "fourth option"]):
            result["learning_mode"] = "ai"

        if any(w in t for w in ["slow", "slowly", "slower"]):
            result["speech_speed"] = "slow"
        elif any(w in t for w in ["normal", "medium", "standard", "regular"]):
            result["speech_speed"] = "normal"
        elif any(w in t for w in ["fast", "faster", "quick", "quickly"]):
            result["speech_speed"] = "fast"

    elif step in [5, 5.0]:
        if any(w in t for w in ["vision", "seeing", "sight", "visual support", "option 1", "option one", "first option"]):
            result["support_type"] = "vision"
        elif any(w in t for w in ["audio", "listening", "hear", "sound", "ear", "option 2", "option two", "second option"]):
            result["support_type"] = "audio"
        elif any(w in t for w in ["text", "keyboard", "typing", "reading", "screen reader", "option 3", "option three", "third option"]):
            result["support_type"] = "text"
        elif any(w in t for w in ["other", "different", "special", "option 4", "option four", "fourth option"]):
            result["support_type"] = "other"
        elif any(w in t for w in ["none", "no support", "nothing", "no specific", "option 5", "option five", "fifth option"]):
            result["support_type"] = "none"

    return result

@app.post("/api/parse_voice_data")
def extract_onboarding(payload: AIExtractPayload):
    import urllib.request
    import json
    import re
    
    # Run instant heuristic extraction
    heuristic = heuristic_parse_voice(payload.transcript, payload.step)
    if payload.step == 2 and ("name" in heuristic or "age" in heuristic or "grade" in heuristic):
        return heuristic
    if payload.step in [3, 3.0, 3.5, 4, 4.0, 5, 5.0] and len(heuristic) > 0:
        return heuristic

    # Fallback to Ollama with 2s timeout
    try:
        if payload.step == 2:
            system_prompt = "You are an AI extracting user details from spoken text. Extract 'name' (string), 'age' (integer or string), and 'grade' (string, e.g., '12th Grade', 'Class 10'). Return ONLY a valid JSON object. Do not wrap in markdown."
        elif payload.step in [3, 3.0]:
            system_prompt = "You are an AI extracting visual impairment onset from spoken text. Extract 'onset_type' ('congenital' or 'acquired'). Return ONLY a valid JSON object."
        elif payload.step in [3.5]:
            system_prompt = "You are an AI extracting details about visual impairment from spoken text. Extract 'vision_status' ('partial_sight', 'color_blind', or 'total_loss'). Return ONLY a valid JSON object."
        elif payload.step in [4, 4.0]:
            system_prompt = "You are an AI extracting details about learning preferences from spoken text. Extract 'learning_mode' ('mostly_audio', 'voice', 'audio_text', or 'ai') and 'speech_speed' ('slow', 'normal', or 'fast'). Return ONLY a valid JSON object."
        elif payload.step in [5, 5.0]:
            system_prompt = "You are an AI extracting support preferences from spoken text. Extract 'support_type' ('vision', 'audio', 'text', 'other', or 'none'). Return ONLY a valid JSON object."
        else:
            return heuristic

        prompt = f"Transcript:\n{payload.transcript}"
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\n\n{prompt}",
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=30) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "{}")
                match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if match:
                    ai_extracted = json.loads(match.group(0))
                    heuristic.update(ai_extracted)
    except Exception:
        pass
        
    return heuristic

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
                    "INSERT INTO content (id, student_id, class_id, title, subject) VALUES (?, ?, NULL, 'Diagnostic Assessment Content', 'Science')",
                    (content_id, payload.student_id)
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
    import re
    student_id = payload.student_id
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"

    conn = get_conn()
    profile = conn.execute(
        "SELECT sp.*, u.name as student_name FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.user_id = ?", (student_id,)
    ).fetchone()
    
    student_name = profile.get("student_name", "Student") if profile else "Student"
    tutor_name = profile.get("tutor_name", "Tutor") if profile and profile.get("tutor_name") else "Tutor"
    if not tutor_name: tutor_name = "Tutor"

    
    # 1. Fetch all quiz attempts for this student
    all_quiz_attempts = conn.execute(
        """
        SELECT qa.score, q.title, 
               (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as total,
               qa.completed_at
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ?
        ORDER BY qa.completed_at DESC
        """, (student_id,)
    ).fetchall()

    recent_quizzes = all_quiz_attempts[:3]
    
    # 2. Fetch available quizzes and attempt status
    available_quizzes = conn.execute(
        """
        SELECT q.id as quiz_id, q.title,
               (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND student_id = ?) as attempts_count
        FROM quizzes q
        JOIN lessons l ON q.lesson_id = l.id
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        WHERE ct.student_id = ? OR (e.student_id = ? AND ct.student_id IS NULL)
        """, (student_id, student_id, student_id)
    ).fetchall()

    recent_lessons = conn.execute(
        """
        SELECT l.title, l.transcript, ct.subject, ct.uploaded_at
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        JOIN enrollments e ON e.class_id = ct.class_id
        WHERE e.student_id = ?
        ORDER BY ct.uploaded_at DESC LIMIT 2
        """, (student_id,)
    ).fetchall()

    # 3. Upcoming learning modules & Progress tracking
    completed_lessons = conn.execute(
        """
        SELECT l.title
        FROM student_lesson_progress slp
        JOIN lessons l ON slp.lesson_id = l.id
        WHERE slp.student_id = ? AND slp.status = 'completed'
        ORDER BY slp.completed_at DESC LIMIT 5
        """, (student_id,)
    ).fetchall()
    
    current_lesson = conn.execute(
        """
        SELECT l.id, l.title, l.sequence_order, l.transcript
        FROM student_lesson_progress slp
        JOIN lessons l ON slp.lesson_id = l.id
        WHERE slp.student_id = ? AND slp.status = 'in_progress'
        ORDER BY slp.last_accessed_at DESC LIMIT 1
        """, (student_id,)
    ).fetchone()
    
    upcoming_lessons = []
    if current_lesson:
        seq = current_lesson.get('sequence_order', 0) if hasattr(current_lesson, 'get') else 0
        upcoming_lessons = conn.execute(
            """
            SELECT l.title
            FROM lessons l
            JOIN content ct ON l.content_id = ct.id
            JOIN enrollments e ON ct.class_id = e.class_id
            WHERE e.student_id = ? AND l.sequence_order > ?
            ORDER BY l.sequence_order ASC LIMIT 3
            """, (student_id, seq)
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
            """, (student_id, student_id)
        ).fetchall()
        
    conn.close()

    def _clean_title(title_str):
        if not title_str:
            return ""
        return str(title_str).replace("Quiz: ", "").strip()

    def _row_title(item):
        if hasattr(item, 'get'):
            return item.get('title', '')
        if isinstance(item, (list, tuple)) and len(item) > 0:
            return item[0]
        return str(item) if item else ''

    q_lower = payload.question.lower().strip()

    intent_data = classify_intent(q_lower)
    intent = intent_data.get("intent", "general_chat")

    answer = None
    navigation_action = None

    if intent == "switch_voice":
        target = intent_data.get("target_persona", "").strip().lower()
        if target:
            conn2 = get_conn()
            available = conn2.execute("SELECT id, persona_name FROM voice_profiles WHERE student_id = ?", (student_id,)).fetchall()
            
            matched_profile = None
            for p in available:
                if p["persona_name"].lower() in target or target in p["persona_name"].lower():
                    matched_profile = p
                    break
            
            if matched_profile:
                conn2.execute(
                    "UPDATE student_profiles SET active_voice_profile_id = ?, tutor_name = ? WHERE user_id = ?",
                    (matched_profile["id"], matched_profile["persona_name"], student_id)
                )
                conn2.commit()
                tutor_name = matched_profile["persona_name"]
            elif "ai" in target or "tutor" in target or "default" in target:
                conn2.execute("UPDATE student_profiles SET active_voice_profile_id = NULL, tutor_name = 'Tutor' WHERE user_id = ?", (student_id,))
                conn2.commit()
                tutor_name = "Tutor"
            else:
                answer = f"I'm sorry, I couldn't find a voice clone named {target}. Please create it in your profile first."
            conn2.close()

    if intent == "navigate":
        dest = intent_data.get("destination", "dashboard").lower()
        answer = f"Navigating to {dest}..."
        navigation_action = f"NAVIGATE_{dest.upper()}"
    elif intent == "query_score":
        if all_quiz_attempts:
            # Group attempts by quiz title
            attempts_by_title = {}
            for qa in all_quiz_attempts:
                t_clean = _clean_title(qa.get("title"))
                if not t_clean:
                    continue
                if t_clean not in attempts_by_title:
                    attempts_by_title[t_clean] = []
                attempts_by_title[t_clean].append(qa)
            
            score_phrases = []
            for t_clean, q_attempts in attempts_by_title.items():
                best_att = max(q_attempts, key=lambda a: a.get("score", 0))
                s = best_att.get("score", 0)
                tot = best_att.get("total", 0)
                pct = round((s / tot) * 100) if tot > 0 else 0
                if len(q_attempts) > 1:
                    score_phrases.append(f"In your quiz '{t_clean}', your best score is {s} out of {tot} ({pct}%) across {len(q_attempts)} attempts")
                else:
                    score_phrases.append(f"In your quiz '{t_clean}', you scored {s} out of {tot} ({pct}%)")
            
            summary = ". ".join(score_phrases)
            answer = f"{summary}. I recommend you attempt all available quizzes to keep your progress and marks high!"
        else:
            answer = "You haven't recorded any quiz attempts yet. Head to your Quizzes page to take your first quiz and save your marks!"

    elif intent == "query_quiz_status":
        completed = [q for q in available_quizzes if (q.get("attempts_count") or 0) > 0]
        remaining = [q for q in available_quizzes if (q.get("attempts_count") or 0) == 0]
        
        comp_titles = [_clean_title(q.get("title")) for q in completed if _clean_title(q.get("title"))]
        rem_titles = [_clean_title(q.get("title")) for q in remaining if _clean_title(q.get("title"))]
        
        if comp_titles and rem_titles:
            answer = f"You have completed {len(comp_titles)} quiz{'zes' if len(comp_titles) > 1 else ''}: {', '.join(comp_titles)}. You are left with {len(rem_titles)} quiz{'zes' if len(rem_titles) > 1 else ''} to attempt: {', '.join(rem_titles)}. I recommend completing all of them to master your lessons!"
        elif comp_titles and not rem_titles:
            answer = f"Outstanding work! You have completed all {len(comp_titles)} quizzes in your curriculum: {', '.join(comp_titles)}. Your quiz status is 100% complete!"
        elif rem_titles:
            answer = f"You have not completed any quizzes yet. You have {len(rem_titles)} quizzes waiting: {', '.join(rem_titles)}. Head to your Quizzes page to take your first quiz!"
        else:
            answer = "You currently have no quizzes assigned in your curriculum."

    elif intent == "query_progress":
        comp_titles = [_row_title(l) for l in completed_lessons if _row_title(l)]
        up_titles = [_row_title(l) for l in upcoming_lessons if _row_title(l)]
        curr_title = _row_title(current_lesson) if current_lesson else ""
        
        parts = []
        if comp_titles:
            parts.append(f"You have completed {len(comp_titles)} lesson{'s' if len(comp_titles) > 1 else ''}: {', '.join(comp_titles)}")
        if curr_title:
            parts.append(f"Your active lesson is '{curr_title}'")
        if up_titles:
            parts.append(f"Next to take is {', '.join(up_titles)}")
        if all_quiz_attempts:
            parts.append(f"You have saved {len(all_quiz_attempts)} quiz attempt checkpoint{'s' if len(all_quiz_attempts) > 1 else ''}")
        if not parts:
            parts.append("You are just beginning your curriculum. Check your dashboard to start your first lesson!")
        answer = ". ".join(parts) + "."

    # Build context block for general conceptual questions
    context_block = build_context_block(profile, recent_quizzes, recent_lessons)

    context_block += "\n\n[CURRICULUM PROGRESS TRACKING]\n"
    if completed_lessons:
        titles = [_row_title(l) for l in completed_lessons if _row_title(l)]
        context_block += f"Completed lessons: {', '.join(titles)}\n"
    if current_lesson:
        title = _row_title(current_lesson)
        context_block += f"Current active lesson: {title}\n"
    if upcoming_lessons:
        titles = [_row_title(l) for l in upcoming_lessons if _row_title(l)]
        context_block += f"Upcoming lessons (Next to take): {', '.join(titles)}\n"

    if payload.page_context == "/dashboard":
        context_block += "\n[SYSTEM NOTE: The student is currently on their Dashboard. The 'Recent Lessons' listed above are actively displayed to them. If they say 'continue my lesson' or similar, recommend one of those lessons.]"

    if not answer:
        answer = generate_tutor_response(payload.question, context_block, tutor_name, student_name)

    # Persist conversation
    try:
        conn = get_conn()
        now = datetime.utcnow()
        conn.execute(
            "INSERT INTO tutor_conversations (id, student_id, role, message, created_at) VALUES (?, ?, 'student', ?, ?)",
            (str(uuid.uuid4()), student_id, payload.question, now)
        )
        conn.execute(
            "INSERT INTO tutor_conversations (id, student_id, role, message, created_at) VALUES (?, ?, 'tutor', ?, ?)",
            (str(uuid.uuid4()), student_id, answer, now)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print("Failed to persist tutor conversation:", e)

    return {
        "question": payload.question,
        "answer": answer,
        "context_used": context_block,
        "navigation_action": navigation_action
    }

@app.get("/api/tutor/history")
def tutor_history(student_id: Optional[str] = None):
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
    try:
        conn = get_conn()
        rows = conn.execute(
            """
            SELECT role, message as text, created_at
            FROM tutor_conversations
            WHERE student_id = ?
            ORDER BY created_at ASC
            LIMIT 50
            """,
            (student_id,)
        ).fetchall()
        conn.close()
        return {"messages": [dict(r) for r in rows]}
    except Exception as e:
        print("Error fetching tutor history:", e)
        return {"messages": []}

@app.get("/api/student/{student_id}/curriculum")
def student_curriculum(student_id: str):
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT l.id as lesson_id, l.title as lesson_title, l.transcript, l.sequence_order,
               ct.id as content_id, ct.title as module_title, ct.subject,
               slp.status as lesson_status,
               (SELECT id FROM quizzes WHERE lesson_id = l.id LIMIT 1) as quiz_id
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        LEFT JOIN student_lesson_progress slp ON slp.lesson_id = l.id AND slp.student_id = ?
        WHERE (ct.student_id = ? OR (e.student_id = ? AND ct.student_id IS NULL))
          AND ct.title != 'Diagnostic Assessment Content'
        ORDER BY ct.uploaded_at DESC, l.sequence_order ASC
        """,
        (student_id, student_id, student_id),
    ).fetchall()
    conn.close()
    
    modules_dict = {}
    for r in rows:
        c_id = r["content_id"]
        if c_id not in modules_dict:
            modules_dict[c_id] = {
                "id": c_id,
                "title": r["module_title"],
                "subject": r["subject"],
                "lessons": []
            }
        
        status = r["lesson_status"]
        if not status:
            if len(modules_dict[c_id]["lessons"]) == 0:
                status = "in_progress"
            else:
                prev = modules_dict[c_id]["lessons"][-1]
                if prev.get("status") == "completed":
                    status = "in_progress"
                else:
                    status = "locked"
                    
        modules_dict[c_id]["lessons"].append({
            "id": r["lesson_id"],
            "title": r["lesson_title"],
            "transcript": r["transcript"],
            "sequence_order": r["sequence_order"],
            "status": status,
            "quiz_id": r["quiz_id"]
        })
        
    modules = list(modules_dict.values())
    return {"modules": modules}


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
        

@app.post("/api/student/login")
def student_login(payload: StudentLoginPayload):
    conn = get_conn()
    student = conn.execute("SELECT * FROM users WHERE role = 'student' AND lower(name) = lower(?) LIMIT 1", (payload.name,)).fetchone()
    if not student:
        student_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'demo123', 'student', ?)",
            (student_id, payload.name, f"{payload.name.lower().replace(' ', '')}@student.edu", datetime.utcnow().isoformat())
        )
        conn.commit()
        student_id_str = student_id
        student_name = payload.name
    else:
        student_id_str = str(student["id"])
        student_name = student["name"]
    conn.close()
    return {"student_id": student_id_str, "name": student_name}


@app.post("/api/teacher/login")
def teacher_login(payload: TeacherLoginPayload):
    conn = get_conn()
    teacher = conn.execute("SELECT * FROM users WHERE role = 'teacher' LIMIT 1").fetchone()
    if not teacher:
        teacher_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'demo123', 'teacher', ?)",
            (teacher_id, payload.name, f"{payload.name.lower().replace(' ', '')}@school.edu", datetime.utcnow().isoformat())
        )
        class_id = str(uuid.uuid4())
        conn.execute("INSERT INTO classes (id, teacher_id, name, subject) VALUES (?, ?, 'Grade 7 Science', 'Science')", (class_id, teacher_id))
        conn.commit()
        teacher_id_str = teacher_id
        teacher_name = payload.name
    else:
        teacher_id_str = str(teacher["id"])
        teacher_name = teacher.get("name", payload.name)
    conn.close()
    return {"teacher_id": teacher_id_str, "name": teacher_name}


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

    teacher_id = payload.teacher_id
    if not teacher_id or str(teacher_id).lower() in ("undefined", "null", "none"):
        teacher_row = conn.execute("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").fetchone()
        teacher_id = str(teacher_row["id"]) if teacher_row else "00000000-0000-0000-0000-000000000001"

    class_id = payload.class_id
    if not class_id or str(class_id).lower() in ("undefined", "null", "none"):
        class_id = None
    
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
            (content_id, student_id, class_id, teacher_id, payload.title, payload.subject,
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
            title = f"{payload.title} - {parts[i]}"
            chunk_text = f"[{parts[i]}] {base_text} - Details for {parts[i]}."
            
            conn.execute(
                "INSERT INTO lessons (id, content_id, title, transcript, sequence_order, next_lesson_id) VALUES (?, ?, ?, ?, ?, NULL)",
                (l_id, content_id, title, chunk_text, i+1),
            )
            
            # Auto-create quiz for this chunk
            quiz_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
                (quiz_id, l_id, f"Quiz: {title}"),
            )
            
            # Generate questions via AI
            ai_questions = generate_quiz_from_text(chunk_text)
            if not ai_questions:
                # Fallback if AI fails or returns empty
                ai_questions = [
                    {
                        "question_text": f"What is the main topic of {parts[i]}?",
                        "options": ["The Heart", "Lungs", "Brain", "Kidneys"],
                        "correct_answer": "The Heart"
                    },
                    {
                        "question_text": "Which chamber receives oxygen-rich blood?",
                        "options": ["Left Atrium", "Right Atrium", "Right Ventricle", "Left Ventricle"],
                        "correct_answer": "Left Atrium"
                    },
                    {
                        "question_text": "What prevents blood from flowing backward?",
                        "options": ["Valves", "Veins", "Arteries", "Capillaries"],
                        "correct_answer": "Valves"
                    },
                    {
                        "question_text": "Where does the right ventricle pump blood to?",
                        "options": ["The Lungs", "The Brain", "The Body", "The Liver"],
                        "correct_answer": "The Lungs"
                    },
                    {
                        "question_text": "Which vessels carry blood away from the heart?",
                        "options": ["Arteries", "Veins", "Capillaries", "Vena Cava"],
                        "correct_answer": "Arteries"
                    }
                ]
                
            for q in ai_questions:
                q_id = str(uuid.uuid4())
                q_text = q.get("question_text", "Generated Question")
                options = q.get("options", ["A", "B", "C", "D"])
                correct = q.get("correct_answer", options[0] if options else "")
                conn.execute(
                    "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                    (q_id, quiz_id, q_text, json.dumps(options), correct),
                )

        # Update next_lesson_id now that all lessons exist in DB
        for i in range(2):
            conn.execute(
                "UPDATE lessons SET next_lesson_id = ? WHERE id = ?",
                (lesson_ids[i+1], lesson_ids[i]),
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

    if not teacher_id or str(teacher_id).lower() in ("undefined", "null", "none"):
        teacher_row = conn.execute("SELECT id FROM users WHERE role = 'teacher' LIMIT 1").fetchone()
        teacher_id = str(teacher_row["id"]) if teacher_row else "00000000-0000-0000-0000-000000000001"

    if not class_id or str(class_id).lower() in ("undefined", "null", "none"):
        class_id = None

    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = None
    
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
        chunk_title = f"{title} - {parts[i]}"
        chunk_text = f"[{parts[i]}] {base_text} - Details for {parts[i]}."
        
        conn.execute(
            "INSERT INTO lessons (id, content_id, title, transcript, sequence_order, next_lesson_id) VALUES (?, ?, ?, ?, ?, NULL)",
            (l_id, content_id, chunk_title, chunk_text, i+1),
        )
        
        quiz_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
            (quiz_id, l_id, f"Quiz: {chunk_title}"),
        )
        
        # Generate questions via AI
        ai_questions = generate_quiz_from_text(chunk_text)
        if not ai_questions:
            # Fallback if AI fails or returns empty
            ai_questions = [
                {
                    "question_text": f"What is the main focus of {parts[i]}?",
                    "options": ["Blood flow", "Bones", "Muscles", "Nerves"],
                    "correct_answer": "Blood flow"
                },
                {
                    "question_text": "Which chamber receives oxygen-rich blood?",
                    "options": ["Left Atrium", "Right Atrium", "Right Ventricle", "Left Ventricle"],
                    "correct_answer": "Left Atrium"
                },
                {
                    "question_text": "What prevents blood from flowing backward?",
                    "options": ["Valves", "Veins", "Arteries", "Capillaries"],
                    "correct_answer": "Valves"
                },
                {
                    "question_text": "Where does the right ventricle pump blood to?",
                    "options": ["The Lungs", "The Brain", "The Body", "The Liver"],
                    "correct_answer": "The Lungs"
                },
                {
                    "question_text": "Which vessels carry blood away from the heart?",
                    "options": ["Arteries", "Veins", "Capillaries", "Vena Cava"],
                    "correct_answer": "Arteries"
                }
            ]
            
        for q in ai_questions:
            q_id = str(uuid.uuid4())
            q_text = q.get("question_text", "Generated Question")
            options = q.get("options", ["A", "B", "C", "D"])
            correct = q.get("correct_answer", options[0] if options else "")
            conn.execute(
                "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                (q_id, quiz_id, q_text, json.dumps(options), correct),
            )

    for i in range(2):
        conn.execute(
            "UPDATE lessons SET next_lesson_id = ? WHERE id = ?",
            (lesson_ids[i+1], lesson_ids[i]),
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

    students = 0
    if class_ids:
        placeholders = ",".join("?" for _ in class_ids)
        st_row = conn.execute(
            f"SELECT COUNT(DISTINCT student_id) as n FROM enrollments WHERE class_id IN ({placeholders})",
            class_ids,
        ).fetchone()
        if st_row:
            students = st_row["n"]
            
    if students == 0:
        st_cnt = conn.execute("SELECT COUNT(DISTINCT student_id) as n FROM content WHERE teacher_id = ? AND student_id IS NOT NULL", (teacher_id,)).fetchone()
        if st_cnt and st_cnt["n"]:
            students = st_cnt["n"]
        else:
            all_st = conn.execute("SELECT COUNT(*) as n FROM users WHERE role = 'student'").fetchone()
            students = all_st["n"] if all_st else 0

    lessons = conn.execute(
        """SELECT l.id, l.title, l.transcript, l.sequence_order,
                  ct.id as content_id, ct.title as content_title, ct.subject, ct.uploaded_at, ct.file_name,
                  ct.student_id, ct.class_id,
                  COALESCE((SELECT name FROM users WHERE id = ct.student_id), cl.name, 'All Students') as class_name 
           FROM lessons l
           JOIN content ct ON l.content_id = ct.id
           LEFT JOIN classes cl ON ct.class_id = cl.id
           WHERE ct.teacher_id = ?
           ORDER BY ct.uploaded_at DESC, l.sequence_order ASC""",
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
        completed_row = conn.execute(
            f"SELECT COUNT(DISTINCT student_id) as n FROM quiz_attempts WHERE quiz_id IN ({qp})",
            quiz_ids,
        ).fetchone()
        completed = completed_row["n"] if completed_row else 0

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
    for l in lessons[:25]:
        has_attempts = conn.execute(
            """SELECT 1 FROM quiz_attempts qa JOIN quizzes q ON qa.quiz_id = q.id
               WHERE q.lesson_id = ? LIMIT 1""",
            (l["id"],),
        ).fetchone()

        uploaded_at_val = l.get("uploaded_at")
        if hasattr(uploaded_at_val, "isoformat"):
            uploaded_at_str = uploaded_at_val.isoformat()
        else:
            uploaded_at_str = str(uploaded_at_val) if uploaded_at_val else None

        recent_lessons.append({
            "lesson_id": str(l["id"]),
            "content_id": str(l["content_id"]) if l.get("content_id") else None,
            "title": l["title"],
            "subject": l.get("subject") or "General",
            "transcript": l.get("transcript") or "",
            "student_id": str(l["student_id"]) if l.get("student_id") else None,
            "class_id": str(l["class_id"]) if l.get("class_id") else None,
            "class_name": l["class_name"] or "Assigned",
            "file_name": l.get("file_name") or "",
            "uploaded_at": uploaded_at_str,
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


@app.put("/api/teacher/lessons/{lesson_id}")
def update_teacher_lesson(lesson_id: str, payload: UpdateLessonPayload):
    conn = get_conn()
    lesson = conn.execute("SELECT id, content_id, title, transcript FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    if not lesson:
        conn.close()
        raise HTTPException(status_code=404, detail="Lesson not found")

    content_id = lesson.get("content_id")
    new_title = payload.title if payload.title is not None else lesson["title"]
    new_transcript = payload.transcript if payload.transcript is not None else lesson.get("transcript", "")

    conn.execute(
        "UPDATE lessons SET title = ?, transcript = ? WHERE id = ?",
        (new_title, new_transcript, lesson_id)
    )

    if content_id:
        updates = []
        params = []
        if payload.title is not None:
            updates.append("title = ?")
            params.append(payload.title)
        if payload.subject is not None:
            updates.append("subject = ?")
            params.append(payload.subject)
        if payload.transcript is not None:
            updates.append("ocr_text = ?")
            params.append(payload.transcript)
        if payload.student_id is not None:
            if payload.student_id == "all" or payload.student_id == "":
                updates.append("student_id = NULL")
            else:
                updates.append("student_id = ?")
                params.append(payload.student_id)
        if payload.class_id is not None:
            if payload.class_id == "":
                updates.append("class_id = NULL")
            else:
                updates.append("class_id = ?")
                params.append(payload.class_id)
        if updates:
            params.append(content_id)
            conn.execute(f"UPDATE content SET {', '.join(updates)} WHERE id = ?", tuple(params))

    conn.commit()

    updated = conn.execute(
        """SELECT l.id, l.title, l.transcript, ct.id as content_id, ct.subject, ct.uploaded_at, ct.file_name,
                  ct.student_id, ct.class_id,
                  COALESCE((SELECT name FROM users WHERE id = ct.student_id), cl.name, 'Assigned Class') as class_name
           FROM lessons l
           LEFT JOIN content ct ON l.content_id = ct.id
           LEFT JOIN classes cl ON ct.class_id = cl.id
           WHERE l.id = ?""",
        (lesson_id,)
    ).fetchone()
    conn.close()

    if updated:
        res = dict(updated)
        res["lesson_id"] = str(res["id"])
        res["student_id"] = str(res["student_id"]) if res.get("student_id") else None
        res["class_id"] = str(res["class_id"]) if res.get("class_id") else None
        if hasattr(res.get("uploaded_at"), "isoformat"):
            res["uploaded_at"] = res["uploaded_at"].isoformat()
        return res
    return {"lesson_id": lesson_id, "title": new_title}


@app.delete("/api/teacher/lessons/{lesson_id}")
def delete_teacher_lesson(lesson_id: str):
    conn = get_conn()
    lesson = conn.execute("SELECT id, content_id FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
    if not lesson:
        conn.close()
        raise HTTPException(status_code=404, detail="Lesson not found")
    conn.execute("DELETE FROM lessons WHERE id = ?", (lesson_id,))
    conn.commit()
    conn.close()
    return {"message": "Lesson deleted successfully", "lesson_id": lesson_id}


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
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT l.id, l.title, l.transcript, ct.subject
        FROM lessons l
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        WHERE ct.student_id = ? OR (e.student_id = ? AND ct.student_id IS NULL)
        """,
        (student_id, student_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/student/{student_id}/lessons/{lesson_id}/complete")
def complete_lesson(student_id: str, lesson_id: str):
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
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

    # Check if quiz exists, if not generate one
    quiz = conn.execute("SELECT id, title FROM quizzes WHERE lesson_id = ? LIMIT 1", (lesson_id,)).fetchone()
    has_quiz = False
    quiz_id = None
    quiz_title = None

    if quiz:
        has_quiz = True
        quiz_id = quiz["id"]
        quiz_title = quiz["title"]
    else:
        # Generate one automatically
        lesson = conn.execute("SELECT title, transcript FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
        if lesson and lesson.get("transcript"):
            ai_questions = generate_quiz_from_text(lesson["transcript"])
            if ai_questions:
                quiz_id = str(uuid.uuid4())
                quiz_title = lesson["title"] + " - Auto Quiz"
                conn.execute(
                    "INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES (?, ?, ?, 'medium')",
                    (quiz_id, lesson_id, quiz_title)
                )
                import json
                for q in ai_questions:
                    q_text = q.get("question_text", "Generated Question")
                    options = q.get("options", ["A", "B", "C", "D"])
                    correct = q.get("correct_answer", options[0] if options else "")
                    conn.execute(
                        "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), quiz_id, q_text, json.dumps(options), correct)
                    )
                has_quiz = True

    conn.commit()
    conn.close()
    return {
        "status": "success", 
        "message": "Lesson marked as complete.",
        "has_quiz": has_quiz,
        "quiz_id": quiz_id,
        "quiz_title": quiz_title
    }


@app.get("/api/student/{student_id}/quizzes")
def student_quizzes(student_id: str):
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT q.id as quiz_id, q.title, q.difficulty_level, l.title as lesson_title,
               (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND student_id = ?) as attempted
        FROM quizzes q
        JOIN lessons l ON q.lesson_id = l.id
        JOIN content ct ON l.content_id = ct.id
        LEFT JOIN enrollments e ON e.class_id = ct.class_id
        WHERE ct.student_id = ? OR (e.student_id = ? AND ct.student_id IS NULL)
        """,
        (student_id, student_id, student_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/student/{student_id}/progress")
def student_progress(student_id: str):
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
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
    import json
    conn = get_conn()
    quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = conn.execute(
        "SELECT id, question_text, options FROM quiz_questions WHERE quiz_id = ?", (quiz_id,)
    ).fetchall()
    
    # Regenerate dummy quizzes dynamically
    if len(questions) > 0 and 'Option 1' in str(questions[0]['options']):
        conn.execute("DELETE FROM quiz_questions WHERE quiz_id = ?", (quiz_id,))
        lesson = conn.execute("SELECT transcript, title FROM lessons WHERE id = ?", (quiz['lesson_id'],)).fetchone()
        
        chunk_text = lesson['transcript'] if lesson else "No content"
        ai_questions = generate_quiz_from_text(chunk_text)
        if not ai_questions:
            # Fallback
            lesson_title = lesson['title'] if lesson else "this topic"
            ai_questions = [
                {
                    "question_text": f"What is the main topic of {lesson_title}?",
                    "options": ["The Heart", "Lungs", "Brain", "Kidneys"],
                    "correct_answer": "The Heart"
                },
                {
                    "question_text": "Which chamber receives oxygen-rich blood?",
                    "options": ["Left Atrium", "Right Atrium", "Right Ventricle", "Left Ventricle"],
                    "correct_answer": "Left Atrium"
                },
                {
                    "question_text": "What prevents blood from flowing backward?",
                    "options": ["Valves", "Veins", "Arteries", "Capillaries"],
                    "correct_answer": "Valves"
                },
                {
                    "question_text": "Where does the right ventricle pump blood to?",
                    "options": ["The Lungs", "The Brain", "The Body", "The Liver"],
                    "correct_answer": "The Lungs"
                },
                {
                    "question_text": "Which vessels carry blood away from the heart?",
                    "options": ["Arteries", "Veins", "Capillaries", "Vena Cava"],
                    "correct_answer": "Arteries"
                }
            ]
        
        for q in ai_questions:
            q_id = str(uuid.uuid4())
            q_text = q.get("question_text", "Generated Question")
            options = q.get("options", ["A", "B", "C", "D"])
            correct = q.get("correct_answer", options[0] if options else "")
            conn.execute(
                "INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES (?, ?, ?, ?, ?)",
                (q_id, quiz_id, q_text, json.dumps(options), correct),
            )
        conn.commit()
        # Refetch
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
    
    student_id = payload.student_id
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
    
    # 1. Evaluate answers
    evaluated_answers = []
    for a in payload.answers:
        q = conn.execute(
            "SELECT question_text, correct_answer FROM quiz_questions WHERE id = ?", (a["question_id"],)
        ).fetchone()
        is_correct = True if q and q["correct_answer"] == a["selected_answer"] else False
        correct_count += 1 if is_correct else 0
        evaluated_answers.append({
            "question_id": a["question_id"],
            "question_text": q["question_text"] if q else "",
            "selected_answer": a["selected_answer"],
            "correct_answer": q["correct_answer"] if q else "",
            "is_correct": is_correct
        })

    score = correct_count

    # 2. Insert attempt
    conn.execute(
        """
        INSERT INTO quiz_attempts (id, quiz_id, student_id, score, completed_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (attempt_id, payload.quiz_id, student_id, score, datetime.utcnow().isoformat()),
    )

    # 3. Insert answers
    for ea in evaluated_answers:
        conn.execute(
            """
            INSERT INTO student_answers (id, attempt_id, question_id, selected_answer, is_correct)
            VALUES (?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), attempt_id, ea["question_id"], ea["selected_answer"], ea["is_correct"]),
        )

    # 4. Mark corresponding lesson as completed in student_lesson_progress and unlock next lesson
    try:
        quiz_row = conn.execute("SELECT lesson_id, title FROM quizzes WHERE id = ?", (payload.quiz_id,)).fetchone()
        if quiz_row and quiz_row.get("lesson_id"):
            lesson_id = quiz_row["lesson_id"]
            now = datetime.utcnow()
            
            # Upsert completion into student_lesson_progress
            record = conn.execute(
                "SELECT status FROM student_lesson_progress WHERE student_id = ? AND lesson_id = ?",
                (student_id, lesson_id)
            ).fetchone()
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

            # Unlock next sequential lesson
            current_lesson = conn.execute("SELECT sequence_order FROM lessons WHERE id = ?", (lesson_id,)).fetchone()
            if current_lesson and current_lesson.get("sequence_order") is not None:
                seq = current_lesson["sequence_order"]
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
    except Exception as e:
        print("Error updating lesson progress on quiz submission:", e)
        
    conn.commit()
    conn.close()

    return {
        "attempt_id": attempt_id,
        "score": score,
        "total": len(payload.answers),
        "results": evaluated_answers
    }


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

PIPER_MALE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "en_US-ryan-high.onnx")
PIPER_MALE_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "en_US-ryan-high.onnx.json")

def ensure_piper_model(use_male=False):
    if use_male:
        if not os.path.exists(PIPER_MALE_MODEL_PATH):
            print("Downloading Piper TTS model (en_US-ryan-high)...")
            urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx?download=true", PIPER_MALE_MODEL_PATH)
        if not os.path.exists(PIPER_MALE_CONFIG_PATH):
            urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/ryan/high/en_US-ryan-high.onnx.json?download=true", PIPER_MALE_CONFIG_PATH)
        return PIPER_MALE_MODEL_PATH, PIPER_MALE_CONFIG_PATH
    else:
        if not os.path.exists(PIPER_MODEL_PATH):
            print("Downloading Piper TTS model (en_US-lessac-medium)...")
            urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true", PIPER_MODEL_PATH)
        if not os.path.exists(PIPER_CONFIG_PATH):
            urllib.request.urlretrieve("https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true", PIPER_CONFIG_PATH)
        return PIPER_MODEL_PATH, PIPER_CONFIG_PATH

class SetActiveVoicePayload(BaseModel):
    student_id: str
    voice_profile_id: Optional[str] = None
    default_gender: Optional[str] = None

VOICE_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads", "voice_samples")
os.makedirs(VOICE_UPLOADS_DIR, exist_ok=True)

class UpdateTutorNamePayload(BaseModel):
    tutor_name: str

@app.put("/api/student/{student_id}/tutor-name")
def update_tutor_name(student_id: str, payload: UpdateTutorNamePayload):
    conn = get_conn()
    name = payload.tutor_name.strip()
    if not name:
        name = "Tutor"
    conn.execute("UPDATE student_profiles SET tutor_name = ? WHERE user_id = ?", (name, student_id))
    conn.commit()
    conn.close()
    return {"message": "Tutor name updated successfully", "tutor_name": name}

@app.post("/api/voice-profiles")
def create_voice_profile(student_id: str = Form(...), persona_name: str = Form(...), audio_sample: UploadFile = File(...)):
    import shutil
    conn = get_conn()
    vp_id = str(uuid.uuid4())
    
    file_ext = audio_sample.filename.split(".")[-1] if "." in audio_sample.filename else "wav"
    save_path = os.path.join(VOICE_UPLOADS_DIR, f"{vp_id}.{file_ext}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(audio_sample.file, buffer)
        
    final_path = save_path
    
    # Check if ElevenLabs voice cloning is enabled with permissions
    if ELEVENLABS_API_KEY:
        try:
            import requests
            # Attempt to add voice to ElevenLabs for cloud-accelerated instant voice clone
            headers = {"xi-api-key": ELEVENLABS_API_KEY}
            with open(save_path, "rb") as f:
                r = requests.post(
                    "https://api.elevenlabs.io/v1/voices/add",
                    headers=headers,
                    data={"name": f"{persona_name}_{vp_id[:6]}"},
                    files={"files": f},
                    timeout=10
                )
            if r.status_code == 200:
                el_voice_id = r.json().get("voice_id")
                if el_voice_id:
                    final_path = f"elevenlabs:{el_voice_id}"
                    print(f"Created ElevenLabs voice clone: {el_voice_id}")
        except Exception as e:
            print("ElevenLabs voice clone notice (falling back to persistent local sample):", e)
            
    conn.execute(
        "INSERT INTO voice_profiles (id, student_id, persona_name, audio_sample_path) VALUES (?, ?, ?, ?)",
        (vp_id, student_id, persona_name, final_path)
    )
    
    # Upsert student_profiles
    existing = conn.execute("SELECT user_id FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
    if existing:
        conn.execute(
            "UPDATE student_profiles SET active_voice_profile_id = ?, tutor_name = ? WHERE user_id = ?",
            (vp_id, persona_name, student_id)
        )
    else:
        conn.execute(
            "INSERT INTO student_profiles (user_id, active_voice_profile_id, tutor_name) VALUES (?, ?, ?)",
            (student_id, vp_id, persona_name)
        )
        
    conn.commit()
    conn.close()
    return {"id": vp_id, "persona_name": persona_name, "message": "Voice profile created and activated"}

@app.get("/api/voice-profiles/{student_id}")
def list_voice_profiles(student_id: str):
    conn = get_conn()
    profiles = conn.execute("SELECT id, persona_name, created_at FROM voice_profiles WHERE student_id = ?", (student_id,)).fetchall()
    active = conn.execute("SELECT active_voice_profile_id, tutor_name FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
    conn.close()
    
    return {
        "profiles": [dict(p) for p in profiles],
        "active_profile_id": active["active_voice_profile_id"] if active else None,
        "tutor_name": active["tutor_name"] if active else "Tutor"
    }

@app.put("/api/voice-profiles/active")
def set_active_voice(payload: SetActiveVoicePayload):
    conn = get_conn()
    existing = conn.execute("SELECT user_id FROM student_profiles WHERE user_id = ?", (payload.student_id,)).fetchone()
    
    if payload.voice_profile_id:
        vp = conn.execute("SELECT persona_name FROM voice_profiles WHERE id = ?", (payload.voice_profile_id,)).fetchone()
        if not vp:
            conn.close()
            raise HTTPException(status_code=404, detail="Voice profile not found")
        persona_name = vp["persona_name"]
        
        if existing:
            conn.execute("UPDATE student_profiles SET active_voice_profile_id = ?, tutor_name = ? WHERE user_id = ?", (payload.voice_profile_id, persona_name, payload.student_id))
        else:
            conn.execute("INSERT INTO student_profiles (user_id, active_voice_profile_id, tutor_name) VALUES (?, ?, ?)", (payload.student_id, payload.voice_profile_id, persona_name))
    else:
        name_to_set = 'Tutor'
        if payload.default_gender == 'male':
            name_to_set = 'AI Tutor (Male)'
        elif payload.default_gender == 'female':
            name_to_set = 'AI Tutor (Female)'
            
        if existing:
            conn.execute("UPDATE student_profiles SET active_voice_profile_id = NULL, tutor_name = ? WHERE user_id = ?", (name_to_set, payload.student_id))
        else:
            conn.execute("INSERT INTO student_profiles (user_id, active_voice_profile_id, tutor_name) VALUES (?, NULL, ?)", (payload.student_id, name_to_set))
            
    conn.commit()
    conn.close()
    return {"message": "Active voice profile updated"}

@app.delete("/api/voice-profiles/{voice_profile_id}")
def delete_voice_profile(voice_profile_id: str, student_id: str = Query(...)):
    conn = get_conn()
    vp = conn.execute("SELECT audio_sample_path FROM voice_profiles WHERE id = ? AND student_id = ?", (voice_profile_id, student_id)).fetchone()
    if not vp:
        conn.close()
        raise HTTPException(status_code=404, detail="Voice profile not found")
        
    path = vp["audio_sample_path"]
    
    if path and not path.startswith("elevenlabs:") and os.path.exists(path):
        try:
            os.remove(path)
        except:
            pass

    # Delete from ElevenLabs if applicable
    if path and path.startswith("elevenlabs:") and ELEVENLABS_API_KEY:
        try:
            import requests
            voice_id = path.replace("elevenlabs:", "")
            requests.delete(f"https://api.elevenlabs.io/v1/voices/{voice_id}", headers={"xi-api-key": ELEVENLABS_API_KEY}, timeout=5)
        except:
            pass

    # Unset active if it was the one being deleted
    active = conn.execute("SELECT active_voice_profile_id FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
    if active and active["active_voice_profile_id"] == voice_profile_id:
        conn.execute("UPDATE student_profiles SET active_voice_profile_id = NULL, tutor_name = 'Tutor' WHERE user_id = ?", (student_id,))
        
    conn.execute("DELETE FROM voice_profiles WHERE id = ?", (voice_profile_id,))
    conn.commit()
    conn.close()
    return {"message": "Voice profile deleted"}

F5TTS_MODEL = None
def get_f5tts():
    global F5TTS_MODEL
    if F5TTS_MODEL is None:
        try:
            from f5_tts.api import F5TTS
            print("Loading F5-TTS Model... (this may take a moment)")
            F5TTS_MODEL = F5TTS()
        except ImportError:
            print("F5-TTS is not installed. Run 'pip install f5-tts'")
            return None
    return F5TTS_MODEL

class TTSPayload(BaseModel):
    text: str
    student_id: Optional[str] = None

@app.post("/api/tts")
def generate_tts(payload: TTSPayload):
    conn = get_conn()
    active_profile = None
    tutor_name_tts = "Tutor"
    
    # Auto-resolve default student ID if none provided
    student_id = payload.student_id
    if not student_id or str(student_id).lower() in ("undefined", "null", "none"):
        student_id = "00000000-0000-0000-0000-000000000002"
        
    sp = conn.execute("SELECT active_voice_profile_id, tutor_name, speech_speed FROM student_profiles WHERE user_id = ?", (student_id,)).fetchone()
    speech_speed = "normal"
    if sp:
        tutor_name_tts = sp.get("tutor_name") or "Tutor"
        speech_speed = sp.get("speech_speed") or "normal"
        if sp["active_voice_profile_id"]:
            active_profile = conn.execute("SELECT audio_sample_path FROM voice_profiles WHERE id = ?", (sp["active_voice_profile_id"],)).fetchone()
    conn.close()
    
    # Decide which voice characteristic to use based on persona name
    use_male = False
    lower_name = tutor_name_tts.lower()
    if any(n in lower_name for n in ["female", "woman", "girl", "mom", "mother"]):
        use_male = False
    elif any(n in lower_name for n in ["ralph", "ram", "dad", "father", "boy", "man", "mr", "sir", "bhai", "bhaiya", "baba", "male"]):
        use_male = True
    elif hash(lower_name) % 2 == 0:
        use_male = True

    # 1. Try ElevenLabs if active profile is an ElevenLabs voice ID or if key is provided
    if active_profile and active_profile.get("audio_sample_path"):
        audio_path = active_profile['audio_sample_path']
        if audio_path.startswith("elevenlabs:") and ELEVENLABS_API_KEY:
            voice_id = audio_path.replace("elevenlabs:", "")
            try:
                import requests
                el_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                headers = {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                }
                body = {
                    "text": payload.text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
                }
                resp = requests.post(el_url, headers=headers, json=body, timeout=10)
                if resp.status_code == 200:
                    fd, path = tempfile.mkstemp(suffix=".mp3")
                    os.close(fd)
                    with open(path, "wb") as f:
                        f.write(resp.content)
                    return FileResponse(path, media_type="audio/mpeg")
            except Exception as e:
                print("ElevenLabs TTS error (falling back):", e)

        # 2. Try F5-TTS local zero-shot model if file exists
        if os.path.exists(audio_path):
            f5 = get_f5tts()
            if f5:
                try:
                    import soundfile as sf
                    f5_speed = 1.0
                    if speech_speed == "slow": f5_speed = 0.8
                    elif speech_speed == "fast": f5_speed = 1.2
                    
                    wav, sr, spect = f5.infer(
                        ref_file=audio_path,
                        ref_text="", 
                        gen_text=payload.text,
                        speed=f5_speed
                    )
                    fd, path = tempfile.mkstemp(suffix=".wav")
                    os.close(fd)
                    sf.write(path, wav, sr)
                    return FileResponse(path, media_type="audio/wav")
                except Exception as e:
                    print("F5-TTS generation error:", e)

    # 3. Fast High-Quality Local Neural Fallback (Piper TTS)
    model_path, config_path = ensure_piper_model(use_male)
    import subprocess
    import sys
    
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    
    try:
        env = os.environ.copy()
        env["PYTHONHASHSEED"] = "random"
        python_exe = sys.executable.replace("uvicorn.exe", "python.exe")
        length_scale = "1.0"
        if speech_speed == "slow": length_scale = "1.3"
        elif speech_speed == "fast": length_scale = "0.75"
        
        process = subprocess.run(
            [python_exe, "-m", "piper", "-m", model_path, "-c", config_path, "--length_scale", length_scale, "-f", path],
            input=payload.text.encode("utf-8"),
            capture_output=True,
            check=True,
            env=env
        )
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        print("TTS Error:", err)
        raise HTTPException(status_code=500, detail=str(err))
        
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
