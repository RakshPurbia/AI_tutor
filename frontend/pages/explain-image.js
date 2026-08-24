import DashboardLayout from "../components/DashboardLayout";
import { UploadCloud, Volume2 } from "lucide-react";

export default function ExplainImage() {
  return (
    <DashboardLayout userName="Ananya" title="Explain Image" subtitle="Upload any image to understand">
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", maxWidth: "1000px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <button className="btn-outline" style={{ fontSize: "14px", padding: "8px 16px" }}>
            <UploadCloud size={16} /> Upload New
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8" style={{ flex: 1 }}>
          {/* Image Area */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ width: "300px", height: "300px", background: "url('https://placehold.co/400x400/e0e7ff/5b4fe0?text=Heart+Diagram') no-repeat center center", backgroundSize: "cover", borderRadius: "16px", marginBottom: "24px" }}></div>
            
            <button className="btn-primary" style={{ position: "absolute", bottom: "24px", left: "24px", padding: "12px 24px", background: "var(--purple)" }}>
              <Volume2 size={18} /> Listen Explanation
            </button>
          </div>

          {/* Explanation Area */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="text-xl font-bold mb-6">Explanation</h3>
            
            <p className="text-base mb-4" style={{ lineHeight: "1.6" }}>
              This is a diagram of the human heart.
            </p>
            
            <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "12px", color: "var(--text-main)", lineHeight: "1.6" }}>
              <li>The heart has four chambers.</li>
              <li>Upper two are atria (right atrium and left atrium).</li>
              <li>Lower two are ventricles (right ventricle and left ventricle).</li>
              <li>Blue color shows deoxygenated blood and red shows oxygenated blood.</li>
              <li>Blood flow: Body → Right Atrium → Right Ventricle → Lungs → Left Atrium → Left Ventricle → Body.</li>
            </ul>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
