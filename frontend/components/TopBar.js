import { Search, Mic, Bell, ChevronDown, User, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/router";

export default function TopBar({ userName, title, subtitle }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };
  return (
    <div className="topbar">
      <div>
        <h2 className="text-xl font-bold">{title || `Hello, ${userName || "Student"} 👋`}</h2>
        <p className="text-sm text-muted">{subtitle || "What would you like to learn today?"}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input 
            type="text" 
            placeholder="Ask anything or press the mic..." 
            className="search-input"
          />
          <button style={{ background: "var(--purple)", color: "white", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Mic size={16} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <span className="text-sm font-medium">Class 10</span>
          <ChevronDown size={16} className="text-muted" />
        </div>

        <div style={{ position: "relative", cursor: "pointer" }}>
          <Bell size={24} className="text-muted" />
          <span style={{ position: "absolute", top: 0, right: 0, width: "8px", height: "8px", background: "var(--red)", borderRadius: "50%", border: "2px solid white" }}></span>
        </div>

        <div style={{ position: "relative" }}>
          <div 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--purple-light)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}
          >
            {userName ? userName.charAt(0).toUpperCase() : "S"}
          </div>

          {showDropdown && (
            <div style={{ position: "absolute", top: "50px", right: "0", background: "white", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "8px", minWidth: "160px", zIndex: 10 }}>
              <div 
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", borderRadius: "8px" }}
                onClick={() => { setShowDropdown(false); router.push("/profile"); }}
                className="hover-bg-gray"
              >
                <User size={16} /> <span className="text-sm font-medium">Profile</span>
              </div>
              <div 
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", borderRadius: "8px", color: "var(--red)" }}
                onClick={handleLogout}
                className="hover-bg-gray"
              >
                <LogOut size={16} /> <span className="text-sm font-medium">Logout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
