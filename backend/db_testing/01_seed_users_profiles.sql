-- 01_seed_users_profiles.sql
-- Hardcoded UUIDs for reliable foreign key references across demo scripts.

-- 1. Insert Core Users
INSERT INTO users (id, name, email, password_hash, mobile, role) VALUES 
('00000000-0000-0000-0000-000000000001', 'Ms. Rao', 'ms.rao@school.com', 'hashed_pw_placeholder', '9876543210', 'teacher'),
('00000000-0000-0000-0000-000000000002', 'Aarav Sharma', 'aarav@student.com', 'hashed_pw_placeholder', NULL, 'student'),
('00000000-0000-0000-0000-000000000003', 'Mr. Sharma', 'sharma.parent@email.com', 'hashed_pw_placeholder', '9123456789', 'parent')
ON CONFLICT (email) DO NOTHING;

-- 2. Insert Profiles
INSERT INTO teacher_profiles (user_id, school, department, bio) VALUES
('00000000-0000-0000-0000-000000000001', 'International Public School', 'Science', 'Passionate science teacher.')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO student_profiles (user_id, grade, school, preferred_language, onset_type, age_of_onset, braille_literacy, residual_vision, learning_mode, speech_speed, explanation_style) VALUES
('00000000-0000-0000-0000-000000000002', '7th Grade', 'International Public School', 'English', 'congenital', NULL, 'fluent', 'none', 'mostly_audio', 'normal', 'non_visual_tactile_sequential')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO parent_profiles (user_id, occupation) VALUES
('00000000-0000-0000-0000-000000000003', 'Software Engineer')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Link Parent to Student
INSERT INTO parent_student_links (parent_id, student_id, relationship) VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Father')
ON CONFLICT (parent_id, student_id) DO NOTHING;
