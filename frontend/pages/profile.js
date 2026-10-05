import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../components/DashboardLayout";
import { User, Activity, Headphones, EyeOff, Sparkles, Clock, Volume2 } from "lucide-react";

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [diagnosticQuizzes, setDiagnosticQuizzes] = useState([]);
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);
  
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [tutorName, setTutorName] = useState("Tutor");
  const [defaultGender, setDefaultGender] = useState("female");
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceFile, setNewVoiceFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchVoiceProfiles = async (studentId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/voice-profiles/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setVoiceProfiles(data.profiles || []);
        setActiveProfileId(data.active_profile_id);
        setTutorName(data.tutor_name || "Tutor");
        const lowerName = (data.tutor_name || "").toLowerCase();
        if (lowerName.includes("male") && !lowerName.includes("female")) {
          setDefaultGender("male");
        } else {
          setDefaultGender("female");
        }
        window.dispatchEvent(new CustomEvent("voice_profile_updated", { detail: { tutor_name: data.tutor_name || "Tutor" } }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRole(localStorage.getItem("user_role") || localStorage.getItem("role") || "student");
    }
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
        
        await fetchVoiceProfiles(studentId);
      } catch (e) {
        console.error("Failed to fetch profile or quizzes", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUploadVoice = async (e) => {
    e.preventDefault();
    if (!newVoiceName || !newVoiceFile) return alert("Please provide a name and an audio sample.");
    setIsUploading(true);
    const formData = new FormData();
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    formData.append("student_id", studentId);
    formData.append("persona_name", newVoiceName);
    formData.append("audio_sample", newVoiceFile);

    try {
      const res = await fetch("http://localhost:8000/api/voice-profiles", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setNewVoiceName("");
        setNewVoiceFile(null);
        e.target.reset(); // clear file input
        await fetchVoiceProfiles(studentId);
      } else {
        alert("Failed to upload voice profile.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSetActive = async (profileId, gender = null) => {
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    try {
      const res = await fetch("http://localhost:8000/api/voice-profiles/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, voice_profile_id: profileId, default_gender: gender })
      });
      if (res.ok) {
        await fetchVoiceProfiles(studentId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteVoice = async (profileId) => {
    if (!confirm("Are you sure you want to delete this voice profile?")) return;
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    try {
      const res = await fetch(`http://localhost:8000/api/voice-profiles/${profileId}?student_id=${studentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchVoiceProfiles(studentId);
      } else {
        alert("Failed to delete voice profile.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <DashboardLayout role={role} disableAutoTTS={role !== "student"}><div style={{ padding: "40px" }}>Loading profile...</div></DashboardLayout>;
  if (!profile) return <DashboardLayout role={role} disableAutoTTS={role !== "student"}><div style={{ padding: "40px" }}>Failed to load profile.</div></DashboardLayout>;

  return (
    <DashboardLayout role={role} disableAutoTTS={role !== "student"} userName={profile.name} title="Student Profile">
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

          {/* Voice Clone & AI Tutor Persona Settings */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Volume2 className="text-purple" /> AI Tutor Persona & Voice Cloning
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h4 style={{ fontWeight: "bold", marginBottom: "12px", fontSize: "15px" }}>Available Voice Clones</h4>
                
                {/* Default Voice Gender Selection */}
                {!activeProfileId && (
                  <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px", background: "var(--bg-card-hover)", padding: "16px", borderRadius: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontWeight: "bold", fontSize: "15px" }}>Default AI Tutor Gender</h4>
                      <p className="text-sm text-muted">Select the preferred voice gender for the default neural audio.</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        className={defaultGender === "female" ? "btn-primary" : "btn-outline"}
                        onClick={() => handleSetActive(null, "female")}
                        style={{ padding: "8px 16px", borderRadius: "8px" }}
                      >
                        Female
                      </button>
                      <button 
                        className={defaultGender === "male" ? "btn-primary" : "btn-outline"}
                        onClick={() => handleSetActive(null, "male")}
                        style={{ padding: "8px 16px", borderRadius: "8px" }}
                      >
                        Male
                      </button>
                    </div>
                  </div>
                )}

                {voiceProfiles.length === 0 && (
                  <p className="text-sm text-muted">No custom voice clones uploaded yet. Upload a voice sample below or use default neural audio.</p>
                )}
              </div>

              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                {voiceProfiles.map(vp => (
                  <div key={vp.id} style={{ 
                    border: activeProfileId === vp.id ? "2px solid var(--purple)" : "1px solid var(--border)", 
                    padding: "16px", borderRadius: "12px", minWidth: "200px" 
                  }}>
                    <h4 style={{ fontWeight: "bold" }}>{vp.persona_name}</h4>
                    <p className="text-sm text-muted" style={{ marginBottom: "16px" }}>
                      Created: {new Date(vp.created_at).toLocaleDateString()}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                      <button 
                        className={activeProfileId === vp.id ? "btn-primary" : "btn-outline"}
                        onClick={() => handleSetActive(activeProfileId === vp.id ? null : vp.id)}
                        style={{ flex: 1, padding: "8px", borderRadius: "8px" }}
                      >
                        {activeProfileId === vp.id ? "Active" : "Set Active"}
                      </button>
                      <button 
                        className="btn-outline"
                        onClick={() => handleDeleteVoice(vp.id)}
                        style={{ padding: "8px 12px", borderRadius: "8px", borderColor: "#ff4444", color: "#ff4444" }}
                        title="Delete voice profile"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--bg-card-hover)", padding: "24px", borderRadius: "12px" }}>
                <h4 style={{ fontWeight: "bold", marginBottom: "16px" }}>Add New Voice Clone</h4>
                <p className="text-sm text-muted" style={{ marginBottom: "24px" }}>
                  Upload a clear 10-second audio sample without background noise. The assistant will respond to "Hey {newVoiceName || '[Name]'}".
                </p>
                <form onSubmit={handleUploadVoice} style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>Clone Name</label>
                    <input 
                      type="text" 
                      value={newVoiceName}
                      onChange={e => setNewVoiceName(e.target.value)}
                      placeholder="e.g. Jarvis"
                      style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "white" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>Audio Sample (10s)</label>
                    <input 
                      type="file" 
                      accept="audio/*"
                      onChange={e => setNewVoiceFile(e.target.files[0])}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "white" }}
                    />
                  </div>
                  <button type="submit" disabled={isUploading} className="btn-primary" style={{ padding: "12px 24px", borderRadius: "8px", height: "46px" }}>
                    {isUploading ? "Uploading..." : "Create Voice"}
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
