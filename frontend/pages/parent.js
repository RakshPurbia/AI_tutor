import DashboardLayout from "../components/DashboardLayout";
import { Clock, BookOpen, Trophy, Flame } from "lucide-react";

export default function ParentDashboard() {
  const stats = [
    { label: "Study Time Today", value: "45m", icon: <Clock size={24} />, bg: "var(--purple-light)", color: "var(--purple)" },
    { label: "Lessons Completed This Week", value: "8", icon: <BookOpen size={24} />, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Average Score This Week", value: "85%", icon: <Trophy size={24} />, bg: "var(--green-light)", color: "var(--green)" },
    { label: "Current Streak Days", value: "6 🔥", icon: <Flame size={24} />, bg: "var(--red-light)", color: "var(--red)" },
  ];

  const subjects = [
    { name: "Science", progress: 85, color: "var(--purple)" },
    { name: "Mathematics", progress: 72, color: "#0284c7" },
    { name: "English", progress: 92, color: "var(--green)" },
    { name: "Social Science", progress: 60, color: "var(--amber)" },
  ];

  return (
    <DashboardLayout userName="Parent" title="Dashboard" subtitle="Monitor Ananya's progress">
      <div style={{ maxWidth: "1000px" }}>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6" style={{ marginBottom: "32px" }}>
          {stats.map((s, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p className="text-xs text-muted mb-4 font-semibold">{s.label}</p>
              <h3 className="text-2xl font-bold">{s.value}</h3>
            </div>
          ))}
        </div>

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

          {/* AI Recommendation */}
          <div className="card" style={{ display: "flex", flexDirection: "column", background: "var(--purple-bg)", borderColor: "var(--purple-border)" }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--purple-dark)" }}>AI Recommendation</h3>
            
            <p className="text-base mb-6" style={{ lineHeight: "1.6", color: "var(--text-main)" }}>
              Ananya is doing great! Encourage her to revise 'Photosynthesis' and try more quizzes to improve accuracy.
            </p>
            
            <div style={{ marginTop: "auto" }}>
              <button className="btn-primary w-full" style={{ padding: "14px" }}>View Detailed Report</button>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
