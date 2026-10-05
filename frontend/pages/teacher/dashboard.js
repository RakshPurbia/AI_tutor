import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "../../components/DashboardLayout";
import { 
  Users, 
  FileText, 
  ListTodo, 
  Trophy, 
  UploadCloud, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  X, 
  Eye, 
  RotateCw,
  Search,
  UserCheck
} from "lucide-react";
import { api } from "../../lib/api";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "Recently";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (e) {
    return "Recently";
  }
}

function getSubjectBadge(subject) {
  const s = (subject || "General").toLowerCase();
  if (s.includes("bio") || s.includes("life")) return { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
  if (s.includes("sci") || s.includes("phys") || s.includes("chem")) return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
  if (s.includes("math") || s.includes("alg")) return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
  if (s.includes("eng") || s.includes("lit")) return { bg: "#fae8ff", text: "#86198f", border: "#f5d0fe" };
  return { bg: "var(--purple-light)", text: "var(--purple)", border: "#ddd6fe" };
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [searchQuery, setSearchQuery] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edit modal state
  const [editingLesson, setEditingLesson] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTranscript, setEditTranscript] = useState("");
  const [editStudentSelection, setEditStudentSelection] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Preview modal/drawer state
  const [previewLesson, setPreviewLesson] = useState(null);

  const fetchDashboard = async (teacherId, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, stRes, clRes] = await Promise.all([
        api.getTeacherDashboard(teacherId),
        api.getTeacherStudents(teacherId).catch(() => []),
        api.getTeacherClasses(teacherId).catch(() => []),
      ]);
      setData(dashRes);
      setStudents(stRes || []);
      setClasses(clRes || []);
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      localStorage.setItem("role", "teacher");
      localStorage.setItem("user_role", "teacher");
    }

    let teacherId = localStorage.getItem("teacher_id");
    const storedName = localStorage.getItem("teacher_name") || localStorage.getItem("user_name");
    if (storedName) setTeacherName(storedName);

    if (!teacherId) {
      api.teacherLogin(storedName || "Ms. Rao")
        .then(result => {
          localStorage.setItem("teacher_id", result.teacher_id);
          localStorage.setItem("teacher_name", result.name);
          setTeacherName(result.name);
          fetchDashboard(result.teacher_id);
        })
        .catch(() => {
          router.push("/teacher/login");
        });
      return;
    }

    fetchDashboard(teacherId);
  }, [router]);

  const handleOpenEdit = (lesson) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.title || "");
    setEditSubject(lesson.subject || "Science");
    setEditTranscript(lesson.transcript || "");

    // Determine initial selected student or class
    if (lesson.student_id) {
      setEditStudentSelection(`student:${lesson.student_id}`);
    } else if (lesson.class_id) {
      setEditStudentSelection(`class:${lesson.class_id}`);
    } else {
      // Find matching student name if available
      const matched = students.find(s => s.name.toLowerCase() === (lesson.class_name || "").toLowerCase());
      if (matched) {
        setEditStudentSelection(`student:${matched.id}`);
      } else {
        setEditStudentSelection("all");
      }
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingLesson || !editTitle.trim()) return;

    setSavingEdit(true);
    try {
      let targetStudentId = null;
      let targetClassId = null;
      let newClassName = editingLesson.class_name || "Assigned";

      if (editStudentSelection.startsWith("student:")) {
        targetStudentId = editStudentSelection.replace("student:", "");
        const foundSt = students.find(s => s.id === targetStudentId);
        if (foundSt) newClassName = foundSt.name;
      } else if (editStudentSelection.startsWith("class:")) {
        targetClassId = editStudentSelection.replace("class:", "");
        const foundCl = classes.find(c => c.id === targetClassId);
        if (foundCl) newClassName = foundCl.name;
      } else {
        newClassName = "All Students";
      }

      const updated = await api.updateTeacherLesson(editingLesson.lesson_id, {
        title: editTitle.trim(),
        subject: editSubject.trim(),
        transcript: editTranscript.trim(),
        student_id: targetStudentId ? targetStudentId : "all",
        class_id: targetClassId ? targetClassId : "",
      });

      setData(prev => {
        if (!prev || !prev.recent_lessons) return prev;
        const updatedLessons = prev.recent_lessons.map(l => {
          if (l.lesson_id === editingLesson.lesson_id) {
            return {
              ...l,
              title: editTitle.trim(),
              subject: editSubject.trim(),
              transcript: editTranscript.trim(),
              student_id: targetStudentId,
              class_id: targetClassId,
              class_name: updated?.class_name || newClassName,
            };
          }
          return l;
        });
        return { ...prev, recent_lessons: updatedLessons };
      });

      setSuccessMsg(`Assignment "${editTitle.trim()}" updated successfully! Assigned to: ${updated?.class_name || newClassName}`);
      setEditingLesson(null);
      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (err) {
      alert("Failed to save changes: " + (err.message || "Unknown error"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteLesson = async (lessonId, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await api.deleteTeacherLesson(lessonId);
      setData(prev => {
        if (!prev || !prev.recent_lessons) return prev;
        return {
          ...prev,
          recent_lessons: prev.recent_lessons.filter(l => l.lesson_id !== lessonId)
        };
      });
      setSuccessMsg(`Assignment "${title}" was deleted.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert("Failed to delete assignment: " + err.message);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="teacher" disableAutoTTS={true} userName={teacherName} title="Dashboard" subtitle="Welcome back!">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid var(--purple-light)", borderTopColor: "var(--purple)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p className="text-muted font-medium">Loading workspace...</p>
          <style jsx>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      </DashboardLayout>
    );
  }

  const stats = [
    { label: "Total Students", value: data?.students || 0, icon: <Users size={24} />, bg: "var(--purple-light)", color: "var(--purple)" },
    { label: "Lessons Assigned", value: data?.recent_lessons?.length || 0, icon: <FileText size={24} />, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Quizzes Completed", value: data?.completed || 0, icon: <ListTodo size={24} />, bg: "var(--amber-light)", color: "var(--amber)" },
    { label: "Avg. Score", value: data?.avg_score_pct ? `${data.avg_score_pct}%` : "N/A", icon: <Trophy size={24} />, bg: "var(--green-light)", color: "var(--green)" },
  ];

  const lessons = data?.recent_lessons || [];
  const latestUpload = lessons.length > 0 ? lessons[0] : null;

  const filteredLessons = lessons.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.subject && l.subject.toLowerCase().includes(q)) ||
      (l.class_name && l.class_name.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout 
      role="teacher"
      disableAutoTTS={true}
      userName={teacherName} 
      title="Teacher Workspace" 
      subtitle="Manage curriculum, review latest uploads, and edit assignments in real time."
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>

        {/* Success Alert Banner */}
        {successMsg && (
          <div style={{
            background: "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1px solid #6ee7b7",
            color: "#065f46",
            padding: "14px 20px",
            borderRadius: "14px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.12)",
            animation: "fadeIn 0.3s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "600" }}>
              <CheckCircle2 size={20} color="#059669" />
              <span>{successMsg}</span>
            </div>
            <button 
              onClick={() => setSuccessMsg("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#065f46", padding: "4px" }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        
        {/* Top Header & Actions Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "280px" }}>
            <button 
              className="btn-primary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 22px", fontSize: "15px", fontWeight: "600", borderRadius: "12px", boxShadow: "0 4px 14px rgba(91, 79, 224, 0.2)" }}
              onClick={() => router.push("/teacher/upload")}
            >
              <UploadCloud size={20} /> Assign Lesson / PPT
            </button>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 22px", fontSize: "15px", fontWeight: "600", background: "white", color: "var(--purple)", border: "2px solid var(--purple)", borderRadius: "12px" }}
              onClick={() => router.push("/teacher/quiz-create")}
            >
              <ListTodo size={20} /> Create Quiz
            </button>
          </div>

          <button
            onClick={() => {
              const tid = localStorage.getItem("teacher_id");
              if (tid) fetchDashboard(tid, true);
            }}
            disabled={refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "10px",
              background: "white",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            <RotateCw size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6" style={{ marginBottom: "32px" }}>
          {stats.map((s, i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 16px" }}>
              <div style={{ background: s.bg, color: s.color, width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                {s.icon}
              </div>
              <p className="text-xs text-muted mb-2 font-semibold">{s.label}</p>
              <h3 className="text-3xl font-bold">{s.value}</h3>
            </div>
          ))}
        </div>

        {/* FEATURED: LATEST UPLOAD SPOTLIGHT */}
        {latestUpload && (
          <div 
            className="card" 
            style={{ 
              marginBottom: "32px",
              background: "linear-gradient(135deg, #ffffff 0%, #faf8ff 100%)",
              border: "2px solid rgba(91, 79, 224, 0.25)",
              boxShadow: "0 8px 24px -4px rgba(91, 79, 224, 0.08)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div style={{ position: "absolute", top: 0, right: 0, width: "160px", height: "160px", background: "radial-gradient(circle, rgba(91, 79, 224, 0.08) 0%, rgba(255,255,255,0) 70%)", pointerEvents: "none" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "5px", 
                    background: "var(--purple)", 
                    color: "white", 
                    fontSize: "11px", 
                    fontWeight: "700", 
                    letterSpacing: "0.5px", 
                    textTransform: "uppercase", 
                    padding: "4px 10px", 
                    borderRadius: "20px" 
                  }}>
                    <Sparkles size={13} /> Latest Upload
                  </span>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: "500"
                  }}>
                    <Clock size={13} /> {formatTimeAgo(latestUpload.uploaded_at)}
                  </span>
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-main)", marginBottom: "8px" }}>
                  {latestUpload.title}
                </h2>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {(() => {
                    const badge = getSubjectBadge(latestUpload.subject);
                    return (
                      <span style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>
                        {latestUpload.subject || "General"}
                      </span>
                    );
                  })()}
                  <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <UserCheck size={14} color="var(--purple)" /> Assigned to: <strong style={{ color: "var(--text-main)" }}>{latestUpload.class_name}</strong>
                  </span>
                  {latestUpload.file_name && (
                    <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <FileText size={13} /> {latestUpload.file_name}
                    </span>
                  )}
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    background: latestUpload.status === "Completed" ? "var(--green-light)" : "var(--purple-light)",
                    color: latestUpload.status === "Completed" ? "var(--green)" : "var(--purple)"
                  }}>
                    {latestUpload.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons for Latest Upload */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-primary"
                  onClick={() => handleOpenEdit(latestUpload)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "14px", fontWeight: "600", borderRadius: "10px" }}
                >
                  <Edit3 size={16} /> Edit Assignment
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setPreviewLesson(latestUpload)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "14px", fontWeight: "600", background: "white", color: "var(--purple)", border: "1px solid var(--purple)", borderRadius: "10px" }}
                >
                  <Eye size={16} /> View Notes
                </button>
              </div>
            </div>

            {/* Transcript Snippet */}
            {latestUpload.transcript && (
              <div style={{
                background: "rgba(255, 255, 255, 0.8)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "12px 16px",
                fontSize: "13px",
                color: "var(--text-muted)",
                lineHeight: "1.5",
                marginTop: "12px"
              }}>
                <strong style={{ color: "var(--text-main)" }}>Content Preview: </strong>
                {latestUpload.transcript.length > 220 
                  ? `${latestUpload.transcript.slice(0, 220)}...` 
                  : latestUpload.transcript}
              </div>
            )}
          </div>
        )}

        {/* Main Content Split: Assignments & Classes */}
        <div className="grid grid-cols-3 gap-8">
          
          {/* Recent Uploads & Assignments List (2 cols) */}
          <div className="card" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 className="text-lg font-bold">Recent Uploads & Assignments</h3>
                <p className="text-xs text-muted">All uploaded curriculum materials, editable in real-time</p>
              </div>

              {/* Search filter */}
              <div style={{ position: "relative", minWidth: "200px" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input 
                  type="text"
                  placeholder="Filter assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 32px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
              {filteredLessons.length > 0 ? (
                filteredLessons.map((lesson, i) => {
                  const subjectBadge = getSubjectBadge(lesson.subject);
                  return (
                    <div 
                      key={lesson.lesson_id || i} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "16px", 
                        padding: "14px 16px", 
                        background: i === 0 ? "rgba(91, 79, 224, 0.03)" : "transparent",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ 
                        width: "42px", 
                        height: "42px", 
                        borderRadius: "10px", 
                        background: subjectBadge.bg, 
                        color: subjectBadge.text, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        flexShrink: 0
                      }}>
                        <FileText size={22} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <h4 className="font-semibold" style={{ fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {lesson.title}
                          </h4>
                          <span style={{ 
                            background: subjectBadge.bg, 
                            color: subjectBadge.text, 
                            fontSize: "11px", 
                            fontWeight: "600", 
                            padding: "2px 8px", 
                            borderRadius: "10px",
                            flexShrink: 0
                          }}>
                            {lesson.subject || "General"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                          <span>Assigned to: <strong style={{ color: "var(--text-main)" }}>{lesson.class_name}</strong></span>
                          <span>•</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} /> {formatTimeAgo(lesson.uploaded_at)}
                          </span>
                        </div>
                      </div>

                      {/* Status and Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                        <span 
                          className="text-xs font-bold" 
                          style={{ 
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: lesson.status === "Completed" ? "var(--green-light)" : "#f3f4f6",
                            color: lesson.status === "Completed" ? "var(--green)" : "var(--purple)" 
                          }}
                        >
                          {lesson.status}
                        </span>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(lesson)}
                          title="Edit assignment & student"
                          style={{
                            background: "var(--purple-light)",
                            color: "var(--purple)",
                            border: "none",
                            borderRadius: "8px",
                            width: "34px",
                            height: "34px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background 0.2s"
                          }}
                        >
                          <Edit3 size={16} />
                        </button>

                        {/* Preview Button */}
                        <button
                          onClick={() => setPreviewLesson(lesson)}
                          title="Preview notes"
                          style={{
                            background: "#f3f4f6",
                            color: "#4b5563",
                            border: "none",
                            borderRadius: "8px",
                            width: "34px",
                            height: "34px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Eye size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteLesson(lesson.lesson_id, lesson.title)}
                          title="Delete assignment"
                          style={{
                            background: "var(--red-light)",
                            color: "var(--red)",
                            border: "none",
                            borderRadius: "8px",
                            width: "34px",
                            height: "34px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                  <FileText size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <p className="font-semibold mb-1">No assignments found</p>
                  <p className="text-xs">
                    {searchQuery ? "Try matching a different search term" : "Upload your first lesson or PPT above"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Classes Overview (1 col) */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <h3 className="text-lg font-bold mb-4">My Classes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
              {data?.classes?.length > 0 ? (
                data.classes.map((c, i) => (
                  <div 
                    key={c.id || i} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "12px", 
                      borderRadius: "10px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--amber-light)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                        <Users size={16} />
                      </div>
                      <div>
                        <span className="font-semibold block text-sm">{c.name}</span>
                        <span className="text-xs text-muted">{c.subject}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "24px 10px", color: "var(--text-muted)" }}>
                  <Users size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <p className="text-sm">No classes registered yet.</p>
                </div>
              )}
            </div>
            
            <button 
              className="btn-outline w-full" 
              style={{ marginTop: "24px", padding: "12px" }}
              onClick={() => router.push("/teacher/students")}
            >
              View All Students & Progress
            </button>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* EDIT ASSIGNMENT & STUDENT MODAL                         */}
      {/* ======================================================== */}
      {editingLesson && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "white",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "600px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--purple-bg)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--purple)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "700" }}>Edit Assignment & Student Assignment</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Modify title, subject, reassign student, and update materials</p>
                </div>
              </div>
              <button
                onClick={() => setEditingLesson(null)}
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)"
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "var(--text-main)" }}>
                  Assignment Title <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Heart Anatomy - Grade 7 Biology"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "var(--text-main)" }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Science / Math / English"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      fontSize: "14px"
                    }}
                  />
                </div>

                {/* EDITABLE ASSIGNED STUDENT / CLASS SELECTION */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "var(--text-main)" }}>
                    Assign To (Student or Class) <span style={{ color: "var(--purple)" }}>*</span>
                  </label>
                  <select
                    value={editStudentSelection}
                    onChange={(e) => setEditStudentSelection(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--purple)",
                      fontSize: "13px",
                      background: "white",
                      color: "var(--text-main)",
                      cursor: "pointer",
                      boxShadow: "0 0 0 2px rgba(91, 79, 224, 0.1)"
                    }}
                  >
                    <optgroup label="Assign to Individual Student">
                      {students.map((st) => (
                        <option key={st.id} value={`student:${st.id}`}>
                          👤 {st.name} {st.residual_vision ? `(${st.residual_vision})` : ""}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Assign to Class (All Students)">
                      {classes.map((c) => (
                        <option key={c.id} value={`class:${c.id}`}>
                          👥 {c.name} ({c.subject})
                        </option>
                      ))}
                      <option value="all">👥 All Students (General)</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-main)" }}>
                    Lesson Content / Notes / OCR Text
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {editTranscript.length} characters
                  </span>
                </div>
                <textarea
                  value={editTranscript}
                  onChange={(e) => setEditTranscript(e.target.value)}
                  rows={7}
                  placeholder="Paste or edit the lesson notes, transcript, or instructional text..."
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  disabled={savingEdit}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: "white",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editTitle.trim()}
                  className="btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  {savingEdit ? (
                    <>
                      <RotateCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PREVIEW CONTENT MODAL                                    */}
      {/* ======================================================== */}
      {previewLesson && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "white",
            borderRadius: "18px",
            width: "100%",
            maxWidth: "640px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "85vh"
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--purple-bg)"
            }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--purple)" }}>
                  {previewLesson.subject || "General"} Assignment
                </span>
                <h3 style={{ fontSize: "18px", fontWeight: "700", marginTop: "2px" }}>
                  {previewLesson.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewLesson(null)}
                style={{
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)"
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: "16px", marginBottom: "18px", fontSize: "13px", color: "var(--text-muted)" }}>
                <span>Target: <strong style={{ color: "var(--text-main)" }}>{previewLesson.class_name}</strong></span>
                <span>•</span>
                <span>Uploaded: <strong style={{ color: "var(--text-main)" }}>{formatTimeAgo(previewLesson.uploaded_at)}</strong></span>
                <span>•</span>
                <span>Status: <strong style={{ color: previewLesson.status === "Completed" ? "var(--green)" : "var(--purple)" }}>{previewLesson.status}</strong></span>
              </div>

              <div style={{
                background: "#f9fafb",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "var(--text-main)",
                whiteSpace: "pre-wrap"
              }}>
                {previewLesson.transcript || "No transcript or text notes attached to this lesson."}
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="btn-primary"
                onClick={() => {
                  const toEdit = previewLesson;
                  setPreviewLesson(null);
                  handleOpenEdit(toEdit);
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "14px" }}
              >
                <Edit3 size={15} /> Edit this Lesson
              </button>
              <button
                className="btn-secondary"
                onClick={() => setPreviewLesson(null)}
                style={{ padding: "8px 16px", fontSize: "14px", background: "white" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
