import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/api";
import TeacherNav from "../../components/TeacherNav";

export default function TeacherUpload() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Science");
  const [classId, setClassId] = useState("");
  const [fileName, setFileName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const teacherId = localStorage.getItem("teacher_id");
    if (!teacherId) {
      router.push("/teacher/login");
      return;
    }
    api.getTeacherClasses(teacherId).then((cls) => {
      setClasses(cls);
      if (cls[0]) setClassId(cls[0].id);
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
        class_id: classId,
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
    <TeacherNav>
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

        <label>Assign To</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

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
          <button className="btn-primary" disabled={!title || !classId || !ocrText || saving} onClick={submit}>
            {saving ? "Uploading..." : "Upload & Assign"}
          </button>
        ) : (
          <div style={{ background: "var(--green-light)", color: "var(--green)", padding: 16, borderRadius: 12, textAlign: "center" }}>
            Uploaded and assigned! Students in this class will now see it
            under &ldquo;Uploaded Lessons.&rdquo;
          </div>
        )}
      </div>
    </TeacherNav>
  );
}
