import DashboardLayout from "../components/DashboardLayout";

export default function Settings() {
  return (
    <DashboardLayout userName="Ananya" title="Accessibility Settings">
      <div style={{ maxWidth: "600px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          
          {/* Text Size */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="font-semibold">Text Size</span>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-outline" style={{ flex: 1, padding: "12px" }}>A-</button>
              <button className="btn-outline" style={{ flex: 1, padding: "12px", background: "var(--purple-light)", color: "var(--purple-dark)", borderColor: "var(--purple)" }}>Medium</button>
              <button className="btn-outline" style={{ flex: 1, padding: "12px" }}>A+</button>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* High Contrast */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="font-semibold">High Contrast</span>
            <div style={{ width: "44px", height: "24px", background: "var(--purple)", borderRadius: "12px", position: "relative", cursor: "pointer" }}>
              <div style={{ width: "20px", height: "20px", background: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }}></div>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Speech Rate */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="font-semibold">Speech Rate</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span className="text-sm text-muted">Slow</span>
              <div style={{ flex: 1, height: "4px", background: "var(--border)", borderRadius: "2px", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, width: "50%", height: "100%", background: "var(--purple)", borderRadius: "2px" }}></div>
                <div style={{ position: "absolute", left: "50%", top: "-6px", width: "16px", height: "16px", background: "var(--purple)", borderRadius: "50%", transform: "translateX(-50%)" }}></div>
              </div>
              <span className="text-sm text-muted">Fast</span>
            </div>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Voice */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="font-semibold">Voice</span>
            <select style={{ width: "200px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: 0 }}>
              <option>Female Voice</option>
              <option>Male Voice</option>
            </select>
          </div>

          <div style={{ height: "1px", background: "var(--border)" }}></div>

          {/* Screen Reader Support */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="font-semibold">Screen Reader Support</span>
            <div style={{ width: "44px", height: "24px", background: "var(--purple)", borderRadius: "12px", position: "relative", cursor: "pointer" }}>
              <div style={{ width: "20px", height: "20px", background: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }}></div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
