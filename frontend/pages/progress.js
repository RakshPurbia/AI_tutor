import DashboardLayout from "../components/DashboardLayout";
import { Clock, BookOpen, Trophy, Flame } from "lucide-react";

export default function Progress() {
  const stats = [
    { label: "Study Time This Week", value: "6h 45m", icon: <Clock size={20} />, color: "var(--purple)", bg: "var(--purple-light)" },
    { label: "Lessons Completed This Week", value: "12", icon: <BookOpen size={20} />, color: "#0284c7", bg: "#e0f2fe" },
    { label: "Average Quiz Score This Week", value: "82%", icon: <Trophy size={20} />, color: "var(--amber)", bg: "var(--amber-light)" },
    { label: "Current Streak Days", value: "7 🔥", icon: <Flame size={20} />, color: "var(--red)", bg: "var(--red-light)" },
  ];

  const subjects = [
    { name: "Science", progress: 75, color: "var(--purple)" },
    { name: "Mathematics", progress: 60, color: "#0284c7" },
    { name: "English", progress: 90, color: "var(--green)" },
    { name: "Social Science", progress: 40, color: "var(--amber)" },
  ];

  const weakTopics = [
    "Photosynthesis",
    "Algebraic Equations",
    "Tenses in English"
  ];

  return (
    <DashboardLayout userName="Ananya" title="My Progress">
      <div style={{ maxWidth: "1000px" }}>
        
        {/* Top Stats Grid */}
        <div className="grid grid-cols-4 gap-6" style={{ marginBottom: "32px" }}>
          {stats.map((s, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p className="text-xs text-muted mb-4 font-semibold">{s.label}</p>
              <h3 className="text-2xl font-bold mb-4">{s.value}</h3>
              {/* <div style={{ background: s.bg, color: s.color, padding: "8px", borderRadius: "50%" }}>
                {s.icon}
              </div> */}
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

          {/* Weak Topics */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="text-lg font-bold mb-6">Weak Topics</h3>
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
            <button className="btn-primary" style={{ marginTop: "24px" }}>Get Recommendations</button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
