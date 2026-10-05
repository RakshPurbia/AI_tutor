import DashboardLayout from "../components/DashboardLayout";
import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import { Trophy, CheckCircle, XCircle, Volume2, Square, RotateCcw, Sparkles } from "lucide-react";

export default function Quiz() {
  const router = useRouter();
  const { id: quiz_id, quiz_id: alt_id, lesson_id, auto } = router.query;
  const activeQuizId = quiz_id || alt_id;

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [playingTTS, setPlayingTTS] = useState(false);

  const resultAudioRef = useRef(null);
  const speechTimerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);
  const autoAnnouncedRef = useRef(-1);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(5);

  useEffect(() => {
    if (!activeQuizId) return;
    fetch(`http://localhost:8000/api/quiz/${activeQuizId}`)
      .then(res => res.json())
      .then(data => {
        setQuiz(data.quiz);
        setQuestions(data.questions);
      })
      .catch(err => console.error("Error fetching quiz", err));

    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      if (resultAudioRef.current) {
        resultAudioRef.current.pause();
        resultAudioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
    };
  }, [activeQuizId]);

  const handleSelect = (option) => {
    setAnswers(prev => ({
      ...prev,
      [questions[currentIndex].id]: option
    }));
  };

  const playResultTTS = async (text) => {
    if (!text) return;

    if (playingTTS) {
      if (resultAudioRef.current) {
        resultAudioRef.current.pause();
        resultAudioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayingTTS(false);
      return;
    }

    setPlayingTTS(true);

    try {
      const rawId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      const res = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, student_id: studentId })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        resultAudioRef.current = audio;
        audio.onended = () => setPlayingTTS(false);
        audio.onerror = () => fallbackSpeak(text);
        await audio.play();
      } else {
        fallbackSpeak(text);
      }
    } catch {
      fallbackSpeak(text);
    }
  };

  const fallbackSpeak = (text) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.onend = () => setPlayingTTS(false);
      utt.onerror = () => setPlayingTTS(false);
      setPlayingTTS(true);
      window.speechSynthesis.speak(utt);
    } else {
      setPlayingTTS(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    const payload = {
      student_id: studentId,
      quiz_id: activeQuizId,
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
      
      // Save marks in progress database and display feedback directly on page WITHOUT navigating
      setQuizResult(data);
      setIsSubmitting(false);

      const summaryText = `Great effort on ${quiz?.title || "your quiz"}! You scored ${data.score} out of ${data.total}. I have saved your marks in your progress dashboard. Let's review your answers below.`;

      // 2-second break before speaking the result
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      speechTimerRef.current = setTimeout(() => {
        playResultTTS(summaryText);
      }, 2000);

      // Start auto-advance countdown if this was part of an automatic sequence
      if (auto === "true") {
        let seconds = 5;
        setAutoAdvanceCountdown(seconds);
        autoAdvanceTimerRef.current = setInterval(() => {
          seconds -= 1;
          setAutoAdvanceCountdown(seconds);
          if (seconds <= 0) {
            clearInterval(autoAdvanceTimerRef.current);
            router.push("/lessons"); // Navigate back to library; it will auto-select the next unlocked part
          }
        }, 1000);
      }

    } catch (err) {
      console.error("Error submitting quiz", err);
      setIsSubmitting(false);
    }
  };

  const currentQ = questions.length > 0 ? questions[currentIndex] : null;
  let parsedOptions = [];
  if (currentQ) {
    try {
      parsedOptions = JSON.parse(currentQ.options);
    } catch (e) {
      parsedOptions = currentQ.options;
    }
  }


  // Voice Announcement of Question (Once per question)
  useEffect(() => {
    if (questions.length > 0 && quiz && !isSubmitting && !quizResult && autoAnnouncedRef.current !== currentIndex) {
      autoAnnouncedRef.current = currentIndex;
      const optionNumbers = ["1", "2", "3", "4"];
      let optionText = parsedOptions.map((o, i) => `Option ${optionNumbers[i]}: ${o}`).join(". ");
      const msg = `Question ${currentIndex + 1}. ${currentQ.question_text}. ${optionText}`;
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("play_global_tts", { detail: { text: msg } }));
      }, 1500);
    }
  }, [currentIndex, questions, quiz, isSubmitting, quizResult]);

  // Voice Command Handling during quiz
  useEffect(() => {
    const handleVoice = (e) => {
      const cmd = (e.detail || "").toLowerCase();
      if (questions.length === 0 || quizResult) return;
      
      if (cmd.includes("which is correct") || cmd.includes("what is correct") || cmd.includes("what is the answer") || cmd.includes("tell me the answer")) {
        window.dispatchEvent(new CustomEvent("play_global_tts", { 
          detail: { text: "I cannot give you the answer! Is it option 1, 2, 3, or 4?" } 
        }));
        return;
      }

      if (cmd.includes("submit") || cmd.includes("finish") || cmd.includes("done")) {
        handleSubmit();
        return;
      }
      if (cmd.includes("next")) {
        if (currentIndex < questions.length - 1) setCurrentIndex(idx => idx + 1);
        return;
      }
      if (cmd.includes("previous") || cmd.includes("back")) {
        if (currentIndex > 0) setCurrentIndex(idx => idx - 1);
        return;
      }
      
      let matchedIndex = -1;
      if (cmd.includes("option 1") || cmd.includes("first option") || cmd.includes("option a") || cmd.includes("1 is correct") || cmd.includes("one is correct")) {
        matchedIndex = 0;
      } else if (cmd.includes("option 2") || cmd.includes("second option") || cmd.includes("option b") || cmd.includes("2 is correct") || cmd.includes("two is correct")) {
        matchedIndex = 1;
      } else if (cmd.includes("option 3") || cmd.includes("third option") || cmd.includes("option c") || cmd.includes("3 is correct") || cmd.includes("three is correct")) {
        matchedIndex = 2;
      } else if (cmd.includes("option 4") || cmd.includes("fourth option") || cmd.includes("option d") || cmd.includes("4 is correct") || cmd.includes("four is correct")) {
        matchedIndex = 3;
      } else {
        for (let i = 0; i < parsedOptions.length; i++) {
          if (cmd.includes(parsedOptions[i].toLowerCase())) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1 && parsedOptions[matchedIndex]) {
        handleSelect(parsedOptions[matchedIndex]);
        window.dispatchEvent(new CustomEvent("play_global_tts", { 
          detail: { text: `Option ${matchedIndex + 1} selected.` } 
        }));
        
        setTimeout(() => {
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(idx => idx + 1);
          } else {
            handleSubmit();
          }
        }, 1500);
      }
    };
    window.addEventListener("quiz_voice_command", handleVoice);
    return () => window.removeEventListener("quiz_voice_command", handleVoice);
  }, [currentIndex, questions, parsedOptions, quizResult]);

  const studentName = typeof window !== "undefined" ? (localStorage.getItem("student_name") || "Student") : "Student";

  if (!quiz || questions.length === 0) {
    return <DashboardLayout title="Loading..."><p>Loading quiz...</p></DashboardLayout>;
  }

  // --- RESULT VIEW: Displayed right here like an AI chat, marks saved, NO NAVIGATION ---
  if (quizResult) {
    const accuracy = quizResult.total > 0 ? Math.round((quizResult.score / quizResult.total) * 100) : 0;
    const summaryText = `Great effort on ${quiz.title}! You scored ${quizResult.score} out of ${quizResult.total} (${accuracy}%). I have saved your marks in your progress dashboard. Let's review your answers below:`;

    return (
      <DashboardLayout userName={studentName} title="Quiz Feedback" subtitle={quiz.title} disableAutoTTS={true}>
        <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* AI Tutor Feedback Bubble */}
          <div className="card" style={{ padding: "24px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--purple-light)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: "700", fontSize: "16px" }}>AI Tutor</h4>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Checkpoint Feedback & Scoring</span>
              </div>
            </div>

            <p style={{ fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px 0", color: "var(--text-main)" }}>
              {summaryText}
            </p>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button 
                onClick={() => playResultTTS(summaryText)}
                className="btn-outline" 
                style={{ 
                  padding: "6px 14px", fontSize: "12px", borderRadius: "99px",
                  background: playingTTS ? "var(--purple-light)" : "var(--green-light)",
                  borderColor: playingTTS ? "var(--purple-border)" : "var(--green-light)",
                  color: playingTTS ? "var(--purple)" : "var(--green)",
                  display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer"
                }}
              >
                {playingTTS ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />} 
                {playingTTS ? "Stop" : "Listen / Repeat Feedback"}
              </button>

              <span style={{ padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: "700", background: "var(--purple-light)", color: "var(--purple)" }}>
                Score: {quizResult.score} / {quizResult.total} ({accuracy}%)
              </span>
              <span style={{ padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: "700", background: "var(--green-light)", color: "var(--green)" }}>
                Saved in Progress Dashboard ✅
              </span>
            </div>
          </div>

          {/* Question Breakdown in Interactive Chat Style */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: "8px 0 4px 0", fontSize: "18px", fontWeight: "700" }}>Question Review & Answers</h3>
            {(quizResult.results || []).map((r, i) => (
              <div 
                key={i} 
                className="card" 
                style={{ 
                  padding: "20px", borderRadius: "12px", 
                  border: `1.5px solid ${r.is_correct ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  background: "var(--card)"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", flex: 1, lineHeight: 1.5 }}>
                    Question {i + 1}: {r.question_text}
                  </h4>
                  {r.is_correct ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--green)", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap" }}>
                      <CheckCircle size={16} /> Correct
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--red)", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap" }}>
                      <XCircle size={16} /> Incorrect
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
                  <div style={{ padding: "10px 14px", borderRadius: "8px", background: r.is_correct ? "var(--green-light)" : "var(--red-light)", color: r.is_correct ? "var(--green)" : "var(--red)" }}>
                    <strong>Your Selected Answer:</strong> {r.selected_answer || "No option selected"}
                  </div>
                  {!r.is_correct && (
                    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--green-light)", color: "var(--green)" }}>
                      <strong>Correct Answer:</strong> {r.correct_answer}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", margin: "16px 0 40px 0", flexWrap: "wrap", alignItems: "center" }}>
            
            {auto === "true" && (
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
                  router.push("/lessons");
                }}
                style={{ padding: "14px 32px", fontSize: "16px", borderRadius: "99px", background: "var(--green)", borderColor: "var(--green)" }}
              >
                Continue to Next Section ({autoAdvanceCountdown}s) &rarr;
              </button>
            )}
            
            <button 
              className={auto === "true" ? "btn-outline" : "btn-primary"}
              onClick={() => {
                if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
                setQuizResult(null);
                setAnswers({});
                setCurrentIndex(0);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RotateCcw size={16} /> Retake Quiz
            </button>
            <button 
              className="btn-outline" 
              onClick={() => {
                if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
                router.push("/lessons");
              }}
            >
              Back to Library
            </button>
            <button 
              className="btn-outline" 
              onClick={() => {
                if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
                router.push("/dashboard");
              }}
            >
              Back to Dashboard
            </button>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  // --- QUIZ QUESTION TAKING VIEW ---
  return (
    <DashboardLayout userName={studentName} title="AI Generated Quiz" subtitle={quiz.title} disableAutoTTS={true}>
      <div style={{ maxWidth: "800px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", padding: "32px", position: "relative" }}>
        
        {auto === "true" && (
          <div style={{ background: "var(--purple-light)", color: "var(--purple)", border: "1px solid var(--purple-border)", padding: "10px 18px", borderRadius: "12px", marginBottom: "20px", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🚀 Automatic Checkpoint Quiz initiated for your completed section. Complete to advance!</span>
          </div>
        )}

        <button 
          className="btn-primary" 
          style={{ position: "absolute", top: "32px", right: "32px", padding: "8px 24px" }}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Submit Quiz"}
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
