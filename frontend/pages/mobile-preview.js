import { useState } from "react";

const SCREENS = [
  { label: "Login", path: "/login" },
  { label: "Onboarding", path: "/onboarding" },
  { label: "Student Dashboard", path: "/dashboard" },
  { label: "Ask AI Tutor", path: "/tutor" },
  { label: "Lessons", path: "/lessons" },
  { label: "Quizzes", path: "/quizzes" },
  { label: "My Progress", path: "/progress" },
  { label: "Teacher Login", path: "/teacher/login" },
  { label: "Teacher Dashboard", path: "/teacher/dashboard" },
  { label: "Teacher Upload", path: "/teacher/upload" },
  { label: "Parent (Coming Soon)", path: "/parent" },
];

export default function MobilePreview() {
  const [screen, setScreen] = useState(SCREENS[0].path);

  return (
    <div style={{ minHeight: "100vh", background: "#ececea" }}>
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ fontWeight: 700, marginBottom: 10 }}>
          Mobile Preview &mdash; pick a screen to view at phone size
        </p>
        <select
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
        >
          {SCREENS.map((s) => (
            <option key={s.path} value={s.path}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="phone-frame-wrapper" style={{ paddingTop: 0 }}>
        <div className="phone-frame">
          <div className="phone-frame-screen">
            <div className="phone-notch" />
            <iframe src={screen} title="mobile preview" />
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", color: "#888", fontSize: 12, paddingBottom: 30 }}>
        This is a real render of the app at phone width (390px), not a static
        image &mdash; every button and the always-listening mic work
        normally inside this frame.
      </p>
    </div>
  );
}
