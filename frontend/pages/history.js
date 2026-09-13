import DashboardLayout from "../components/DashboardLayout";
import { BookOpen, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export default function History() {
  const [role, setRole] = useState("student");

  useEffect(() => {
    setRole(localStorage.getItem("user_role") || localStorage.getItem("role") || "student");
  }, []);

  const historyItems = [
    { title: "Science - Chapter 5", desc: "Life Processes in Plants - 30m", time: "Today, 10:00 AM", color: "var(--purple)", bg: "var(--purple-light)" },
    { title: "Mathematics - Chapter 3", desc: "Pair of Linear Equations - 45m", time: "Today, 09:15 AM", color: "#0284c7", bg: "#e0f2fe" },
    { title: "English - Chapter 2", desc: "Noun and its Types - 20m", time: "Yesterday, 06:30 PM", color: "var(--green)", bg: "var(--green-light)" },
    { title: "Science - Chapter 4", desc: "Life Process in Animals - 30m", time: "Yesterday, 05:00 PM", color: "var(--amber)", bg: "var(--amber-light)" },
  ];

  return (
    <DashboardLayout 
      userName="Ananya" 
      title={role === "parent" ? "Child Learning History" : "Learning History"}
      subtitle={role === "parent" ? "Overview of recent lessons and activities" : undefined}
    >
      <div style={{ maxWidth: "800px" }}>
        
        {/* Tabs (Hidden for Parents for a simpler summary view) */}
        {role !== "parent" && (
          <div style={{ display: "flex", gap: "32px", borderBottom: "1px solid var(--border)", marginBottom: "32px" }}>
            <div style={{ padding: "12px 0", borderBottom: "2px solid var(--purple)", color: "var(--purple)", fontWeight: "600", cursor: "pointer" }}>Lessons</div>
            <div style={{ padding: "12px 0", color: "var(--text-muted)", cursor: "pointer" }}>Chats</div>
            <div style={{ padding: "12px 0", color: "var(--text-muted)", cursor: "pointer" }}>Quizzes</div>
            <div style={{ padding: "12px 0", color: "var(--text-muted)", cursor: "pointer" }}>Uploads</div>
          </div>
        )}

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {historyItems.map((item, i) => (
            <div key={i} className="card" style={{ display: "flex", alignItems: "center", padding: "20px 24px", gap: "20px", cursor: "pointer" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: item.bg, color: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={24} />
              </div>
              
              <div style={{ flex: 1 }}>
                <h4 className="font-bold mb-1">{item.title}</h4>
                <p className="text-sm text-muted">{item.desc}</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                <span className="text-sm text-muted">{item.time}</span>
                <ChevronRight size={20} className="text-muted" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
