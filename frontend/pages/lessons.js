import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { speak } from "../components/useAlwaysListeningMic";

export default function Lessons() {
  const [lessons, setLessons] = useState([]);
  const [openLesson, setOpenLesson] = useState(null);
  const [studentId, setStudentId] = useState(null);

  useEffect(() => {
    const sid = localStorage.getItem("student_id");
    setStudentId(sid);
    if (sid) {
      api.getStudentLessons(sid).then(setLessons).catch(console.error);
    }
  }, []);

  return (
    <div className="page">
      <div className="nav-row">
        <Link href="/dashboard" className="nav-link">&larr; Dashboard</Link>
      </div>

      {!openLesson && (
        <div className="card">
          <p className="step-title">Uploaded Lessons</p>
          {lessons.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>
              No lessons assigned yet. Ask your teacher to upload content.
            </p>
          )}
          {lessons.map((l) => (
            <button key={l.id} className="option-btn" onClick={() => setOpenLesson(l)}>
              {l.title} {l.subject && <span style={{ color: "var(--text-muted)" }}>&middot; {l.subject}</span>}
            </button>
          ))}
        </div>
      )}

      {openLesson && (
        <div className="card">
          <button className="btn-secondary" onClick={() => setOpenLesson(null)}>&larr; Back to lessons</button>
          <p className="step-title" style={{ marginTop: 10 }}>{openLesson.title}</p>
          <div style={{ background: "var(--purple-light)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: 0, fontStyle: "italic" }}>&ldquo;{openLesson.transcript}&rdquo;</p>
          </div>
          <button className="btn-primary" onClick={() => speak(openLesson.transcript)}>
            &#9654; Play Lesson Audio
          </button>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
            Audio-first playback with synced transcript above, matching your
            lesson-delivery design. (Uses the browser's built-in
            text-to-speech here - swap in PiperTTS server-side for production.)
          </p>
        </div>
      )}
    </div>
  );
}
