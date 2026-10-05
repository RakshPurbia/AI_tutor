import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add classify_intent
new_func = '''
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
        "'general_chat' (anything else). "
        "If 'navigate', also provide 'destination' (e.g. 'dashboard', 'lessons'). "
        "Return ONLY valid JSON format like {\\"intent\\": \\"...\\", \\"destination\\": \\"...\\"} without markdown formatting."
    )
    
    try:
        req = urllib.request.Request(AI_SERVER_URL, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps({
            "model": AI_MODEL_NAME,
            "prompt": f"{system_prompt}\\n\\nQuestion: {question}",
            "stream": False,
            "format": "json"
        }).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data, timeout=5) as response:
            if response.status == 200:
                resp_data = json.loads(response.read().decode('utf-8'))
                response_text = resp_data.get("response", "{}")
                match = re.search(r'\\{.*\\}', response_text, re.DOTALL)
                if match:
                    response_text = match.group(0)
                return json.loads(response_text)
    except Exception as e:
        print("Intent classification failed:", e)
        
    return {"intent": "general_chat"}

def generate_tutor_response(question: str, context_block: str, tutor_name="Tutor", student_name="Student") -> str:
'''

content = content.replace('def generate_tutor_response(question: str, context_block: str) -> str:', new_func)
content = content.replace(
    'system_prompt = (\n        "You are an AI teaching assistant. Keep answers brief, conversational, and under 3 sentences. "\n        "Do NOT use markdown, asterisks, bullet points, or tables because your output will be read aloud via Text-to-Speech.\\n"\n        f"{context_block}"\n    )',
    'system_prompt = (\n        f"You are an AI teaching assistant named {tutor_name}. You are talking to a student named {student_name}. "\n        "Keep answers brief, conversational, and under 3 sentences. Address the student by name occasionally. "\n        "Do NOT use markdown, asterisks, bullet points, or tables because your output will be read aloud via Text-to-Speech.\\n"\n        f"{context_block}"\n    )'
)

# 2. Update ask_tutor
old_profile_q = '''    profile = conn.execute(
        "SELECT * FROM student_profiles WHERE user_id = ?", (student_id,)
    ).fetchone()'''
new_profile_q = '''    profile = conn.execute(
        "SELECT sp.*, u.name as student_name FROM student_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.user_id = ?", (student_id,)
    ).fetchone()
    
    student_name = profile.get("student_name", "Student") if profile else "Student"
    tutor_name = profile.get("tutor_name", "Tutor") if profile and profile.get("tutor_name") else "Tutor"
    if not tutor_name: tutor_name = "Tutor"
'''
content = content.replace(old_profile_q, new_profile_q)

old_intent = '''    # Intent A: Quiz Scores & Marks
    is_score_query = bool(re.search(r'\\b(score|scores|mark|marks|grade|grades|result|results|scored|how\\s+much\\s+did\\s+i\\s+score|what\\s+did\\s+i\\s+score)\\b', q_lower))
    # Intent B: Quiz Status & Remaining Quizzes
    is_quiz_status_query = bool(re.search(r'\\b(quiz\\s+status|quizzes\\s+status|status\\s+of\\s+(my\\s+)?quiz(zes)?|how\\s+many\\s+quizzes|quizzes\\s+left|quizzes\\s+completed|quiz\\s+progress)\\b', q_lower))
    # Intent C: Lesson / Curriculum Progress
    is_progress_query = bool(re.search(r'\\b(lesson\\s+progress|curriculum\\s+progress|my\\s+progress|progress\\s+status|dashboard\\s+status|how\\s+much\\s+have\\s+i\\s+completed)\\b', q_lower))

    answer = None

    if is_score_query:'''

new_intent = '''    intent_data = classify_intent(q_lower)
    intent = intent_data.get("intent", "general_chat")

    answer = None
    navigation_action = None

    if intent == "navigate":
        dest = intent_data.get("destination", "dashboard").lower()
        answer = f"Navigating to {dest}..."
        navigation_action = f"NAVIGATE_{dest.upper()}"
    elif intent == "query_score":'''
content = content.replace(old_intent, new_intent)
content = content.replace('elif is_quiz_status_query:', 'elif intent == "query_quiz_status":')
content = content.replace('elif is_progress_query:', 'elif intent == "query_progress":')

old_ans_gen = '''    if not answer:
        answer = generate_tutor_response(payload.question, context_block)'''
new_ans_gen = '''    if not answer:
        answer = generate_tutor_response(payload.question, context_block, tutor_name, student_name)'''
content = content.replace(old_ans_gen, new_ans_gen)

old_ret = '''    return {
        "question": payload.question,
        "answer": answer,
        "context_used": context_block,
    }'''
new_ret = '''    return {
        "question": payload.question,
        "answer": answer,
        "context_used": context_block,
        "navigation_action": navigation_action
    }'''
content = content.replace(old_ret, new_ret)

# 3. Add voice profiles and update TTS
old_tts = '''class TTSPayload(BaseModel):
    text: str

@app.post("/api/tts")
def generate_tts(payload: TTSPayload):
    # API: PiperTTS is working here for Text-to-Speech
    ensure_piper_model()
    
    import subprocess
    import sys'''

new_tts = '''class SetActiveVoicePayload(BaseModel):
    student_id: str
    voice_profile_id: Optional[str] = None

@app.post("/api/voice-profiles")
def create_voice_profile(student_id: str = Form(...), persona_name: str = Form(...), audio_sample: UploadFile = File(...)):
    import shutil
    conn = get_conn()
    vp_id = str(uuid.uuid4())
    
    file_ext = audio_sample.filename.split(".")[-1]
    save_path = os.path.join(tempfile.gettempdir(), f"{vp_id}.{file_ext}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(audio_sample.file, buffer)
        
    conn.execute(
        "INSERT INTO voice_profiles (id, student_id, persona_name, audio_sample_path) VALUES (?, ?, ?, ?)",
        (vp_id, student_id, persona_name, save_path)
    )
    
    conn.execute(
        "UPDATE student_profiles SET active_voice_profile_id = ?, tutor_name = ? WHERE user_id = ?",
        (vp_id, persona_name, student_id)
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
    if payload.voice_profile_id:
        vp = conn.execute("SELECT persona_name FROM voice_profiles WHERE id = ?", (payload.voice_profile_id,)).fetchone()
        if not vp:
            conn.close()
            raise HTTPException(status_code=404, detail="Voice profile not found")
        persona_name = vp["persona_name"]
        conn.execute("UPDATE student_profiles SET active_voice_profile_id = ?, tutor_name = ? WHERE user_id = ?", (payload.voice_profile_id, persona_name, payload.student_id))
    else:
        conn.execute("UPDATE student_profiles SET active_voice_profile_id = NULL, tutor_name = 'Tutor' WHERE user_id = ?", (payload.student_id,))
    conn.commit()
    conn.close()
    return {"message": "Active voice profile updated"}

class TTSPayload(BaseModel):
    text: str
    student_id: Optional[str] = None

@app.post("/api/tts")
def generate_tts(payload: TTSPayload):
    # API: PiperTTS is working here for Text-to-Speech
    ensure_piper_model()
    
    conn = get_conn()
    active_profile = None
    if payload.student_id:
        sp = conn.execute("SELECT active_voice_profile_id FROM student_profiles WHERE user_id = ?", (payload.student_id,)).fetchone()
        if sp and sp["active_voice_profile_id"]:
            active_profile = conn.execute("SELECT audio_sample_path FROM voice_profiles WHERE id = ?", (sp["active_voice_profile_id"],)).fetchone()
    conn.close()
    
    if active_profile and active_profile.get("audio_sample_path"):
        print(f"Using cloned voice profile from: {active_profile['audio_sample_path']}")
        # In a real impl, this would call Coqui TTS with the sample for zero-shot cloning.
        # Fallback to Piper TTS for the prototype execution.
        
    import subprocess
    import sys'''
content = content.replace(old_tts, new_tts)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
