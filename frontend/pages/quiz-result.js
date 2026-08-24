import DashboardLayout from "../components/DashboardLayout";
import { Trophy } from "lucide-react";
import { useRouter } from "next/router";

export default function QuizResult() {
  const router = useRouter();
  const { score, total } = router.query;
  
  const scoreNum = parseInt(score) || 0;
  const totalNum = parseInt(total) || 0;
  const accuracy = totalNum > 0 ? Math.round((scoreNum / totalNum) * 100) : 0;
  const wrong = totalNum - scoreNum;

  return (
    <DashboardLayout userName={typeof window !== "undefined" ? localStorage.getItem("student_name") || "Student" : ""} title="Quiz Result" subtitle="Your performance">
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", padding: "48px 32px", textAlign: "center" }}>
        
        <div style={{ width: "80px", height: "80px", background: "var(--amber-light)", color: "var(--amber)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Trophy size={40} />
        </div>

        <h1 style={{ fontSize: "56px", fontWeight: "800", marginBottom: "8px", color: "var(--text-main)" }}>{scoreNum} <span className="text-3xl text-muted">/ {totalNum}</span></h1>
        
        <h3 className="text-2xl font-bold mb-2">Great job! 🎉</h3>
        <p className="text-base text-muted mb-12" style={{ marginBottom: "48px" }}>You have a good understanding of this topic.</p>

        <div style={{ textAlign: "left", marginBottom: "48px" }}>
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

        <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
          <button className="btn-primary" style={{ padding: "12px 32px" }} onClick={() => router.push("/dashboard")}>Return to Dashboard</button>
        </div>

      </div>
    </DashboardLayout>
  );
}
