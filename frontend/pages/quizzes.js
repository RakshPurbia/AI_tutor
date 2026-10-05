import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import DashboardLayout from "../components/DashboardLayout";
import { ClipboardList } from "lucide-react";

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);

  const [studentName, setStudentName] = useState("Student");
  const autoAnnouncedRef = useRef(false);

  useEffect(() => {
    const sid = localStorage.getItem("student_id");
    const name = localStorage.getItem("student_name") || "Student";
    setStudentName(name);
    if (sid) {
      api.getStudentQuizzes(sid).then(setQuizzes).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (quizzes.length > 0 && !autoAnnouncedRef.current) {
      autoAnnouncedRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("play_global_tts", {
          detail: { text: `Welcome to Quizzes. You have ${quizzes.length} available quizzes.` }
        }));
      }, 1500);
    }
  }, [quizzes]);



  return (
    <DashboardLayout userName={studentName} title="My Quizzes" subtitle="Review your checkpoints and progress" disableAutoTTS={true}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        
        {quizzes.length === 0 && (
          <div className="card" style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>No quizzes assigned yet.</p>
          </div>
        )}
        
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {quizzes.map((q) => (
            <Link
              key={q.quiz_id}
              href={`/quiz?quiz_id=${q.quiz_id}`}
              className="card"
              style={{ 
                textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px", transition: "all 0.2s", color: "var(--text-color)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "var(--purple-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple)" }}>
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>{q.title}</h3>
                  <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>{q.lesson_title}</p>
                </div>
              </div>
              
              <div>
                {q.attempted > 0 ? (
                  <span style={{ background: "var(--success-light)", color: "var(--success)", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" }}>
                    Completed
                  </span>
                ) : (
                  <span style={{ background: "var(--surface-color)", color: "var(--text-muted)", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", border: "1px solid var(--border)" }}>
                    Not Started
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
