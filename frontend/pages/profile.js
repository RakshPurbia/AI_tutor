import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../components/DashboardLayout";
import { User, Activity, Headphones, EyeOff, Sparkles, Clock } from "lucide-react";

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [diagnosticQuizzes, setDiagnosticQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
        const res = await fetch(`http://localhost:8000/api/profile/${studentId}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
        
        // Fetch Quizzes to find diagnostics
        const quizzesRes = await fetch(`http://localhost:8000/api/student/${studentId}/quizzes`);
        if (quizzesRes.ok) {
          const allQuizzes = await quizzesRes.json();
          const diagnostics = allQuizzes.filter(quiz => quiz.title.toLowerCase().includes("diagnostic"));
          setDiagnosticQuizzes(diagnostics);
        }
      } catch (e) {
        console.error("Failed to fetch profile or quizzes", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <DashboardLayout><div style={{ padding: "40px" }}>Loading profile...</div></DashboardLayout>;
  if (!profile) return <DashboardLayout><div style={{ padding: "40px" }}>Failed to load profile.</div></DashboardLayout>;

  return (
    <DashboardLayout userName={profile.name} title="Student Profile">
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header Card */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--purple-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple)", fontSize: "32px" }}>
            <User size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-main)", marginBottom: "4px" }}>{profile.name}</h2>
            <p className="text-muted" style={{ fontSize: "16px" }}>{profile.grade || "Grade Not Set"} • {profile.school || "School Not Set"}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          
          {/* Condition History */}
          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity className="text-purple" /> Condition History
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <span className="text-sm text-muted">Onset Type</span>
                <p style={{ fontWeight: "600" }}>{profile.onset_type === 'congenital' ? "From Birth (Congenital)" : profile.onset_type === 'acquired' ? "Acquired Later" : "Not specified"}</p>
              </div>
              {profile.onset_type === 'acquired' && (
                <>
                  <div>
                    <span className="text-sm text-muted">Age of Onset</span>
                    <p style={{ fontWeight: "600" }}>{profile.age_of_onset ? `${profile.age_of_onset} years old` : "Not specified"}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted">Residual Vision</span>
                    <p style={{ fontWeight: "600", textTransform: "capitalize" }}>{profile.residual_vision ? profile.residual_vision.replace('_', ' ') : "Not specified"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Accessibility Preferences */}
          <div className="card">
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles className="text-purple" /> Accessibility
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <span className="text-sm text-muted">Learning Mode</span>
                <p style={{ fontWeight: "600", textTransform: "capitalize", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Headphones size={16} /> {profile.learning_mode ? profile.learning_mode.replace('_', ' ') : "Audio"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted">Speech Speed</span>
                <p style={{ fontWeight: "600", textTransform: "capitalize" }}>{profile.speech_speed || "Normal"}</p>
              </div>
              <div>
                <span className="text-sm text-muted">Braille Literacy</span>
                <p style={{ fontWeight: "600", textTransform: "capitalize" }}>{profile.braille_literacy || "Not specified"}</p>
              </div>
            </div>
          </div>

          {/* Diagnostic Assessments */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity className="text-purple" /> Diagnostic Assessments
            </h3>
            {diagnosticQuizzes.length === 0 ? (
              <p className="text-muted">No diagnostic assessments generated yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {diagnosticQuizzes.map((quiz, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", padding: "16px", border: "1px solid var(--border)", borderRadius: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>{quiz.title}</h4>
                      <p className="text-sm text-muted">Status: {quiz.attempted > 0 ? "Completed" : "Pending"}</p>
                    </div>
                    <button 
                      className="btn-primary" 
                      onClick={() => router.push(`/quiz?id=${quiz.quiz_id}`)}
                      style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                    >
                      {quiz.attempted > 0 ? "View Results" : "Take Assessment"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
