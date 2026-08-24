-- 02_seed_classes_enrollments.sql

-- 1. Insert Class (Linked to Teacher Ms. Rao)
INSERT INTO classes (id, teacher_id, name, subject) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '7th Grade Science', 'Science')
ON CONFLICT (id) DO NOTHING;

-- 2. Enroll Student (Aarav) into Class
INSERT INTO enrollments (class_id, student_id) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (class_id, student_id) DO NOTHING;
