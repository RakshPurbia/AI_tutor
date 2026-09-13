import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../../components/DashboardLayout";
import { Users, FileText, ListTodo, Trophy, PlusCircle, UploadCloud } from "lucide-react";
import { api } from "../../lib/api";

export default function TeacherDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const teacherId = localStorage.getItem("teacher_id");
    if (!teacherId) {
      router.push("/");
      return;
    }
    
    api.getTeacherDashboard(teacherId)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching dashboard", err);
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout userName="Teacher" title="Dashboard" subtitle="Welcome back!">
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>Loading...</div>
      </DashboardLayout>
    );
  }

  const stats = [
    { label: "Total Students", value: data?.students || 0, icon: <Users size={24} />, bg: "var(--purple-light)", color: "var(--purple)" },
    { label: "Lessons Assigned", value: data?.recent_lessons?.length || 0, icon: <FileText size={24} />, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Quizzes Completed", value: data?.completed || 0, icon: <ListTodo size={24} />, bg: "var(--amber-light)", color: "var(--amber)" },
    { label: "Avg. Score", value: data?.avg_score_pct ? `${data.avg_score_pct}%` : "N/A", icon: <Trophy size={24} />, bg: "var(--green-light)", color: "var(--green)" },
  ];

  return (
    <DashboardLayout userName={typeof window !== "undefined" ? (localStorage.getItem("user_name") || "Teacher") : "Teacher"} title="Teacher Workspace" subtitle="Manage classes, assign lessons, and track progress.">
      <div style={{ maxWidth: "1000px" }}>
        
        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
          <button 
            className="btn-primary" 
            style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, justifyContent: "center", padding: "16px", fontSize: "16px" }}
            onClick={() => router.push("/teacher/upload")}
          >
            <UploadCloud size={20} /> Assign Lesson / PPT
          </button>
          <button 
            className="btn-secondary" 
            style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, justifyContent: "center", padding: "16px", fontSize: "16px", background: "white", color: "var(--purple)", border: "2px solid var(--purple)" }}
            onClick={() => router.push("/teacher/quiz-create")}
          >
            <ListTodo size={20} /> Create Quiz
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6" style={{ marginBottom: "32px" }}>
          {stats.map((s, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ background: s.bg, color: s.color, width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                {s.icon}
              </div>
              <p className="text-xs text-muted mb-2 font-semibold">{s.label}</p>
              <h3 className="text-3xl font-bold">{s.value}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-lg font-bold mb-6">Recent Uploads & Assignments</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {data?.recent_lessons?.length > 0 ? data.recent_lessons.map((lesson, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px", paddingBottom: "16px", borderBottom: i === data.recent_lessons.length - 1 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--purple-light)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 className="font-semibold mb-1">{lesson.title}</h4>
                    <p className="text-xs text-muted">Assigned to: {lesson.class_name}</p>
                  </div>
                  <span className="text-xs font-bold" style={{ color: lesson.status === "Completed" ? "var(--green)" : "var(--purple)" }}>{lesson.status}</span>
                </div>
              )) : (
                <p className="text-muted text-sm text-center py-4">No lessons assigned yet.</p>
              )}
            </div>
          </div>

          {/* Classes Overview */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="text-lg font-bold mb-6">My Classes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
              {data?.classes?.length > 0 ? data.classes.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "16px", borderBottom: i === data.classes.length - 1 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--amber-light)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      <Users size={16} />
                    </div>
                    <div>
                      <span className="font-semibold block">{c.name}</span>
                      <span className="text-xs text-muted">{c.subject}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-muted text-sm text-center py-4">No classes assigned yet.</p>
              )}
            </div>
            <button className="btn-outline w-full" style={{ marginTop: "auto" }}>View All Classes</button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
