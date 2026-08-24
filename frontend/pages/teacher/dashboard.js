import DashboardLayout from "../../components/DashboardLayout";
import { Users, FileText, ListTodo, Trophy } from "lucide-react";

export default function TeacherDashboard() {
  const stats = [
    { label: "Total Students", value: "120", icon: <Users size={24} />, bg: "var(--purple-light)", color: "var(--purple)" },
    { label: "Assignments", value: "15", icon: <FileText size={24} />, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Quizzes Created", value: "28", icon: <ListTodo size={24} />, bg: "var(--amber-light)", color: "var(--amber)" },
    { label: "Avg. Score", value: "78%", icon: <Trophy size={24} />, bg: "var(--green-light)", color: "var(--green)" },
  ];

  const recentActivity = [
    { title: "Homework - Photosynthesis", desc: "Assigned to Class 10 A", time: "2 hrs ago" },
    { title: "Quiz - Plant Physiology", desc: "Created for Class 10 A", time: "5 hrs ago" },
    { title: "New Student - Rahul Sharma", desc: "Joined Class 10 A", time: "1 day ago" },
  ];

  const topStudents = [
    { name: "Ananya", score: "92%" },
    { name: "Rohit", score: "88%" },
    { name: "Kavya", score: "87%" },
    { name: "Arjun", score: "85%" },
  ];

  return (
    <DashboardLayout userName="Teacher" title="Dashboard" subtitle="Welcome back!">
      <div style={{ maxWidth: "1000px" }}>
        
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
            <h3 className="text-lg font-bold mb-6">Recent Activity</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {recentActivity.map((act, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px", paddingBottom: "16px", borderBottom: i === recentActivity.length - 1 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--purple-light)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 className="font-semibold mb-1">{act.title}</h4>
                    <p className="text-xs text-muted">{act.desc}</p>
                  </div>
                  <span className="text-xs text-muted">{act.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Students */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="text-lg font-bold mb-6">Top Performing Students</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
              {topStudents.map((student, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "16px", borderBottom: i === topStudents.length - 1 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {student.name.charAt(0)}
                    </div>
                    <span className="font-semibold">{student.name}</span>
                  </div>
                  <span className="font-bold text-green">{student.score}</span>
                </div>
              ))}
            </div>
            <button className="btn-outline w-full" style={{ marginTop: "auto" }}>View All Students</button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
