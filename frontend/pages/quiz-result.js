import DashboardLayout from "../components/DashboardLayout";
import { Trophy, ArrowRight, BookOpen, CheckCircle } from "lucide-react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function QuizResult() {
  const router = useRouter();
  const { score, total, quiz_id, lesson_id } = router.query;
  
  const scoreNum = parseInt(score) || 0;
  const totalNum = parseInt(total) || 0;
  const accuracy = totalNum > 0 ? Math.round((scoreNum / totalNum) * 100) : 0;
  const wrong = totalNum - scoreNum;

  const [nextLesson, setNextLesson] = useState(null);
  const [moduleCompleted, setModuleCompleted] = useState(false);

  useEffect(() => {
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    api.getStudentCurriculum(studentId)
      .then(curr => {
        if (!curr || !curr.modules) return;

        // Find the module containing this lesson
        let foundMod = null;
        let currentLessonObj = null;

        for (const m of curr.modules) {
          const l = m.lessons.find(item => item.id === lesson_id);
          if (l) {
            foundMod = m;
            currentLessonObj = l;
            break;
          }
        }

        if (foundMod && currentLessonObj) {
          // Find next lesson in the sequence
          const currentIndex = foundMod.lessons.findIndex(item => item.id === lesson_id);
          if (currentIndex !== -1 && currentIndex < foundMod.lessons.length - 1) {
            const next = foundMod.lessons[currentIndex + 1];
            setNextLesson(next);
          } else {
            // Check if all lessons in module are completed
            const allDone = foundMod.lessons.every(l => l.status === "completed" || l.id === lesson_id);
            if (allDone) {
              setModuleCompleted(true);
            }
          }
        } else if (curr.active_lesson && curr.active_lesson.id !== lesson_id) {
          setNextLesson(curr.active_lesson);
        }
      })
      .catch(console.error);
  }, [lesson_id]);

  const studentName = typeof window !== "undefined" ? (localStorage.getItem("student_name") || "Student") : "Student";

  return (
    <DashboardLayout userName={studentName} title="Quiz Result" subtitle="Checkpoint performance">
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", padding: "48px 32px", textAlign: "center" }}>
        
        <div style={{ width: "80px", height: "80px", background: "var(--amber-light)", color: "var(--amber)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Trophy size={40} />
        </div>

        <h1 style={{ fontSize: "56px", fontWeight: "800", marginBottom: "8px", color: "var(--text-main)" }}>{scoreNum} <span className="text-3xl text-muted">/ {totalNum}</span></h1>
        
        <h3 className="text-2xl font-bold mb-2">Great job! 🎉</h3>
        <p className="text-base text-muted mb-8" style={{ marginBottom: "32px" }}>You have completed this section quiz checkpoint.</p>

        {/* Performance Overview Grid */}
        <div style={{ textAlign: "left", marginBottom: "36px" }}>
          <h4 className="text-sm font-bold text-muted mb-4">Performance Overview</h4>
          <div className="grid grid-cols-3 gap-6">
            <div style={{ background: "var(--bg)", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
              <p className="text-sm font-semibold text-green mb-2">Correct Answers</p>
              <p className="text-3xl font-bold">{scoreNum}</p>
            </div>
            <div style={{ background: "var(--bg)", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
              <p className="text-sm font-semibold text-red mb-2">Wrong Answers</p>
              <p className="text-3xl font-bold">{wrong}</p>
            </div>
            <div style={{ background: "var(--bg)", padding: "24px", borderRadius: "16px", textAlign: "center" }}>
              <p className="text-sm font-semibold text-purple mb-2">Accuracy</p>
              <p className="text-3xl font-bold">{accuracy}%</p>
            </div>
          </div>
        </div>

        {/* Next Section in Curriculum Unlocked Banner */}
        {nextLesson && (
          <div style={{ 
            background: "var(--purple-light)", 
            border: "2px solid var(--purple)", 
            borderRadius: "16px", 
            padding: "20px 24px", 
            marginBottom: "36px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            textAlign: "left"
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "var(--purple)" }}>
                Next Section Unlocked
              </span>
              <h4 className="text-lg font-bold" style={{ color: "var(--purple-dark)", marginTop: "2px" }}>
                {nextLesson.title}
              </h4>
              <p className="text-sm text-muted">Continue your sequenced learning flow!</p>
            </div>
            <button 
              className="btn-primary" 
              onClick={() => router.push(`/lessons?lesson_id=${nextLesson.id}`)}
              style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px", borderRadius: "12px" }}
            >
              <span>Proceed to Next Section</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {moduleCompleted && !nextLesson && (
          <div style={{ 
            background: "var(--green-light)", 
            border: "2px solid var(--green)", 
            borderRadius: "16px", 
            padding: "24px", 
            marginBottom: "36px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            textAlign: "left"
          }}>
            <CheckCircle size={32} color="var(--green)" />
            <div>
              <h4 className="text-lg font-bold text-green">All sections in this module completed!</h4>
              <p className="text-sm text-muted">You have finished all sequenced content and quiz checkpoints for this topic.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
          <button 
            className="btn-outline" 
            style={{ padding: "12px 28px", display: "flex", alignItems: "center", gap: "8px" }} 
            onClick={() => router.push("/lessons")}
          >
            <BookOpen size={16} />
            <span>Curriculum Overview</span>
          </button>
          <button 
            className="btn-primary" 
            style={{ padding: "12px 28px" }} 
            onClick={() => router.push("/dashboard")}
          >
            Return to Dashboard
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}
