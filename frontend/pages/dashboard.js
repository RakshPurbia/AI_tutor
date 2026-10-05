import DashboardLayout from "../components/DashboardLayout";
import { BookOpen, Trophy, Play, CheckCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();
  const [studentName, setStudentName] = useState("");
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [pendingWelcomeMsg, setPendingWelcomeMsg] = useState("");

  const welcomeSpokenRef = useRef(false);

  useEffect(() => {
    const handleAudioBlocked = () => setAudioBlocked(true);
    window.addEventListener("audio_blocked", handleAudioBlocked);
    return () => window.removeEventListener("audio_blocked", handleAudioBlocked);
  }, []);

  useEffect(() => {
    const name = localStorage.getItem("student_name") || "Student";
    const studentId = localStorage.getItem("student_id");
    setStudentName(name);

    if (studentId && studentId !== "undefined") {
      // Fetch Curriculum Modules & Progress
      fetch(`http://localhost:8000/api/student/${studentId}/curriculum`)
        .then(res => res.json())
        .then(data => {
          if (data && data.modules) {
            setLessons(data.modules);
            if (!welcomeSpokenRef.current) {
                welcomeSpokenRef.current = true;
                const title = data.modules.length > 0 ? data.modules[0].title : "";
                const msg = title 
                    ? `Welcome to the dashboard, let me know what you would like to hear. Your next upcoming module is ${title}. Say 'go to lesson' to start.` 
                    : "Welcome to the dashboard, let me know what you would like to hear. You have no upcoming modules.";
                setPendingWelcomeMsg(msg);
                
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("play_global_tts", { detail: { text: msg } }));
                }, 1500); // Increased delay to ensure VoiceController is fully mounted and ready
            }
          }
        })
        .catch(err => console.error("Error fetching curriculum", err));

      // Fetch Quizzes
      fetch(`http://localhost:8000/api/student/${studentId}/quizzes`)
        .then(res => res.json())
        .then(data => setQuizzes(data))
        .catch(err => console.error("Error fetching quizzes", err));
    }
  }, []);

  return (
    <DashboardLayout userName={studentName} title="Dashboard" subtitle="Welcome back!" disableAutoTTS={true}>
      <div style={{ maxWidth: "1200px" }}>

        {/* Continue Learning Section */}
        <section style={{ marginBottom: "48px" }}>
          <h2 className="text-xl font-bold mb-6">Continue Learning</h2>
          {lessons.length === 0 ? (
            <p className="text-muted">No curriculum modules assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {lessons.map((mod, i) => {
                const activeLesson = mod.lessons ? (mod.lessons.find(l => l.status === "in_progress") || mod.lessons[0]) : null;
                const activeLessonId = activeLesson ? activeLesson.id : "";
                const activeLessonTitle = activeLesson ? activeLesson.title : mod.title;

                return (
                  <div 
                    key={i} 
                    className="card" 
                    style={{ display: "flex", gap: "24px", alignItems: "center", cursor: "pointer", transition: "all 0.2s" }}
                    onClick={() => router.push(`/lessons${activeLessonId ? `?lesson_id=${activeLessonId}` : ''}`)}
                  >
                    <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: i % 2 === 0 ? "var(--purple-light)" : "#e0f2fe", color: i % 2 === 0 ? "var(--purple)" : "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BookOpen size={32} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="text-xs text-purple font-semibold mb-1">{mod.subject || "Subject"}</p>
                      <h3 className="text-lg font-bold mb-1">{mod.title}</h3>
                      <p className="text-xs text-muted mb-2">
                        {mod.progress_pct === 100 ? "Completed! Review" : `Active: ${activeLessonTitle}`}
                      </p>
                      <div className="progress-bar-container" style={{ marginBottom: "6px" }}>
                        <div className="progress-bar-fill" style={{ width: `${mod.progress_pct}%`, background: mod.progress_pct === 100 ? "var(--green)" : "var(--purple)" }}></div>
                      </div>
                      <p className="text-xs text-muted font-medium">{mod.progress_pct}% Completed ({mod.completed_count || 0}/{mod.total_count || mod.lessons?.length || 1} sections)</p>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ padding: "12px", borderRadius: "50%", background: mod.progress_pct === 100 ? "var(--green)" : "var(--purple)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/lessons${activeLessonId ? `?lesson_id=${activeLessonId}` : ''}`);
                      }}
                    >
                      <Play size={20} />
                    </button>
                  </div>
                );
              })}
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

      {audioBlocked && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "white", padding: "48px", borderRadius: "24px",
            maxWidth: "480px", width: "90%", textAlign: "center",
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)"
          }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--purple-light)", color: "var(--purple)", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={40} fill="currentColor" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Start Your Session</h2>
            <p className="text-muted text-base mb-8" style={{ lineHeight: "1.6" }}>
              Your browser has paused the AI Tutor's voice. Click the button below to activate your interactive dashboard and hear your greeting.
            </p>
            <button 
              className="btn-primary" 
              style={{ width: "100%", padding: "16px", fontSize: "18px", borderRadius: "16px", fontWeight: "700" }}
              onClick={() => {
                setAudioBlocked(false);
                window.dispatchEvent(new CustomEvent("play_global_tts", { detail: { text: pendingWelcomeMsg } }));
              }}
            >
              Start Learning &rarr;
            </button>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
