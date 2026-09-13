import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import VoiceController from "./VoiceController";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function DashboardLayout({ children, userName, title, subtitle }) {
  const [role, setRole] = useState("student");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setRole(localStorage.getItem("role") || "student");
  }, []);

  return (
    <div className="page-container">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <Sidebar isOpen={isMobileMenuOpen} />
      <div className="main-content-wrapper">
        <TopBar 
          userName={userName} 
          title={title} 
          subtitle={subtitle} 
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        />
        <main className="main-content">
          {children}
        </main>
        {role === "student" && <VoiceController />}
      </div>
    </div>
  );
}
