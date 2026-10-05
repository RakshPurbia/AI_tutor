import { useState, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";

export default function Settings() {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [tutorName, setTutorName] = useState("Tutor");
  const [defaultGender, setDefaultGender] = useState("female");
  const [speechSpeed, setSpeechSpeed] = useState("normal");
  const [studentId, setStudentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sid = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
      setStudentId(sid);
      fetchProfiles(sid);
    }
  }, []);

  const fetchProfiles = async (sid) => {
    try {
      const res = await fetch(`http://localhost:8000/api/voice-profiles/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        setActiveProfileId(data.active_profile_id || "");
        setTutorName(data.tutor_name || "Tutor");
        
        const lowerName = (data.tutor_name || "").toLowerCase();
        if (lowerName.includes("male") && !lowerName.includes("female")) {
          setDefaultGender("male");
        } else {
          setDefaultGender("female");
        }
      }

      const profRes = await fetch(`http://localhost:8000/api/profile/${sid}`);
      if (profRes.ok) {
        const pData = await profRes.json();
        setSpeechSpeed(pData.speech_speed || "normal");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleActiveChange = async (e) => {
    const val = e.target.value;
    setActiveProfileId(val);
    try {
      await fetch("http://localhost:8000/api/voice-profiles/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          voice_profile_id: val === "" ? null : val,
          default_gender: val === "" ? defaultGender : null
        })
      });
      fetchProfiles(studentId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenderChange = async (gender) => {
    setDefaultGender(gender);
    try {
      await fetch("http://localhost:8000/api/voice-profiles/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          voice_profile_id: null,
          default_gender: gender
        })
      });
      fetchProfiles(studentId);
    } catch (e) { console.error(e); }
  };

  const handleSpeedChange = async (speed) => {
    setSpeechSpeed(speed);
    try {
      await fetch(`http://localhost:8000/api/profile/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speech_speed: speed })
      });
    } catch (e) { console.error(e); }
  };

  const handleUpload = async () => {
    if (!file || !newPersonaName) return alert("Select a file and provide a persona name");
    setUploading(true);
    const fd = new FormData();
    fd.append("student_id", studentId);
    fd.append("persona_name", newPersonaName);
    fd.append("audio_sample", file);
    try {
      const res = await fetch("http://localhost:8000/api/voice-profiles", {
        method: "POST",
        body: fd
      });
      if (res.ok) {
        alert("Voice profile uploaded successfully!");
        setNewPersonaName("");
        setFile(null);
        fetchProfiles(studentId);
      } else {
        alert("Failed to upload.");
      }
    } catch (e) {
      console.error(e);
      alert("Error uploading.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout userName="Ananya" title="Accessibility Settings">
      <div style={{ maxWidth: "600px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          
          {/* Text Size */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="font-semibold">Text Size</span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-outline" style={{ flex: 1, padding: "12px" }}>A-</button>
              <button className="btn-outline" style={{ flex: 1, padding: "12px", background: "var(--purple-light)", color: "var(--purple-dark)", borderColor: "var(--purple)" }}>Medium</button>
              <button className="btn-outline" style={{ flex: 1, padding: "12px" }}>A+</button>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* High Contrast */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="font-semibold">High Contrast</span>
            <div style={{ width: "44px", height: "24px", background: "var(--purple)", borderRadius: "12px", position: "relative", cursor: "pointer" }}>
              <div style={{ width: "20px", height: "20px", background: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }}></div>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Voice Personalization */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="font-semibold">AI Tutor Voice Profile</span>
              <select 
                value={activeProfileId || ""}
                onChange={handleActiveChange}
                style={{ width: "200px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}
              >
                <option value="">Default AI Tutor</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.persona_name}</option>
                ))}
              </select>
            </div>
            
            {/* Default Voice Gender */}
            {(!activeProfileId || activeProfileId === "") && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px", background: "var(--bg-card-hover)", borderRadius: "8px" }}>
                <span className="font-semibold" style={{ fontSize: "14px" }}>Default Voice Gender</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className={defaultGender === "female" ? "btn-primary" : "btn-outline"}
                    onClick={() => handleGenderChange("female")}
                    style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                  >
                    Female
                  </button>
                  <button 
                    className={defaultGender === "male" ? "btn-primary" : "btn-outline"}
                    onClick={() => handleGenderChange("male")}
                    style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                  >
                    Male
                  </button>
                </div>
              </div>
            )}

            {/* Speech Speed */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px", background: "var(--bg-card-hover)", borderRadius: "8px" }}>
              <span className="font-semibold" style={{ fontSize: "14px" }}>Pitch Rate / Speech Speed</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button 
                  className={speechSpeed === "slow" ? "btn-primary" : "btn-outline"}
                  onClick={() => handleSpeedChange("slow")}
                  style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                >
                  Slow
                </button>
                <button 
                  className={speechSpeed === "normal" ? "btn-primary" : "btn-outline"}
                  onClick={() => handleSpeedChange("normal")}
                  style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                >
                  Medium
                </button>
                <button 
                  className={speechSpeed === "fast" ? "btn-primary" : "btn-outline"}
                  onClick={() => handleSpeedChange("fast")}
                  style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
                >
                  High
                </button>
              </div>
            </div>
            
            <div style={{ marginTop: "16px", padding: "16px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <h4 style={{ fontWeight: "bold", marginBottom: "12px", fontSize: "14px" }}>Add Custom Voice Profile</h4>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                Upload a 10-second voice sample (WAV/MP3) to clone a trusted voice like a parent, teacher, or friend.
              </p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input 
                  type="text" 
                  placeholder="Persona Name (e.g. Ram, Mom)" 
                  value={newPersonaName}
                  onChange={e => setNewPersonaName(e.target.value)}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <input 
                  type="file" 
                  accept="audio/*"
                  onChange={e => setFile(e.target.files[0])}
                  style={{ width: "200px" }}
                />
              </div>
              <button 
                onClick={handleUpload} 
                disabled={uploading}
                className="btn-primary" 
                style={{ marginTop: "12px", padding: "8px 16px", borderRadius: "8px" }}
              >
                {uploading ? "Uploading..." : "Upload Voice"}
              </button>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Screen Reader Support */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="font-semibold">Screen Reader Support</span>
            <div style={{ width: "44px", height: "24px", background: "var(--purple)", borderRadius: "12px", position: "relative", cursor: "pointer" }}>
              <div style={{ width: "20px", height: "20px", background: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }}></div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
