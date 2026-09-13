import DashboardLayout from "../components/DashboardLayout";
import { BookOpen, Trophy, Play, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();
  const [studentName, setStudentName] = useState("");
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const name = localStorage.getItem("student_name") || "Student";
    const studentId = localStorage.getItem("student_id");
    setStudentName(name);

    if (studentId && studentId !== "undefined") {
      // Fetch Lessons
      fetch(`http://localhost:8000/api/student/${studentId}/lessons`)
        .then(res => res.json())
        .then(data => setLessons(data))
        .catch(err => console.error("Error fetching lessons", err));

      // Fetch Quizzes
      fetch(`http://localhost:8000/api/student/${studentId}/quizzes`)
        .then(res => res.json())
        .then(data => setQuizzes(data))
        .catch(err => console.error("Error fetching quizzes", err));
    }
  }, []);

  return (
    <DashboardLayout userName={studentName} title="Dashboard" subtitle="Welcome back!">
      <div style={{ maxWidth: "1200px" }}>

        {/* Continue Learning Section */}
        <section style={{ marginBottom: "48px" }}>
          <h2 className="text-xl font-bold mb-6">Continue Learning</h2>
          {lessons.length === 0 ? (
            <p className="text-muted">No lessons assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {lessons.map((lesson, i) => (
                <div key={i} className="card" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: i % 2 === 0 ? "var(--purple-light)" : "#e0f2fe", color: i % 2 === 0 ? "var(--purple)" : "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BookOpen size={32} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="text-xs text-purple font-semibold mb-1">{lesson.subject || "Subject"}</p>
                    <h3 className="text-lg font-bold mb-2">{lesson.title}</h3>
                    <div className="progress-bar-container" style={{ marginBottom: "8px" }}>
                      <div className="progress-bar-fill" style={{ width: "0%" }}></div>
                    </div>
                    <p className="text-xs text-muted">0% Completed</p>
                  </div>
                  <button className="btn-primary" style={{ padding: "12px", borderRadius: "50%" }}>
                    <Play size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-8">
          {/* Quick Actions (Keep same) */}
          <section>
            <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="card" style={{ cursor: "pointer", textAlign: "center" }} onClick={() => router.push('/tutor')}>
                <div style={{ width: "48px", height: "48px", background: "var(--purple-light)", color: "var(--purple)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <BookOpen size={24} />
                </div>
                <h4 className="font-bold">Ask AI Tutor</h4>
              </div>
              <div className="card" style={{ cursor: "pointer", textAlign: "center" }} onClick={() => router.push('/explain-image')}>
                <div style={{ width: "48px", height: "48px", background: "var(--green-light)", color: "var(--green)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Trophy size={24} />
                </div>
                <h4 className="font-bold">Explain Image</h4>
              </div>
            </div>
          </section>

          {/* New Assignments (Quizzes) */}
          <section>
            <h2 className="text-xl font-bold mb-6">Your Quizzes</h2>
            {quizzes.length === 0 ? (
              <div className="card text-center"><p className="text-muted">No quizzes available.</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {quizzes.map((quiz, i) => (
                  <div key={i} className="card" style={{ display: "flex", alignItems: "center", padding: "16px 24px", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: quiz.attempted > 0 ? "var(--green-light)" : "var(--amber-light)", color: quiz.attempted > 0 ? "var(--green)" : "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {quiz.attempted > 0 ? <CheckCircle size={20} /> : <Trophy size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 className="font-bold mb-1">{quiz.title}</h4>
                      <p className="text-sm text-muted">For {quiz.lesson_title}</p>
                    </div>
                    <button
                      className="btn-outline"
                      style={{ padding: "8px 16px", fontSize: "14px", borderColor: quiz.attempted > 0 ? "var(--green)" : "var(--purple)", color: quiz.attempted > 0 ? "var(--green)" : "var(--purple)" }}
                      onClick={() => router.push(`/quiz?id=${quiz.quiz_id}`)}
                    >
                      {quiz.attempted > 0 ? "Attempt Again" : "Start Quiz"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>
    </DashboardLayout>
  );
}
