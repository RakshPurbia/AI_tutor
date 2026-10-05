import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "../../lib/api";
import DashboardLayout from "../../components/DashboardLayout";

export default function MyStudents() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState("Teacher");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      localStorage.setItem("role", "teacher");
      localStorage.setItem("user_role", "teacher");
    }

    const teacherId = localStorage.getItem("teacher_id");
    if (!teacherId) {
      router.push("/login");
      return;
    }
    
    setUserName(localStorage.getItem("user_name") || "Teacher");
    
    api.getTeacherStudentsProgress(teacherId)
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <DashboardLayout role="teacher" disableAutoTTS={true} userName={userName} title="My Students" subtitle="Track the progress of your students.">
      <div className="card">
        <p className="step-title">Student Progress Overview</p>
        
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "12px 8px" }}>Student Name</th>
                  <th style={{ padding: "12px 8px" }}>Class</th>
                  <th style={{ padding: "12px 8px" }}>Assignment</th>
                  <th style={{ padding: "12px 8px" }}>Quiz</th>
                  <th style={{ padding: "12px 8px" }}>Remark</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 8px", fontWeight: "500" }}>{student.name}</td>
                    <td style={{ padding: "12px 8px" }}>{student.class_name}</td>
                    <td style={{ padding: "12px 8px", color: student.assignment_done ? "var(--green)" : "red", fontWeight: "600" }}>
                      {student.assignment_done ? "Done" : "Pending"}
                    </td>
                    <td style={{ padding: "12px 8px", color: student.quiz_done ? "var(--green)" : "red", fontWeight: "600" }}>
                      {student.quiz_done ? "Done" : "Pending"}
                    </td>
                    <td style={{ padding: "12px 8px", fontSize: "0.9em", color: "var(--text-secondary)", maxWidth: "300px", lineHeight: "1.4" }}>
                      {student.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && (
              <p style={{ textAlign: "center", marginTop: "20px", color: "var(--text-secondary)" }}>No students found.</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
