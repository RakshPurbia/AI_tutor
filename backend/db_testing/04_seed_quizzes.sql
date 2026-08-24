-- 04_seed_quizzes.sql

-- 1. Insert Quiz for the Lesson
INSERT INTO quizzes (id, lesson_id, title, difficulty_level) VALUES
('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Ear Anatomy Quiz', 'medium')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Quiz Questions
INSERT INTO quiz_questions (id, quiz_id, question_text, options, correct_answer) VALUES
('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444444', 'Which part of the ear detects vibrations?', '["Eardrum", "Ossicles", "Cochlea", "Ear Canal"]'::jsonb, 'Cochlea'),
('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444444', 'What shape is the cochlea?', '["Square", "Spiral", "Flat", "Triangular"]'::jsonb, 'Spiral')
ON CONFLICT (id) DO NOTHING;
