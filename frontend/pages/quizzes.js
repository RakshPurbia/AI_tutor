import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const sid = localStorage.getItem("student_id");
    if (sid) {
      api.getStudentQuizzes(sid).then(setQuizzes).catch(console.error);
    }
  }, []);

  return (
    <div className="page">
      <div className="nav-row">
        <Link href="/dashboard" className="nav-link">&larr; Dashboard</Link>
      </div>
      <div className="card">
        <p className="step-title">My Quizzes</p>
        {quizzes.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No quizzes assigned yet.</p>
        )}
        {quizzes.map((q) => (
          <Link
            key={q.quiz_id}
            href={`/quiz?quiz_id=${q.quiz_id}`}
            className="option-btn"
            style={{ textDecoration: "none", display: "flex" }}
          >
            <span>{q.title} <span style={{ color: "var(--text-muted)" }}>&middot; {q.lesson_title}</span></span>
            {q.attempted > 0 && <span className="status-pill completed">Completed</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
