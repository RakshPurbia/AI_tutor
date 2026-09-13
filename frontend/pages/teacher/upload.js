import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/api";
import DashboardLayout from "../../components/DashboardLayout";

export default function TeacherUpload() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Science");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [fileName, setFileName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [userName, setUserName] = useState("Teacher");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserName(localStorage.getItem("user_name") || "Teacher");
    }
    const teacherId = localStorage.getItem("teacher_id");
    if (!teacherId) {
      router.push("/teacher/login");
      return;
    }
    api.getTeacherStudents(teacherId).then((st) => {
      setStudents(st);
      if (st.length > 0) setSelectedStudents([]); // start with none selected
    });
  }, [router]);

  const handleFilePick = (e) => {
    const file = e.target.files[0];
    if (file) setFileName(file.name);
  };

  const submit = async () => {
    setSaving(true);
    const teacherId = localStorage.getItem("teacher_id");
    try {
      await api.uploadContent({
        teacher_id: teacherId,
        student_ids: selectedStudents,
        title,
        subject,
        file_name: fileName || "untitled.pdf",
        ocr_text: ocrText,
      });
      setDone(true);
    } catch (e) {
      alert("Upload failed. Is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout userName={userName} title="Upload Lesson" subtitle="Upload PPT/PDF materials and assign them to a student.">
      <div className="card">
        <p className="step-title">Upload Learning Material</p>

        <label>File</label>
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            marginBottom: 14,
            cursor: "pointer",
          }}
          onClick={() => document.getElementById("file-input").click()}
        >
          {fileName ? `Selected: ${fileName}` : "Drag file here or click to upload"}
          <input id="file-input" type="file" style={{ display: "none" }} onChange={handleFilePick} />
        </div>

        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ear Anatomy - Grade 7 Biology" />

        <label>Subject</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />

        <label>Assign To (Students)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px", maxHeight: "150px", overflowY: "auto" }}>
          {students.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "normal", marginBottom: 0 }}>
              <input 
                type="checkbox" 
                checked={selectedStudents.includes(s.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedStudents([...selectedStudents, s.id]);
                  } else {
                    setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                  }
                }}
              />
              {s.name}
            </label>
          ))}
        </div>

        <label style={{ marginTop: 8 }}>
          Extracted text (stand-in for PaddleOCR output - paste or type the
          content here for this demo)
        </label>
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={5}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 14, marginBottom: 14 }}
        />

        {!done ? (
          <button className="btn-primary" disabled={!title || selectedStudents.length === 0 || !ocrText || saving} onClick={submit}>
            {saving ? "Uploading..." : "Upload & Assign"}
          </button>
        ) : (
          <div style={{ background: "var(--green-light)", color: "var(--green)", padding: 16, borderRadius: 12, textAlign: "center" }}>
            Uploaded and assigned! The assigned student will now see it
            under &ldquo;Uploaded Lessons.&rdquo;
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
