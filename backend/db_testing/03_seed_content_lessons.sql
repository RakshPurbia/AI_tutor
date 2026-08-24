-- 03_seed_content_lessons.sql

-- 1. Insert Content Upload (Ear Anatomy PDF)
INSERT INTO content (id, class_id, teacher_id, title, subject, file_name, ocr_text) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Ear Anatomy Chapter 3', 'Science', 'ear_anatomy.pdf', 'The cochlea is a spiral-shaped part of the inner ear that converts sound vibrations into nerve signals sent to the brain.')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Lesson from Content
INSERT INTO lessons (id, content_id, title, transcript) VALUES
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'The Cochlea', 'The cochlea is a spiral-shaped part of the inner ear that converts sound vibrations into nerve signals sent to the brain.')
ON CONFLICT (id) DO NOTHING;
