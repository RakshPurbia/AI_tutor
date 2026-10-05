import { useRouter } from "next/router";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const role = localStorage.getItem("selected_role") || "student";
    
    if (role === "student") {
      try {
        const res = await fetch("http://localhost:8000/api/student/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        localStorage.setItem("student_id", data.student_id);
        localStorage.setItem("student_name", name);
        localStorage.setItem("role", "student");
        localStorage.setItem("user_role", "student");
        router.push("/onboarding");
      } catch (err) { console.error(err); }
    } else if (role === "teacher") {
      try {
        const res = await fetch("http://localhost:8000/api/teacher/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        localStorage.setItem("teacher_id", data.teacher_id);
        localStorage.setItem("teacher_name", name);
        localStorage.setItem("role", "teacher");
        localStorage.setItem("user_role", "teacher");
        router.push("/teacher/dashboard");
      } catch (err) { console.error(err); }
    } else if (role === "parent") {
      localStorage.setItem("role", "parent");
      localStorage.setItem("user_role", "parent");
      router.push("/parent");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-illustration">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
          <div style={{ background: "white", color: "var(--purple)", padding: "8px", borderRadius: "8px", display: "flex" }}>
            <GraduationCap size={32} />
          </div>
          <span className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>AI Tutor</span>
        </div>
        
        <h1 className="text-3xl font-bold mb-4" style={{ marginBottom: "16px", color: "var(--text-main)" }}>AI-Powered Learning<br />for Everyone</h1>
        <p className="text-muted" style={{ maxWidth: "400px", lineHeight: "1.6" }}>
          Making education accessible, intelligent, and inclusive for visually impaired students.
        </p>
        
        <div style={{ marginTop: "60px", width: "300px", height: "300px", background: "url('https://placehold.co/300x300/e0e7ff/5b4fe0?text=Illustration') no-repeat center center", backgroundSize: "cover", borderRadius: "16px" }}></div>
      </div>

      <div className="auth-form-container">
        <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto" }}>
          <h2 className="text-2xl font-bold mb-2" style={{ marginBottom: "8px" }}>Welcome Back!</h2>
          <p className="text-muted" style={{ marginBottom: "32px" }}>Login to continue your learning journey</p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Your Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter your name to login" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <input type="password" className="input-field" placeholder="Enter password (optional for demo)" />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
              <Link href="#" className="text-sm text-purple font-medium" style={{ textDecoration: "none" }}>Forgot Password?</Link>
            </div>

            <button type="submit" className="btn-primary w-full" style={{ padding: "16px", fontSize: "16px", marginBottom: "24px" }}>
              Login
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "24px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
            <span className="text-sm text-muted">or continue with</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
          </div>

          <button className="btn-outline w-full" style={{ padding: "14px", marginBottom: "32px" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <p className="text-center text-sm">
            <span className="text-muted">Don't have an account? </span>
            <Link href="#" className="text-purple font-semibold" style={{ textDecoration: "none" }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
