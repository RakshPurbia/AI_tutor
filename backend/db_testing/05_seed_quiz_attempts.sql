-- 05_seed_quiz_attempts.sql

-- 1. Insert Quiz Attempt (Aarav took the quiz)
INSERT INTO quiz_attempts (id, quiz_id, student_id, score, total_questions) VALUES
('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000002', 2, 2)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Student Answers
INSERT INTO student_answers (id, attempt_id, question_id, selected_answer, is_correct) VALUES
('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555551', 'Cochlea', true),
('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555552', 'Spiral', true)
ON CONFLICT (id) DO NOTHING;
