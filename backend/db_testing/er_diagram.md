# AI Tutor ER Diagram

Below is the Entity-Relationship (ER) diagram for the newly migrated PostgreSQL schema. It represents the tables, their columns, and the relationships (foreign keys) connecting them.

```mermaid
erDiagram
    users {
        UUID id PK
        VARCHAR name
        VARCHAR email
        VARCHAR password_hash
        VARCHAR mobile
        user_role role
        BOOLEAN is_active
        TIMESTAMP last_login
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    teacher_profiles {
        UUID user_id PK, FK
        VARCHAR school
        VARCHAR department
        TEXT bio
    }
    student_profiles {
        UUID user_id PK, FK
        VARCHAR grade
        VARCHAR school
        VARCHAR preferred_language
        VARCHAR onset_type
        INTEGER age_of_onset
        VARCHAR braille_literacy
        VARCHAR residual_vision
        VARCHAR learning_mode
        VARCHAR speech_speed
        VARCHAR explanation_style
    }
    
    parent_profiles {
        UUID user_id PK, FK
        VARCHAR occupation
    }
    
    parent_student_links {
        UUID parent_id PK, FK
        UUID student_id PK, FK
        VARCHAR relationship
    }
    
    classes {
        UUID id PK
        UUID teacher_id FK
        VARCHAR name
        VARCHAR subject
        TIMESTAMP created_at
    }
    
    enrollments {
        UUID class_id PK, FK
        UUID student_id PK, FK
        TIMESTAMP enrolled_at
    }
    
    content {
        UUID id PK
        UUID class_id FK
        UUID teacher_id FK
        VARCHAR title
        VARCHAR subject
        VARCHAR file_name
        TEXT ocr_text
        TIMESTAMP uploaded_at
    }
    
    lessons {
        UUID id PK
        UUID content_id FK
        VARCHAR title
        TEXT transcript
    }
    
    quizzes {
        UUID id PK
        UUID lesson_id FK
        VARCHAR title
        difficulty_lvl difficulty_level
    }
    
    quiz_questions {
        UUID id PK
        UUID quiz_id FK
        TEXT question_text
        JSONB options
        TEXT correct_answer
    }
    
    quiz_attempts {
        UUID id PK
        UUID quiz_id FK
        UUID student_id FK
        INTEGER score
        INTEGER total_questions
        TIMESTAMP completed_at
    }
    
    student_answers {
        UUID id PK
        UUID attempt_id FK
        UUID question_id FK
        TEXT selected_answer
        BOOLEAN is_correct
    }

    users ||--o| teacher_profiles : "1:1 Role Profile"
    users ||--o| student_profiles : "1:1 Role Profile"
    users ||--o| parent_profiles : "1:1 Role Profile"
    
    users ||--o{ parent_student_links : "is Parent in"
    users ||--o{ parent_student_links : "is Student in"
    
    users ||--o{ classes : "Teacher teaches"
    users ||--o{ enrollments : "Student enrolled"
    classes ||--o{ enrollments : "has"
    
    classes ||--o{ content : "contains"
    users ||--o{ content : "Teacher uploaded"
    
    content ||--o{ lessons : "generates"
    lessons ||--o{ quizzes : "has"
    
    quizzes ||--o{ quiz_questions : "contains"
    
    quizzes ||--o{ quiz_attempts : "attempted in"
    users ||--o{ quiz_attempts : "Student attempts"
    
    quiz_attempts ||--o{ student_answers : "records"
    quiz_questions ||--o{ student_answers : "answered in"
```
