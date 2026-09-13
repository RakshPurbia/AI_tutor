import DashboardLayout from "../components/DashboardLayout";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function Quiz() {
  const router = useRouter();
  const { id: quiz_id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!quiz_id) return;
    fetch(`http://localhost:8000/api/quiz/${quiz_id}`)
      .then(res => res.json())
      .then(data => {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      })
      .catch(err => console.error("Error fetching quiz", err));
  }, [quiz_id]);

  const handleSelect = (option) => {
    setAnswers({
      ...answers,
      [questions[currentIndex].id]: option
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const studentId = localStorage.getItem("student_id");
    const payload = {
      student_id: studentId,
      quiz_id: quiz_id,
      answers: Object.keys(answers).map(qId => ({
        question_id: qId,
        selected_answer: answers[qId]
      }))
    };

    try {
      const res = await fetch("http://localhost:8000/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      router.push(`/quiz-result?score=${data.score}&total=${data.total}`);
    } catch (err) {
      console.error("Error submitting quiz", err);
      setIsSubmitting(false);
    }
  };

  if (!quiz || questions.length === 0) return <DashboardLayout title="Loading..."><p>Loading quiz...</p></DashboardLayout>;

  const currentQ = questions[currentIndex];
  // the backend options are json encoded strings, parse them
  let parsedOptions = [];
  try {
    parsedOptions = JSON.parse(currentQ.options);
  } catch (e) {
    parsedOptions = currentQ.options;
  }

  return (
    <DashboardLayout userName={typeof window !== "undefined" ? (localStorage.getItem("student_name") || "Student") : "Student"} title="AI Generated Quiz" subtitle={quiz.title}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", padding: "32px", position: "relative" }}>
        
        <button 
          className="btn-primary" 
          style={{ position: "absolute", top: "32px", right: "32px", padding: "8px 24px" }}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Quiz"}
        </button>

        <p className="text-sm text-muted font-bold mb-6" style={{ marginBottom: "24px" }}>Question {currentIndex + 1} of {questions.length}</p>
        
        <h3 className="text-xl font-bold mb-8" style={{ marginBottom: "32px", lineHeight: "1.5" }}>
          {currentQ.question_text}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
          {parsedOptions.map((opt, i) => {
            const isSelected = answers[currentQ.id] === opt;
            return (
              <label 
                key={i} 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "16px", 
                  padding: "16px 24px", 
                  border: `2px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`, 
                  borderRadius: "12px",
                  background: isSelected ? 'var(--purple-light)' : 'white',
                  cursor: "pointer",
                  fontWeight: isSelected ? "600" : "400",
                  color: isSelected ? 'var(--purple-dark)' : 'var(--text-main)',
                  transition: "all 0.2s"
                }}
                onClick={() => handleSelect(opt)}
              >
                <input type="radio" checked={isSelected} readOnly style={{ width: "20px", height: "20px", accentColor: "var(--purple)" }} />
                <span className="text-base">{opt}</span>
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button 
            className="btn-outline" 
            style={{ padding: "12px 32px" }} 
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            Previous
          </button>
          <button 
            className="btn-primary" 
            style={{ padding: "12px 32px" }}
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            Next
          </button>
        </div>

      </div>
    </DashboardLayout>
  );
}
