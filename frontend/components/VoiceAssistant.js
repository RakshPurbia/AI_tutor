import { Mic, X, Square } from "lucide-react";

export default function VoiceAssistant({ onClose }) {
  return (
    <div style={{ 
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
      background: "rgba(10, 10, 20, 0.95)", zIndex: 9999, 
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" 
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: "32px", right: "32px", background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
        <X size={32} />
      </button>

      <h2 style={{ color: "white", fontSize: "24px", fontWeight: "bold", marginBottom: "64px" }}>Voice Assistant</h2>
      <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "64px" }}>Listening...</p>

      {/* Wave animation simulation */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "120px", marginBottom: "64px" }}>
        <div style={{ width: "4px", height: "20%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "40%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1.2s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "80%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 0.8s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "100%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1.5s infinite alternate" }}></div>
        
        {/* Main Mic Button */}
        <div style={{ margin: "0 24px", width: "96px", height: "96px", background: "var(--purple)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "0 0 32px var(--purple)" }}>
          <Mic size={40} />
        </div>

        <div style={{ width: "4px", height: "100%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1.1s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "80%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 0.9s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "40%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1.3s infinite alternate" }}></div>
        <div style={{ width: "4px", height: "20%", background: "var(--purple)", borderRadius: "2px", animation: "pulse 1s infinite alternate" }}></div>
      </div>

      <p style={{ color: "white", fontSize: "16px", marginBottom: "32px" }}>You can ask anything about your lessons</p>
      
      <button 
        className="btn-outline" 
        onClick={onClose}
        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
      >
        <Square size={16} fill="white" /> Stop Listening
      </button>

    </div>
  );
}
