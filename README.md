# AI Tutor - Local Prototype

AI Tutor is a comprehensive, locally runnable prototype designed to provide an intelligent, accessible, and personalized learning experience for students, specifically tailored to assist visually impaired individuals. It features role-based segregation for Students, Teachers, and Parents.

## Features

*   **Role-Based Access**: Dedicated workflows and dashboards for Students, Teachers, and Parents starting from a unified entry point.
*   **Teacher Tools**: Upload PDF lessons directly to the platform. The backend automatically extracts text and can auto-generate contextual quizzes for the class.
*   **Student Dashboard**: A personalized view showing assigned lessons, pending quizzes, and learning progress.
*   **Voice Assistant (Accessibility)**: Built-in global voice controller for students. Powered by the browser's native Speech-to-Text and Text-to-Speech APIs, allowing students to navigate and read lessons completely hands-free ("Go to quizzes", "Read lesson").
*   **Quizzes & Assessment**: Automated grading and interactive quiz UI with instant feedback.

---

## Tech Stack

**Frontend**
*   **Framework**: Next.js (React)
*   **Styling**: Vanilla CSS (Custom Design System with variables)
*   **Icons**: Lucide React
*   **Accessibility**: Browser Web Speech API (`SpeechRecognition`, `speechSynthesis`)

**Backend**
*   **Framework**: FastAPI (Python)
*   **Database**: SQLite (Built-in, zero configuration)
*   **PDF Extraction**: PyMuPDF (`fitz`)

---

## Prerequisites

To run this project locally, you need the following installed on your machine:

1.  **Node.js (v18+)**: [Download Here](https://nodejs.org/)
2.  **Python 3.11+**: [Download Here](https://www.python.org/downloads/)

---

## Setup & Installation

### 1. Backend Setup (Python)

The backend runs on FastAPI and uses a local SQLite database that is automatically generated on the first run.

```bash
# Navigate to the backend directory
cd backend

# Install the required Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```
*The backend will be available at `http://localhost:8000`. You can view the interactive API documentation at `http://localhost:8000/docs`.*

### 2. Frontend Setup (Next.js)

Open a **new** terminal window for the frontend.

```bash
# Navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the Next.js development server
npm run dev
```
*The frontend will be available at `http://localhost:3000`.*

---

## Running the Application

1. Open `http://localhost:3000` in **Google Chrome or Microsoft Edge** (Required for the Web Speech API to function properly).
2. **Teacher Flow**:
   *   Select **Teacher** on the Role Selection screen.
   *   Login with a name (e.g., "Mr. Sharma").
   *   Navigate to **Upload Lesson**. Fill in the details and select a real `.pdf` file.
   *   Click Upload. The backend will parse the PDF and auto-generate a quiz.
3. **Student Flow**:
   *   Log out from the top right profile menu.
   *   Select **Student** on the Role Selection screen.
   *   Login with a name (e.g., "Rahul").
   *   You will see the lesson and quiz the teacher just uploaded.
   *   Click the **Mic icon** in the bottom right corner and say *"Read lesson"* or click on the quiz to attempt it.

---

## API Documentation

The backend exposes several RESTful endpoints scoped by user role. Below is a summary of the core endpoints.

### Authentication
*   **`POST /api/student/login`**: Authenticates or creates a student profile by name.
    *   *Body*: `{"name": "string"}`
    *   *Returns*: `{"message", "student_id"}`
*   **`POST /api/teacher/login`**: Authenticates or creates a teacher profile by name.
    *   *Body*: `{"name": "string"}`
    *   *Returns*: `{"message", "teacher_id"}`

### Content Management (Teacher)
*   **`POST /api/upload_file`**: Uploads a PDF, extracts text using PyMuPDF, and creates a lesson.
    *   *Headers*: `Content-Type: multipart/form-data`
    *   *Form Data*: `teacher_id`, `class_id`, `title`, `subject`, `file (PDF)`
    *   *Returns*: `{"content_id", "lesson_id", "extracted_text"}`
*   **`POST /api/teacher/quiz`**: Generates a new quiz for an existing lesson.
    *   *Body*: `{"teacher_id", "lesson_id", "title", "questions": [...]}`
    *   *Returns*: `{"quiz_id"}`
*   **`GET /api/teacher/{teacher_id}/classes`**: Retrieves all classes assigned to a teacher.
*   **`GET /api/teacher/{teacher_id}/lessons`**: Retrieves all lessons uploaded by a teacher.

### Student Access & Assessment
*   **`GET /api/student/{student_id}/lessons`**: Retrieves all lessons assigned to the student's class.
*   **`GET /api/student/{student_id}/quizzes`**: Retrieves all quizzes assigned to the student, including attempt status.
*   **`GET /api/quiz/{quiz_id}`**: Retrieves a specific quiz and its questions.
*   **`POST /api/quiz/attempt`**: Submits a student's quiz answers for grading.
    *   *Body*: `{"student_id", "quiz_id", "answers": [{"question_id", "selected_answer"}]}`
    *   *Returns*: `{"attempt_id", "score", "total"}`

---

## Known Limitations & Future Work

*   **Mock Authentication**: Currently, login acts as a passthrough using just the user's name to generate/retrieve a persistent ID. In production, this should be replaced with robust JWT or OAuth (e.g., Clerk or Firebase).
*   **Native AI Replacements**: 
    *   **STT/TTS**: Voice commands currently utilize the browser's native Web Speech API for immediate prototype viability. Future integrations will swap this for **Whisper** (Speech-to-Text) and **Edge TTS / ElevenLabs** (Text-to-Speech).
    *   **OCR**: Text extraction uses PyMuPDF. Scanned images or handwritten notes will require **PaddleOCR**.
    *   **LLM Integration**: Quiz generation and AI Tutor responses are currently mocked or lightly generated. The architecture is prepared to inject **Qwen3** for robust pedagogical interactions and RAG implementations.
