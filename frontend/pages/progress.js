import DashboardLayout from "../components/DashboardLayout";
import { Clock, BookOpen, Trophy, Flame, CheckCircle, Award, CheckCircle2, PlayCircle, Layers } from "lucide-react";
import { useEffect, useState } from "react";

export default function Progress() {
  const [role, setRole] = useState("student");
  const [studentName, setStudentName] = useState("Student");
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [curriculumModules, setCurriculumModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRole(localStorage.getItem("user_role") || localStorage.getItem("role") || "student");
    const name = localStorage.getItem("student_name") || "Student";
    setStudentName(name);

    const rawId = localStorage.getItem("student_id");
    const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;

    // 1. Fetch Quiz Scores & Attempts
    fetch(`http://localhost:8000/api/student/${studentId}/progress`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setQuizAttempts(data);
        }
      })
      .catch(err => {
        console.error("Error fetching quiz progress:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Fetch Lesson Curriculum & Progress
    fetch(`http://localhost:8000/api/student/${studentId}/curriculum`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.modules)) {
          setCurriculumModules(data.modules);
        }
      })
      .catch(err => {
        console.error("Error fetching curriculum:", err);
      });
  }, []);

  // Calculate dynamic stats from saved quiz marks
  const totalAttempts = quizAttempts.length;
  let totalScore = 0;
  let totalPossible = 0;
  quizAttempts.forEach(qa => {
    totalScore += (qa.score || 0);
    totalPossible += (qa.total || 0);
  });
  const avgScorePct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : (totalAttempts > 0 ? 80 : 0);

  // Calculate lesson progress
  let totalLessons = 0;
  let completedLessons = 0;
  curriculumModules.forEach(mod => {
    (mod.lessons || []).forEach(l => {
      totalLessons++;
      if (l.status === "completed") {
        completedLessons++;
      }
    });
  });
  const lessonProgressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const stats = [
    { label: "Lessons Completed", value: `${completedLessons} / ${totalLessons}`, icon: <BookOpen size={20} />, color: "var(--purple)", bg: "var(--purple-light)" },
    { label: "Quizzes Completed", value: `${totalAttempts}`, icon: <Award size={20} />, color: "#0284c7", bg: "#e0f2fe" },
    { label: "Average Quiz Score", value: totalAttempts > 0 ? `${avgScorePct}%` : "No attempts yet", icon: <Trophy size={20} />, color: "var(--amber)", bg: "var(--amber-light)" },
    { label: "Current Streak Days", value: "7 🔥", icon: <Flame size={20} />, color: "var(--red)", bg: "var(--red-light)" },
  ];

  // Dynamic subjects from curriculum modules
  const subjects = curriculumModules.length > 0
    ? curriculumModules.map((m, idx) => {
        const modTotal = m.lessons?.length || 0;
        const modDone = (m.lessons || []).filter(l => l.status === "completed").length;
        const pct = modTotal > 0 ? Math.round((modDone / modTotal) * 100) : 0;
        const colors = ["var(--purple)", "#0284c7", "var(--green)", "var(--amber)"];
        return {
          name: m.title || m.subject || `Module ${idx + 1}`,
          progress: pct,
          color: colors[idx % colors.length]
        };
      })
    : [
        { name: "Science", progress: 75, color: "var(--purple)" },
        { name: "Biology - Heart Anatomy", progress: 100, color: "var(--green)" },
        { name: "Astronomy", progress: 60, color: "#0284c7" },
        { name: "English", progress: 85, color: "var(--amber)" },
      ];

  const weakTopics = [
    "Heart Anatomy - Blood Flow & Valves",
    "Photosynthesis",
    "Ear Anatomy - Cochlea"
  ];

  return (
    <DashboardLayout 
      role={role}
      disableAutoTTS={role !== "student"}
      userName={studentName} 
      title={role === "parent" ? "Student Progress Summary" : "My Progress"}
      subtitle={role === "parent" ? "Overview of student progress, lesson completion, and saved quiz marks" : "Here are your saved marks, lesson progress, and checkpoints"}
    >
      <div style={{ maxWidth: "1000px" }}>
        
        {/* Top Stats Grid */}
        <div className="grid grid-cols-4 gap-6" style={{ marginBottom: "32px" }}>
          {stats.map((s, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p className="text-xs text-muted mb-4 font-semibold">{s.label}</p>
              <h3 className="text-2xl font-bold mb-4">{s.value}</h3>
            </div>
          ))}
        </div>

        {/* 1. Lesson Progress & Curriculum Mastery Section */}
        <div className="card" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <BookOpen size={22} className="text-purple" />
              <h3 className="text-lg font-bold" style={{ margin: 0 }}>Lesson Modules & Progress</h3>
            </div>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--purple)" }}>
              {completedLessons} of {totalLessons} Lessons Completed ({lessonProgressPct}%)
            </span>
          </div>

          {/* Overall Progress Bar */}
          <div className="progress-bar-container" style={{ marginBottom: "24px", height: "10px" }}>
            <div 
              className="progress-bar-fill" 
              style={{ width: `${lessonProgressPct}%`, background: "var(--purple)", transition: "width 0.6s ease" }}
            ></div>
          </div>

          {curriculumModules.length === 0 ? (
            <p className="text-muted" style={{ margin: 0, padding: "12px 0" }}>
              Loading lesson curriculum...
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {curriculumModules.map((module, mIdx) => (
                <div 
                  key={mIdx} 
                  style={{ 
                    border: "1px solid var(--border)", 
                    borderRadius: "12px", 
                    padding: "16px",
                    background: "var(--bg)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Layers size={16} className="text-purple" />
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700" }}>{module.title}</h4>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                      {module.lessons?.length || 0} Lessons
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(module.lessons || []).map((lesson, lIdx) => {
                      const isCompleted = lesson.status === "completed";
                      const isInProgress = lesson.status === "in_progress";
                      return (
                        <div 
                          key={lIdx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "var(--card-bg, #ffffff)",
                            borderRadius: "8px",
                            border: "1px solid var(--border)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", width: "20px" }}>
                              {lIdx + 1}.
                            </span>
                            <span style={{ fontSize: "14px", fontWeight: "600" }}>
                              {lesson.title}
                            </span>
                          </div>

                          <div>
                            {isCompleted ? (
                              <span 
                                style={{ 
                                  display: "inline-flex", alignItems: "center", gap: "5px",
                                  padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "700",
                                  background: "var(--green-light)", color: "var(--green)"
                                }}
                              >
                                <CheckCircle size={13} /> Completed
                              </span>
                            ) : isInProgress ? (
                              <span 
                                style={{ 
                                  display: "inline-flex", alignItems: "center", gap: "5px",
                                  padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "700",
                                  background: "#e0f2fe", color: "#0284c7"
                                }}
                              >
                                <PlayCircle size={13} /> In Progress
                              </span>
                            ) : (
                              <span 
                                style={{ 
                                  display: "inline-flex", alignItems: "center", gap: "5px",
                                  padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "600",
                                  background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)"
                                }}
                              >
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Saved Quiz Marks Section */}
        <div className="card" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Award size={22} className="text-purple" />
              <h3 className="text-lg font-bold" style={{ margin: 0 }}>Saved Quiz Checkpoints & Marks</h3>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
              {quizAttempts.length} Recorded Attempt{quizAttempts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {quizAttempts.length === 0 ? (
            <p className="text-muted" style={{ margin: 0, padding: "16px 0" }}>
              No quiz attempts recorded yet. Attempt a quiz from your Dashboard or AI Tutor to save your marks here!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {quizAttempts.map((qa, i) => {
                const pct = qa.total > 0 ? Math.round((qa.score / qa.total) * 100) : 0;
                const isGood = pct >= 70;
                return (
                  <div 
                    key={i} 
                    style={{ 
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", background: "var(--bg)", borderRadius: "12px",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700" }}>
                        {qa.quiz_title?.replace("Quiz: ", "") || "Quiz Checkpoint"}
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                        Completed on {qa.completed_at ? new Date(qa.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Recently"}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span 
                        style={{ 
                          padding: "6px 14px", borderRadius: "99px", fontSize: "13px", fontWeight: "700",
                          background: isGood ? "var(--green-light)" : "var(--amber-light)",
                          color: isGood ? "var(--green)" : "var(--amber)"
                        }}
                      >
                        {qa.score} / {qa.total} ({pct}%)
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--green)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle size={14} /> Saved in Progress
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Subject Progress & Recommendations */}
        <div className="grid grid-cols-2 gap-8">
          {/* Subject Progress */}
          <div className="card">
            <h3 className="text-lg font-bold mb-6">Subject Progress</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {subjects.map((sub, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span className="text-sm font-semibold">{sub.name}</span>
                    <span className="text-sm font-bold">{sub.progress}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${sub.progress}%`, background: sub.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendation / Focus Areas */}
          {role === "parent" ? (
            <div className="card" style={{ display: "flex", flexDirection: "column", background: "var(--purple-bg)", borderColor: "var(--purple-border)" }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: "var(--purple-dark)" }}>AI Recommendations & Insights</h3>
              <p className="text-base mb-6" style={{ lineHeight: "1.6", color: "var(--text-main)" }}>
                The student is making steady progress! Encourage them to review <strong>Heart Anatomy - Blood Flow & Valves</strong> to boost quiz accuracy.
              </p>
              <h4 className="text-sm font-bold mb-4">Areas to Focus:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                {weakTopics.map((topic, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "8px", height: "8px", background: "var(--red)", borderRadius: "50%" }}></div>
                    <span className="text-sm font-medium">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              <h3 className="text-lg font-bold mb-6">Focus Areas</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {weakTopics.map((topic, i) => (
                  <div key={i} style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", background: "var(--red-light)", color: "var(--red)", borderRadius: "8px", display: "flex", alignItems: "center", justifyItems: "center", padding: "6px" }}>
                      <Flame size={20} />
                    </div>
                    <span className="text-sm font-medium">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
