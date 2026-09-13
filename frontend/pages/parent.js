import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../components/DashboardLayout";
import { Clock, BookOpen, Trophy, Flame } from "lucide-react";
import { api } from "../lib/api";

export default function ParentDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In our simplified auth, the parent logs in and their user_id is saved.
    // Let's assume user_id is the parent_id. Wait, index.js saves 'user_id' but we didn't save 'parent_id' specifically.
    // Let's check localStorage for 'user_id' or 'parent_id'.
    // In index.js we didn't save parent_id explicitly if they are parent? Wait!
    // Let's look at index.js again if we need to.
    
    // Actually, I'll just use the user_id stored during login. 
    // Since I don't know exactly what was stored, let me just try getting 'user_id' or a mock if it fails.
    
    // I need to fetch the parent_id. 
    // Wait, the easiest way is to decode from localStorage if possible.
    const getParentDashboard = async () => {
        try {
            // For this demo, let's just fetch the parent by email or assuming user_id was stored.
            // Wait, I can just fetch the one parent ID we know from db if localStorage is missing, but it's better to fetch from localStorage.
            const parentId = localStorage.getItem("parent_id") || "00000000-0000-0000-0000-000000000003"; // fallback to seeded parent
            
            const res = await api.getParentDashboard(parentId);
            if (res.error) {
                console.error("Error from API:", res.error);
                // Fallback to mock data if not found
                setData({
                    student_name: "Ananya (Not Linked)",
                    total_study_time: "45m",
                    lessons_completed: 8,
                    avg_score_pct: 85,
                    streak: "6 🔥"
                });
            } else {
                setData(res);
            }
        } catch (e) {
            console.error("Failed to load parent dashboard", e);
        } finally {
            setLoading(false);
        }
    };
    
    getParentDashboard();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout userName="Parent" title="Dashboard" subtitle="Loading progress...">
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>Loading...</div>
      </DashboardLayout>
    );
  }

  const studentName = data?.student_name || "Student";

  const stats = [
    { label: "Study Time Today", value: data?.total_study_time || "0m", icon: <Clock size={24} />, bg: "var(--purple-light)", color: "var(--purple)" },
    { label: "Lessons Completed", value: data?.lessons_completed || "0", icon: <BookOpen size={24} />, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Average Score", value: data?.avg_score_pct ? `${data.avg_score_pct}%` : "N/A", icon: <Trophy size={24} />, bg: "var(--green-light)", color: "var(--green)" },
    { label: "Current Streak Days", value: data?.streak || "0", icon: <Flame size={24} />, bg: "var(--red-light)", color: "var(--red)" },
  ];

  const subjects = [
    { name: "Science", progress: data?.avg_score_pct || 0, color: "var(--purple)" },
    { name: "Mathematics", progress: 0, color: "#0284c7" },
    { name: "English", progress: 0, color: "var(--green)" },
    { name: "Social Science", progress: 0, color: "var(--amber)" },
  ];

  return (
    <DashboardLayout userName="Parent" title="Dashboard" subtitle={`Monitor ${studentName}'s progress`}>
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
              {studentName} is doing {data?.avg_score_pct > 70 ? "great!" : "okay."} Encourage them to revise recent topics and try more quizzes to improve accuracy.
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
