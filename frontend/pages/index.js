import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GraduationCap, Presentation, Users, ArrowRight, ArrowLeft, BookOpen, Mic, TrendingUp } from "lucide-react";

export default function UnifiedPortal() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", confirmPassword: "", mobile: "", school: "", activationCode: ""
  });

  const roles = [
    { id: "student", title: "Student", desc: "Interactive AI lessons & quizzes", icon: <GraduationCap size={28} />, color: "#8b5cf6", bg: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)" },
    { id: "teacher", title: "Teacher", desc: "Classroom analytics & tools", icon: <Presentation size={28} />, color: "#0ea5e9", bg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)" },
    { id: "parent", title: "Parent", desc: "Track progress & insights", icon: <Users size={28} />, color: "#10b981", bg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)" }
  ];

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match"); return;
    }
    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = { role: selectedRole, email: formData.email, password: formData.password };
      if (!isLogin) {
        payload.name = formData.name;
        if (selectedRole === "teacher") payload.school = formData.school;
        if (selectedRole === "parent") { payload.mobile = formData.mobile; payload.activation_code = formData.activationCode; }
      }
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("user_role", data.role);
      if (data.role === "student") {
        localStorage.setItem("student_id", data.user_id);
        router.push(isLogin ? "/dashboard" : "/onboarding");
      } else if (data.role === "teacher") {
        localStorage.setItem("teacher_id", data.user_id);
        router.push("/teacher/dashboard");
      } else {
        router.push("/parent/dashboard");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const activeRole = roles.find(r => r.id === selectedRole);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", backgroundColor: "#ffffff", color: "#0f172a", overflow: "hidden" }}>
      
      {/* Left Column: Beautiful layout mimicking the provided image */}
      <div style={{ flex: 1.3, display: "flex", padding: "40px 60px", backgroundColor: "#f9f8ff", position: "relative", overflow: "hidden" }}>
        
        {/* Soft gradient floor for the 3D character */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "30%", background: "linear-gradient(180deg, rgba(249,248,255,0) 0%, #edeaff 100%)", zIndex: 0 }}></div>

        {/* Left Side (Text & Features) */}
        <div style={{ flex: 1, zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "420px", opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <h1 style={{ fontSize: "44px", fontWeight: "900", color: "#0f172a", lineHeight: "1.15", marginBottom: "16px", letterSpacing: "-1px" }}>
            <span style={{ color: "#6d28d9" }}>AI-Powered</span><br />
            Learning for<br />Everyone
          </h1>
          
          <p style={{ fontSize: "16px", color: "#475569", lineHeight: "1.5", marginBottom: "36px", fontWeight: "500" }}>
            Making education <strong style={{ color: "#0f172a" }}>accessible</strong>, <strong style={{ color: "#0f172a" }}>intelligent</strong> and <strong style={{ color: "#0f172a" }}>inclusive</strong> for visually impaired students worldwide.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Feature 1 */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d28d9", boxShadow: "0 4px 10px rgba(109, 40, 217, 0.1)" }}>
                <Mic size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "2px" }}>Voice First</h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Learn using your voice</p>
              </div>
            </div>
            
            {/* Feature 2 */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d28d9", boxShadow: "0 4px 10px rgba(109, 40, 217, 0.1)" }}>
                <BookOpen size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "2px" }}>AI Tutor</h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Get instant explanations</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d28d9", boxShadow: "0 4px 10px rgba(109, 40, 217, 0.1)" }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", marginBottom: "2px" }}>Smart Progress</h4>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>Track & improve daily</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (3D Image) */}
        <div style={{ flex: 1.2, zIndex: 1, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <img 
            src="/3d-student.png" 
            alt="3D Student" 
            style={{ 
              height: "85%",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.15))",
              opacity: mounted ? 1 : 0, 
              transform: mounted ? "translateY(0)" : "translateY(20px)", 
              transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s"
            }} 
          />
        </div>
      </div>

      {/* Right Column: Interactive Login Portal (replaces the flat buttons from the reference image) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px", maxWidth: "600px", margin: "0 auto", zIndex: 10, overflowY: "auto", backgroundColor: "#ffffff" }}>
        
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s" }}>
          
          {!selectedRole ? (
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontSize: "36px", fontWeight: "900", color: "#0f172a", lineHeight: 1.2, letterSpacing: "-0.5px" }}>Get Started</h1>
            </div>
          ) : (
            <div style={{ marginBottom: "24px" }}>
              <button 
                onClick={() => { setSelectedRole(null); setIsLogin(true); setError(""); }}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "white", border: "1px solid #e2e8f0", color: "#64748b", cursor: "pointer", fontSize: "14px", fontWeight: "600", padding: "8px 16px", borderRadius: "100px", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <ArrowLeft size={16} /> Back to roles
              </button>
            </div>
          )}
        </div>

        {!selectedRole ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {roles.map((role, idx) => (
              <div 
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                style={{ 
                  display: "flex", alignItems: "center", gap: "24px", padding: "24px", 
                  backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid rgba(226, 232, 240, 0.8)",
                  cursor: "pointer", transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.02)",
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(20px)",
                  transitionDelay: `${0.2 + (idx * 0.1)}s`
                }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.borderColor = role.color; 
                  e.currentTarget.style.boxShadow = `0 12px 30px ${role.color}15`; 
                  e.currentTarget.style.transform = "translateY(-4px)"; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.borderColor = "rgba(226, 232, 240, 0.8)"; 
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.02)"; 
                  e.currentTarget.style.transform = "translateY(0)"; 
                }}
              >
                <div style={{ color: role.color, padding: "16px", borderRadius: "16px", background: role.bg }}>
                  {role.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>{role.title}</h3>
                  <p style={{ color: "#64748b", fontSize: "14px", fontWeight: "500" }}>{role.desc}</p>
                </div>
                <div style={{ marginLeft: "auto", color: "#cbd5e1", padding: "8px", background: "#f8fafc", borderRadius: "50%" }}>
                  <ArrowRight size={20} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ marginBottom: "28px" }}>
               <h2 style={{ fontSize: "32px", fontWeight: "900", color: "#0f172a", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                 {isLogin ? `${activeRole.title} Login` : `Create ${activeRole.title} Account`}
               </h2>
               <p style={{ color: "#64748b", fontSize: "16px", lineHeight: "1.5" }}>
                 {isLogin 
                   ? (selectedRole === "student" ? "Welcome back! Enter your credentials to continue learning." :
                      selectedRole === "teacher" ? "Access your classrooms, analytics, and AI grading tools." :
                      "Monitor your child's learning progress and AI insights.")
                   : (selectedRole === "student" ? "Register to begin your personalized learning journey." :
                      selectedRole === "teacher" ? "Set up your educator profile and connect your school." :
                      "Set up an account to link with your child's student profile.")
                 }
               </p>
            </div>
            
            {error && <div style={{ padding: "16px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: "12px", marginBottom: "24px", fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }}></div>
              {error}
            </div>}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", backgroundColor: "#ffffff", padding: "36px", borderRadius: "24px", border: "1px solid rgba(226,232,240,0.8)", boxShadow: "0 20px 40px rgba(0,0,0,0.04)" }}>
              
              {!isLogin && (
                <div>
                  <label className="auth-label">Full Name {selectedRole === "teacher" && "& Title"}</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="auth-input" placeholder={selectedRole === "teacher" ? "e.g., Dr. Ananya Sen" : "e.g., Aarav Sharma"} required />
                </div>
              )}
              
              <div>
                <label className="auth-label">
                  {selectedRole === "student" ? "Student Email / Username" : 
                   selectedRole === "teacher" ? (isLogin ? "Institutional Email" : "Official School Email") : 
                   "Email Address"}
                </label>
                <input type="text" name="email" value={formData.email} onChange={handleInputChange} className="auth-input" placeholder={selectedRole === "student" ? "aarav@school.com" : selectedRole === "teacher" ? "prof.sharma@university.edu" : "parent@email.com"} required />
              </div>

              {!isLogin && selectedRole === "teacher" && (
                <div>
                  <label className="auth-label">School/Institution Name</label>
                  <input type="text" name="school" value={formData.school} onChange={handleInputChange} className="auth-input" placeholder="e.g., International Public School" required />
                </div>
              )}

              {!isLogin && selectedRole === "parent" && (
                <>
                  <div>
                    <label className="auth-label">Mobile Number (For critical updates)</label>
                    <input type="text" name="mobile" value={formData.mobile} onChange={handleInputChange} className="auth-input" placeholder="e.g., +91 98765 43210" required />
                  </div>
                  <div>
                    <label className="auth-label">Student Activation Code / Student Email</label>
                    <input type="text" name="activationCode" value={formData.activationCode} onChange={handleInputChange} className="auth-input" placeholder="Enter the code provided by your child's school" required />
                  </div>
                </>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="auth-label" style={{ marginBottom: 0 }}>{!isLogin ? (selectedRole === "teacher" ? "Create Password" : "Choose Password") : "Password"}</label>
                  {isLogin && <a href="#" style={{ color: activeRole.color, fontSize: "13px", textDecoration: "none", fontWeight: "700" }}>Forgot Password?</a>}
                </div>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="auth-input" placeholder={isLogin ? "Enter your password" : (selectedRole === "teacher" ? "Strong password required" : "Minimum 8 characters")} required />
              </div>

              {!isLogin && (
                <div>
                  <label className="auth-label">Confirm Password</label>
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="auth-input" placeholder="Repeat your password" required />
                </div>
              )}
              
              <button 
                type="submit"
                disabled={loading}
                style={{ 
                  width: "100%", padding: "16px", backgroundColor: activeRole.color, color: "white", 
                  border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)", marginTop: "16px",
                  boxShadow: `0 8px 20px ${activeRole.color}40`
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 12px 25px ${activeRole.color}60`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 8px 20px ${activeRole.color}40`; }}
              >
                {loading ? "Processing..." : isLogin ? (
                   selectedRole === "student" ? "Enter Portal" :
                   selectedRole === "teacher" ? "Access Dashboard" :
                   "View Child's Progress"
                ) : (
                   selectedRole === "student" ? "Create Account & Enter" :
                   selectedRole === "teacher" ? "Complete Registration" :
                   "Link Account & Register"
                )}
                {!loading && <ArrowRight size={20} />}
              </button>
            </form>

            <div style={{ marginTop: "32px", textAlign: "center" }}>
              <button 
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "15px", fontWeight: "600", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = activeRole.color}
                onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
              >
                {isLogin ? (
                  selectedRole === "student" ? "Don't have an account? Sign Up Here" :
                  selectedRole === "teacher" ? "New educator? Register Institution Account" :
                  "New to the platform? Create Parent Account"
                ) : (
                  selectedRole === "teacher" ? "Already registered? Log In Here" :
                  "Already have an account? Log In Here"
                )}
              </button>
            </div>
          </div>
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          * { box-sizing: border-box; }
          .auth-label {
            display: block;
            font-size: 14px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 8px;
          }
          .auth-input {
            width: 100%;
            padding: 16px 20px;
            background-color: #f8fafc;
            border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 14px;
            color: #0f172a;
            font-size: 16px;
            outline: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .auth-input:focus {
            background-color: #ffffff;
            border-color: ${activeRole?.color || '#cbd5e1'};
            box-shadow: 0 0 0 4px ${activeRole?.color}20;
          }
          .auth-input::placeholder {
            color: #94a3b8;
          }
        `}} />
      </div>
    </div>
  );
}
