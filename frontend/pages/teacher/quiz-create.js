import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/api";
import TeacherNav from "../../components/TeacherNav";

const BASE_URL = "http://localhost:8000";

export default function QuizCreate() {
  const router = useRouter();
  const [lessons, setLessons] = useState([]);
  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([
    { question_text: "", options: ["", "", "", ""], correct_answer: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const teacherId = localStorage.getItem("teacher_id");
    if (!teacherId) {
      router.push("/teacher/login");
      return;
    }
    // reuse the dashboard's recent_lessons list to populate the lesson picker
    api.getTeacherDashboard(teacherId).then((d) => {
      setLessons(d.recent_lessons || []);
      if (d.recent_lessons?.[0]) setLessonId(d.recent_lessons[0].lesson_id);
    });
  }, [router]);

  const updateQuestion = (idx, field, value) => {
    setQuestions((qs) => {
      const copy = [...qs];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const updateOption = (qIdx, optIdx, value) => {
    setQuestions((qs) => {
      const copy = [...qs];
      const opts = [...copy[qIdx].options];
      opts[optIdx] = value;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, { question_text: "", options: ["", "", "", ""], correct_answer: "" }]);
  };

  const submit = async () => {
    setSaving(true);
    const teacherId = localStorage.getItem("teacher_id");
    try {
      await api.createQuiz({
        teacher_id: teacherId,
        lesson_id: lessonId,
        title,
        questions: questions
          .filter((q) => q.question_text && q.correct_answer)
          .map((q) => ({ ...q, options: q.options.filter((o) => o) })),
      });
      setDone(true);
    } catch (e) {
      alert("Could not create quiz.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherNav>
      <div className="card">
        <p className="step-title">Create a Quiz</p>

        <label>For lesson</label>
        <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          {lessons.map((l) => (
            <option key={l.lesson_id} value={l.lesson_id}>{l.title}</option>
          ))}
        </select>

        <label>Quiz title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ear Anatomy Quiz" />

        {questions.map((q, qIdx) => (
          <div key={qIdx} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <label>Question {qIdx + 1}</label>
            <input
              type="text"
              value={q.question_text}
              onChange={(e) => updateQuestion(qIdx, "question_text", e.target.value)}
              placeholder="Which part of the ear detects vibrations?"
            />
            {q.options.map((opt, optIdx) => (
              <input
                key={optIdx}
                type="text"
                value={opt}
                onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                placeholder={`Option ${optIdx + 1}`}
                style={{ marginBottom: 8 }}
              />
            ))}
            <label>Correct answer (must match one option exactly)</label>
            <input
              type="text"
              value={q.correct_answer}
              onChange={(e) => updateQuestion(qIdx, "correct_answer", e.target.value)}
            />
          </div>
        ))}

        <button className="btn-secondary" onClick={addQuestion}>+ Add another question</button>

        {!done ? (
          <button className="btn-primary" disabled={!title || !lessonId || saving} onClick={submit}>
            {saving ? "Creating..." : "Create Quiz"}
          </button>
        ) : (
          <div style={{ background: "var(--green-light)", color: "var(--green)", padding: 16, borderRadius: 12, textAlign: "center", marginTop: 12 }}>
            Quiz created! Enrolled students will see it under &ldquo;My Quizzes.&rdquo;
          </div>
        )}
      </div>
    </TeacherNav>
  );
}
