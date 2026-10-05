import Link from "next/link";
import { useRouter } from "next/router";
import { 
  Home, 
  Bot, 
  Library, 
  ListTodo, 
  TrendingUp, 
  History, 
  User, 
  Users,
  Settings, 
  LogOut,
  GraduationCap
} from "lucide-react";

import React from "react";

export default function Sidebar({ isOpen, role: propRole }) {
  const router = useRouter();

  const getEffectiveRole = () => {
    if (propRole) return propRole;
    if (router.pathname.startsWith("/parent")) return "parent";
    if (router.pathname.startsWith("/teacher") || router.pathname === "/upload") return "teacher";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user_role") || localStorage.getItem("role");
      if (stored) return stored;
    }
    return "student";
  };

  const [role, setRole] = React.useState(getEffectiveRole);

  React.useEffect(() => {
    setRole(getEffectiveRole());
  }, [propRole, router.pathname]);

  const studentNav = [
    { name: "Home", path: "/dashboard", icon: <Home size={20} /> },
    { name: "AI Tutor", path: "/tutor", icon: <Bot size={20} /> },
    { name: "My Library", path: "/lessons", icon: <Library size={20} /> },
    { name: "Quizzes", path: "/quizzes", icon: <ListTodo size={20} /> },
    { name: "Progress", path: "/progress", icon: <TrendingUp size={20} /> },
    { name: "History", path: "/history", icon: <History size={20} /> },
    { name: "Profile", path: "/profile", icon: <User size={20} /> },
    { name: "Settings", path: "/settings", icon: <Settings size={20} /> },
  ];

  const teacherNav = [
    { name: "Dashboard", path: "/teacher/dashboard", icon: <Home size={20} /> },
    { name: "Upload Lesson", path: "/teacher/upload", icon: <Library size={20} /> },
    { name: "Create Quiz", path: "/teacher/quiz-create", icon: <ListTodo size={20} /> },
    { name: "My Students", path: "/teacher/students", icon: <Users size={20} /> },
    { name: "Profile", path: "/teacher/profile", icon: <User size={20} /> },
  ];

  const parentNav = [
    { name: "Dashboard", path: "/parent", icon: <Home size={20} /> },
    { name: "Child Progress", path: "/progress", icon: <TrendingUp size={20} /> },
    { name: "Learning History", path: "/history", icon: <History size={20} /> },
    { name: "Profile", path: "/profile", icon: <User size={20} /> },
  ];

  const navItems = role === "teacher" ? teacherNav : (role === "parent" ? parentNav : studentNav);

  const handleLogout = () => {
    localStorage.removeItem("student_id");
    localStorage.removeItem("teacher_id");
    router.push("/login");
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div style={{ background: "var(--purple)", color: "white", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <GraduationCap size={24} />
        </div>
        <span style={{ color: "var(--purple-dark)" }}>AI Tutor</span>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
        {navItems.map((item) => (
          <Link 
            key={item.name} 
            href={item.path}
            className={`nav-link ${router.pathname === item.path ? "active" : ""}`}
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </nav>

      <button onClick={handleLogout} className="nav-link" style={{ background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", marginTop: "auto" }}>
        <LogOut size={20} />
        Logout
      </button>
    </aside>
  );
}
