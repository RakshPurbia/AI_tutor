import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import VoiceController from "./VoiceController";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children, userName, title, subtitle }) {
  const [role, setRole] = useState("student");

  useEffect(() => {
    setRole(localStorage.getItem("role") || "student");
  }, []);

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content-wrapper">
        <TopBar userName={userName} title={title} subtitle={subtitle} />
        <main className="main-content">
          {children}
        </main>
        {role === "student" && <VoiceController />}
      </div>
    </div>
  );
}
