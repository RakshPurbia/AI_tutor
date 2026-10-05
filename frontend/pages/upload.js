import DashboardLayout from "../components/DashboardLayout";
import { UploadCloud, CheckCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Upload() {
  const [teacherName, setTeacherName] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [classId, setClassId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      localStorage.setItem("role", "teacher");
      localStorage.setItem("user_role", "teacher");
    }
    const name = localStorage.getItem("teacher_name") || "Teacher";
    setTeacherName(name);

    const fetchClasses = async () => {
      const tId = localStorage.getItem("teacher_id");
      if (!tId) return;
      try {
        const res = await fetch(`http://localhost:8000/api/teacher/${tId}/classes`);
        const data = await res.json();
        if (data && data.length > 0) {
          setClassId(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch classes", err);
      }
    };
    fetchClasses();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !file || !classId) return;
    
    setIsUploading(true);
    const teacherId = localStorage.getItem("teacher_id");

    try {
      const formData = new FormData();
      formData.append("teacher_id", teacherId);
      formData.append("class_id", classId);
      formData.append("title", title);
      formData.append("subject", subject);
      formData.append("file", file);

      // 1. Upload Content (Lesson)
      const res = await fetch("http://localhost:8000/api/upload_file", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      const lessonId = data.lesson_id;

      // 2. Auto-generate quiz using AI
      await fetch("http://localhost:8000/api/teacher/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          lesson_id: lessonId,
          title: `${title} - Auto Quiz`,
          questions: [] // Empty array triggers AI generation in backend
        })
      });

      setSuccess(true);
      setTitle("");
      setSubject("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout role="teacher" disableAutoTTS={true} userName={teacherName} title="Upload Document" subtitle="Add new learning materials">
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        
        {success && (
          <div style={{ background: "var(--green-light)", color: "var(--green)", padding: "16px", borderRadius: "12px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle size={20} />
            <span className="font-bold">Topic uploaded successfully! Sequenced into section-wise modules with 5-question checkpoint quizzes.</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="card" style={{ display: "flex", flexDirection: "column", padding: "48px" }}>
          <div style={{ width: "64px", height: "64px", background: "var(--purple-light)", color: "var(--purple)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "32px", alignSelf: "center" }}>
            <UploadCloud size={32} />
          </div>

          <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
            <div style={{ flex: 1 }}>
              <label className="input-label">Lesson Title</label>
              <input type="text" className="input-field" placeholder="e.g. Chapter 5: Human Heart" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">Subject</label>
              <input type="text" className="input-field" placeholder="e.g. Science" value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginBottom: "32px" }}>
            <label className="input-label">Upload PDF Document</label>
            <div 
              style={{ 
                border: "2px dashed var(--purple-border)", 
                borderRadius: "12px", 
                padding: "32px", 
                textAlign: "center",
                cursor: "pointer",
                background: "var(--bg)"
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: "none" }} 
                accept=".pdf"
                onChange={handleFileChange} 
              />
              {file ? (
                <p className="font-semibold text-purple">{file.name}</p>
              ) : (
                <p className="text-muted">Click to select a PDF file</p>
              )}
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ padding: "16px" }} disabled={isUploading || !classId || !file}>
            {isUploading ? "Uploading & Generating AI Quiz..." : "Upload Lesson & Auto-generate Quiz"}
          </button>
        </form>

      </div>
    </DashboardLayout>
  );
}
