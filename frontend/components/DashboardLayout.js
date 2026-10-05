import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import VoiceController from "./VoiceController";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

export default function DashboardLayout({ children, userName, title, subtitle, disableAutoTTS = false, role: propRole }) {
  const router = useRouter();

  const getDerivedRole = () => {
    if (propRole) return propRole;
    if (router.pathname.startsWith("/parent")) return "parent";
    if (router.pathname.startsWith("/teacher") || router.pathname === "/upload") return "teacher";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user_role") || localStorage.getItem("role");
      if (stored) return stored;
    }
    return "student";
  };

  const [role, setRole] = useState(getDerivedRole);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasAnnounced = useRef(false);

  useEffect(() => {
    const currentRole = getDerivedRole();
    setRole(currentRole);
    if (currentRole !== "student" && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [propRole, router.pathname]);

  useEffect(() => {
    if (role === "student" && !disableAutoTTS && !hasAnnounced.current) {
      const timer = setTimeout(() => {
        let orientation = `Arrived at ${title}.`;
        const path = router.pathname;
        if (path === "/dashboard" || path === "/") {
          orientation = `Welcome to your Dashboard. You can say: 'Go to Lessons', 'Go to Quizzes', or 'Ask Tutor'.`;
        } else if (path.startsWith("/lessons")) {
          orientation = `Arrived at My Library. Say 'Play Part 1' or 'Start lesson' to listen to your current topic.`;
        } else if (path.startsWith("/quizzes")) {
          orientation = `Arrived at Quizzes. Say 'Take quiz' or ask 'What is my score?'.`;
        } else if (path.startsWith("/tutor")) {
          orientation = `AI Tutor session ready. Speak your question anytime or say 'Hey Tutor'.`;
        } else if (path.startsWith("/profile")) {
          orientation = `Student Profile and Voice Settings. You can assign a tutor name or upload a voice clone.`;
        } else if (path.startsWith("/progress") || path.startsWith("/history")) {
          orientation = `Progress overview. Ask 'What is my progress?' to hear your completion status.`;
        } else if (subtitle) {
          orientation = `${title}: ${subtitle}. Say 'Where am I?' anytime for orientation.`;
        }

        window.dispatchEvent(new CustomEvent("play_global_tts", {
          detail: { text: orientation }
        }));
        hasAnnounced.current = true;
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [router.asPath, title, subtitle, role, disableAutoTTS]);

  // Reset announce flag when the route changes
  useEffect(() => {
    const handleRouteChange = () => { hasAnnounced.current = false; };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router]);

  return (
    <div className="page-container">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar isOpen={isMobileMenuOpen} role={role} />
      <div className="main-content-wrapper">
        <TopBar
          userName={userName}
          title={title}
          subtitle={subtitle}
          role={role}
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
