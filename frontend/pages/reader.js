import DashboardLayout from "../components/DashboardLayout";
import { Volume2, Pause, Minus, Plus, Search, Mic } from "lucide-react";

export default function Reader() {
  return (
    <DashboardLayout userName="Ananya" title="Biology - Chapter 5.pdf" subtitle="Document Reader">
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
        
        {/* Toolbar */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn-outline" style={{ padding: "6px 12px", fontSize: "13px", color: "var(--purple)", borderColor: "var(--purple-border)" }}>
              <Volume2 size={16} /> Read Aloud
            </button>
            <button className="btn-outline" style={{ padding: "6px 12px", fontSize: "13px" }}>
              <Pause size={16} /> Pause
            </button>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button style={{ background: "transparent", border: "none", cursor: "pointer" }}><Minus size={16} className="text-muted" /></button>
              <span className="text-sm font-medium">A</span>
              <button style={{ background: "transparent", border: "none", cursor: "pointer" }}><Plus size={16} className="text-muted" /></button>
            </div>
            <Search size={16} className="text-muted" />
            <span className="text-sm font-bold">100%</span>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          
          {/* Pages Sidebar */}
          <div style={{ width: "160px", borderRight: "1px solid var(--border)", padding: "16px", overflowY: "auto", background: "var(--bg)" }}>
            <h4 className="text-sm font-bold mb-4 text-muted">Pages</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
              <div style={{ width: "100%", height: "140px", background: "white", border: "2px solid var(--purple)", borderRadius: "8px", padding: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                {/* Thumbnail placeholder */}
                <div style={{ width: "100%", height: "4px", background: "var(--border)", marginBottom: "4px" }}></div>
                <div style={{ width: "80%", height: "4px", background: "var(--border)", marginBottom: "4px" }}></div>
                <div style={{ width: "90%", height: "4px", background: "var(--border)", marginBottom: "4px" }}></div>
              </div>
              <span className="text-xs font-bold">1</span>

              <div style={{ width: "100%", height: "140px", background: "white", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px" }}>
                <div style={{ width: "100%", height: "4px", background: "var(--border)", marginBottom: "4px" }}></div>
                <div style={{ width: "60%", height: "4px", background: "var(--border)", marginBottom: "4px" }}></div>
              </div>
              <span className="text-xs text-muted">2</span>
            </div>
          </div>

          {/* PDF Viewer */}
          <div style={{ flex: 1, padding: "40px 80px", overflowY: "auto", position: "relative" }}>
            <h2 className="text-2xl font-bold mb-4">5. Life Processes in Plants</h2>
            <p className="text-base mb-6" style={{ lineHeight: "1.8" }}>
              Green plants prepare their own food by the process of photosynthesis. The process takes place in the leaves in the presence of sunlight.
            </p>
            
            <h3 className="text-xl font-bold mb-4">5.1 Photosynthesis</h3>
            <p className="text-base mb-6" style={{ lineHeight: "1.8" }}>
              Photosynthesis is the process by which green plants use sunlight, water and carbon dioxide to make food.
            </p>

            {/* Listening Widget */}
            <div style={{ position: "absolute", bottom: "40px", right: "40px", background: "white", padding: "16px 24px", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: "16px", border: "1px solid var(--purple-border)" }}>
              <span className="text-sm font-bold text-purple">Listening...</span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center", height: "24px" }}>
                <div className="progress-bar-fill" style={{ width: "3px", height: "40%" }}></div>
                <div className="progress-bar-fill" style={{ width: "3px", height: "80%" }}></div>
                <div className="progress-bar-fill" style={{ width: "3px", height: "100%" }}></div>
                <div className="progress-bar-fill" style={{ width: "3px", height: "60%" }}></div>
                <div className="progress-bar-fill" style={{ width: "3px", height: "30%" }}></div>
              </div>
              <div style={{ background: "var(--purple)", color: "white", padding: "8px", borderRadius: "50%", display: "flex" }}>
                <Mic size={16} />
              </div>
            </div>

          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
