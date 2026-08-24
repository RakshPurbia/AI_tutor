# Deep Analysis: AI Tutor Project

## 1. Project Overview
The AI Tutor project is a local-first web application designed to help visually impaired students learn interactively. 
- **Frontend**: Next.js, vanilla CSS, Browser Web Speech API for TTS and STT (accessibility).
- **Backend**: FastAPI (Python), SQLite database, PyMuPDF for PDF text extraction.
- **Goal**: Facilitate teaching workflows (PDF upload -> automatic quiz generation) and student learning (audio-first lessons, voice-controlled quizzes).

## 2. Current Architecture & State
- **Database**: The current database (`ai_tutor.db`) is SQLite-based and created on application start via `init_db()` in `backend/main.py`.
- **Authentication**: Currently mocked. Passwords exist in the schema but are verified via plain text (`SELECT * FROM users WHERE email=? AND password=?`). Login on the frontend just uses a `name` and local storage `role`.
- **Role Management**: Handled via a single `users` table with a constraint `CHECK(role IN ('student', 'teacher', 'parent'))`. Student-specific configurations are in `student_profiles`, but Teachers and Parents do not have specialized profile tables.
- **AI Integration**:
  - TTS/STT is done on the frontend browser (Web Speech API), with a placeholder for Piper TTS (`en_US-lessac-medium.onnx`) locally in the backend.
  - Quiz generation and Tutor logic currently use mocked endpoints, prepared for Gemini or Qwen3.
- **Data Flow**: Teacher uploads PDF -> Backend extracts text (PyMuPDF) -> Creates a `content` record and `lesson` record. Then teachers can generate `quizzes` linked to lessons. Students enrolled in the class can see these lessons and take quizzes.

## 3. Database Migration Strategy (SQLite -> PostgreSQL)
Given the recent initialization of `my-agent-db` using Ghost MCP (PostgreSQL), the application needs to migrate from SQLite to Postgres.

**Schema Improvements in `schema.sql`**:
1. **UUIDs**: Switched from Python-generated string UUIDs to Postgres native `UUID` and `gen_random_uuid()`.
2. **Proper Data Types**: Utilized Postgres native enums (`user_role`, `difficulty_lvl`) for robust role tracking instead of text checks.
3. **JSONB**: Converted the `options` string field in `quiz_questions` to `JSONB` for optimized querying and storage.
4. **Security Upgrades**: Added `password_hash` column to replace plain text passwords. Added `is_active` and `last_login` for session management.
5. **Foreign Key Cascades**: Added `ON DELETE CASCADE` to relationships ensuring orphaned data is cleared (e.g., deleting a quiz deletes its questions).
6. **Role Profiles**: Created explicit `teacher_profiles` and `parent_profiles` to match the existing `student_profiles` concept for a normalized, scalable user structure.

## 4. Next Steps for Refactoring
To fully utilize the new PostgreSQL database, the following components in `backend/main.py` will require modifications:
1. **DB Connection**: Swap `sqlite3.connect` for `psycopg2` or an ORM like `SQLAlchemy` or `asyncpg`.
2. **Auth Refactor**: Integrate JWT (JSON Web Tokens) or OAuth for session persistence. Hash passwords via `bcrypt` upon registration.
3. **Data Access Layer**: Move SQL queries out of the API route handlers into dedicated repository/CRUD functions to decouple business logic from the database dialect.

## 5. Other Components (Frontend/Backend)
- **Frontend `login.js`**: Needs to collect standard email/password credentials instead of just a name, and handle a returned JWT token securely instead of saving unverified `user_id`s in `localStorage`.
- **Frontend APIs**: Replace hardcoded `http://localhost:8000` fetches with an environment variable (e.g., `process.env.NEXT_PUBLIC_API_URL`) to allow seamless switching between local dev and cloud-hosted deployments.
