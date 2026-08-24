import { useState } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/api";

export default function TeacherLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const result = await api.teacherLogin(name);
      localStorage.setItem("teacher_id", result.teacher_id);
      localStorage.setItem("teacher_name", name);
      router.push("/teacher/dashboard");
    } catch (e) {
      alert("Could not log in. Is the backend running on localhost:8000?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <p className="step-title">Teacher Login</p>
        <p style={{ color: "var(--text-muted)", marginBottom: 16, fontSize: 13 }}>
          Demo login - no password yet (Clerk/Firebase Auth is the planned
          real integration). Enter any name to continue.
        </p>
        <label>Your name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" disabled={!name || loading} onClick={submit}>
          {loading ? "Logging in..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
