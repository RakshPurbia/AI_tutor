import DashboardLayout from "../components/DashboardLayout";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { api } from "../lib/api";
import { 
  BookOpen, CheckCircle, Lock, Play, Pause, 
  ArrowRight, Award, Volume2, Sparkles, AlertCircle 
} from "lucide-react";

export default function Lessons() {
  const router = useRouter();
  const { lesson_id } = router.query;

  const [curriculum, setCurriculum] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auto-quiz initiation countdown state
  const [initiatingQuiz, setInitiatingQuiz] = useState(false);
  const [quizCountdown, setQuizCountdown] = useState(3);
  const [targetQuiz, setTargetQuiz] = useState(null);

  const audioRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const autoAnnouncedRef = useRef(false);

  const loadCurriculum = async () => {
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
    try {
      setLoading(true);
      const data = await api.getStudentCurriculum(studentId);
      setCurriculum(data);

      if (data.modules && data.modules.length > 0) {
        // Choose module: prefer one that contains target lesson_id if specified in URL query
        let mod = data.modules[0];
        let foundLesson = null;

        if (lesson_id) {
          for (const m of data.modules) {
            const l = (m.lessons || []).find(item => item.id === lesson_id);
            if (l) {
              mod = m;
              foundLesson = l;
              break;
            }
          }
        }

        setSelectedModule(mod);

        if (foundLesson) {
          setActiveLesson(foundLesson);
        } else {
          // Select current active lesson or first unlocked lesson in that module
          const lessons = mod.lessons || [];
          const activeInMod = lessons.find(l => l.status === "in_progress") || 
                              lessons.find(l => l.status === "completed") || 
                              lessons[0];
          setActiveLesson(activeInMod);
        }
      }
    } catch (err) {
      console.error("Failed to load curriculum:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurriculum();
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [lesson_id]);


  // Handle voice commands passed via URL when navigating from another page
  useEffect(() => {
    if (router.query.voice_cmd && !loading && curriculum && selectedModule) {
      const cmd = router.query.voice_cmd;
      // Dispatch locally after a short delay so the module can settle
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("lessons_voice_command", { detail: cmd }));
      }, 800);
      // Remove from URL so it doesn't trigger again on refresh
      router.replace("/lessons", undefined, { shallow: true });
    }
  }, [router.query.voice_cmd, loading, curriculum, selectedModule]);

  // Automatic announcement once
  useEffect(() => {
    if (!loading && selectedModule && !autoAnnouncedRef.current) {
      autoAnnouncedRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("play_global_tts", {
          detail: { text: `Welcome to My Library. Your active module is ${selectedModule.title}.` }
        }));
      }, 1500);
    }
  }, [loading, selectedModule]);

  // Voice Command Handling for Lessons
  useEffect(() => {
    const handleVoice = (e) => {
      const cmd = (e.detail || "").toLowerCase();
      if (!curriculum || !curriculum.modules) return;
      
      let targetModule = selectedModule;
      
      // Look for module mention
      for (const mod of curriculum.modules) {
        const titleWords = mod.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3);
        if (titleWords.some(w => cmd.includes(w))) {
          targetModule = mod;
          break;
        }
      }

      if (targetModule && targetModule.content_id !== selectedModule?.content_id) {
        handleSelectModule(targetModule);
      }

      const lessons = targetModule ? targetModule.lessons : [];
      
      // Look for "part X" or "section X"
      let targetLesson = null;
      for (let i = 0; i < lessons.length; i++) {
        const numStr = (i + 1).toString();
        // Just simple mapping for 1-3 which are typical
        const wordMap = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five"};
        const words = [
            "part " + numStr, "section " + numStr, "lesson " + numStr, 
            "part " + wordMap[numStr], "section " + wordMap[numStr]
        ];
        if (words.some(w => cmd.includes(w)) || cmd.includes(lessons[i].title.toLowerCase())) {
          targetLesson = lessons[i];
          break;
        }
      }

      // If they asked for a module but didn't specify a part, default to the active/in_progress one
      if (!targetLesson && targetModule && targetModule.content_id !== selectedModule?.content_id) {
          targetLesson = lessons.find(l => l.status === "in_progress") || 
                         lessons.find(l => l.status === "completed") || 
                         lessons[0];
      }
      
      if (targetLesson) {
        if (targetLesson.status === "locked") {
          window.dispatchEvent(new CustomEvent("play_global_tts", {
            detail: { text: "That section is locked. Please complete the previous sections first." }
          }));
        } else {
          handleSelectLesson(targetLesson);
          if (cmd.includes("play") || cmd.includes("speak") || cmd.includes("listen") || cmd.includes("read") || cmd.includes("start") || cmd.includes("begin") || cmd.includes("go to") || cmd.includes("open")) {
            window.dispatchEvent(new CustomEvent("play_global_tts", {
              detail: { text: `Reading ${targetLesson.title}` }
            }));
            setTimeout(() => playAudio(targetLesson.transcript), 2500);
          }
        }
      } else if (cmd.includes("play") || cmd.includes("speak") || cmd.includes("listen") || cmd.includes("read") || cmd.includes("start") || cmd.includes("begin") || cmd.includes("go to") || cmd.includes("open")) {
          if (activeLesson) {
             window.dispatchEvent(new CustomEvent("play_global_tts", {
               detail: { text: `Reading ${activeLesson.title}` }
             }));
             setTimeout(() => playAudio(activeLesson.transcript), 2500);
          }
      } else if (cmd.includes("pause") || cmd.includes("stop")) {
          if (isPlayingAudio && audioRef.current) {
              window.dispatchEvent(new CustomEvent("play_global_tts", { detail: { text: "Playback paused." } }));
              audioRef.current.pause();
              setIsPlayingAudio(false);
          }
      } else if (cmd.includes("complete") || cmd.includes("finish") || cmd.includes("done")) {
          if (activeLesson) {
              window.dispatchEvent(new CustomEvent("play_global_tts", {
                detail: { text: "Marking section as complete." }
              }));
              handleCompleteSection(false);
          }
      }
    };

    window.addEventListener("lessons_voice_command", handleVoice);
    return () => window.removeEventListener("lessons_voice_command", handleVoice);
  }, [selectedModule, activeLesson, isPlayingAudio, curriculum]);

  const playAudio = async (text) => {
    if (isPlayingAudio) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    try {
      const rawId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      const res = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, student_id: studentId })
      });
      if (!res.ok) {
        console.warn("TTS failed, falling back to browser voice");
        throw "TTS_FAILED";
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          const pct = Math.round((audio.currentTime / audio.duration) * 100);
          setAudioProgress(pct);
        }
      };

      audio.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(100);
        // Prompt automatic completion on audio end if section not yet completed
        if (activeLesson && activeLesson.status !== "completed") {
          handleCompleteSection(false);
        }
      };

      audio.play();
    } catch (e) {
      console.error("Audio playback error:", e);
      setIsPlayingAudio(false);
      // Browser fallback speech synthesis
      if (window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.onend = () => {
          setIsPlayingAudio(false);
          setAudioProgress(100);
          if (activeLesson && activeLesson.status !== "completed") {
            handleCompleteSection(false);
          }
        };
        window.speechSynthesis.speak(utter);
      }
    }
  };

  const handleSelectLesson = (lesson) => {
    if (lesson.status === "locked") {
      alert("This section is locked! Please complete the prior section and its quiz to unlock it.");
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setActiveLesson(lesson);
  };

  const handleSelectModule = (mod) => {
    setSelectedModule(mod);
    const lessons = mod.lessons || [];
    const activeInMod = lessons.find(l => l.status === "in_progress") || 
                        lessons.find(l => l.status === "completed") || 
                        lessons[0];
    setActiveLesson(activeInMod);
    if (audioRef.current) audioRef.current.pause();
    setIsPlayingAudio(false);
    setAudioProgress(0);
  };

  const handleCompleteSection = async (immediate = false) => {
    if (!activeLesson) return;
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";

    try {
      const res = await api.completeLesson(studentId, activeLesson.id);
      
      // If quiz exists for this section, automatically initiate quiz flow!
      if (res.has_quiz && res.quiz_id) {
        setTargetQuiz({
          id: res.quiz_id,
          title: res.quiz_title,
          lesson_id: activeLesson.id,
          lesson_title: activeLesson.title
        });
        setInitiatingQuiz(true);
        setQuizCountdown(3);

        // Voice announcement via TTS
        try {
          const rawId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
          const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
          fetch("http://localhost:8000/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `Section completed! Initiating your quiz for ${activeLesson.title} now.`, student_id: studentId })
          }).then(r => r.blob()).then(b => {
            const a = new Audio(URL.createObjectURL(b));
            a.play().catch(() => {});
          });
        } catch(e) {}

        if (immediate) {
          router.push(`/quiz?id=${res.quiz_id}&lesson_id=${activeLesson.id}&auto=true`);
          return;
        }

        let secondsLeft = 3;
        countdownTimerRef.current = setInterval(() => {
          secondsLeft -= 1;
          setQuizCountdown(secondsLeft);
          if (secondsLeft <= 0) {
            clearInterval(countdownTimerRef.current);
            router.push(`/quiz?id=${res.quiz_id}&lesson_id=${activeLesson.id}&auto=true`);
          }
        }, 1000);
      } else {
        // No quiz, just reload curriculum
        loadCurriculum();
      }
    } catch (e) {
      console.error("Error completing lesson:", e);
    }
  };

  const studentName = typeof window !== "undefined" ? (localStorage.getItem("student_name") || "Student") : "Student";

  return (
    <DashboardLayout userName={studentName} title="My Library" subtitle="Step-by-step sequenced learning with automatic quiz checkpoints" disableAutoTTS={true}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        {/* Module Switcher Tabs (if multiple modules) */}
        {curriculum && curriculum.modules && curriculum.modules.length > 1 && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", overflowX: "auto", paddingBottom: "4px" }}>
            {curriculum.modules.map(mod => {
              const isSelected = selectedModule && selectedModule.content_id === mod.content_id;
              return (
                <button
                  key={mod.content_id}
                  onClick={() => handleSelectModule(mod)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "12px",
                    fontWeight: "600",
                    fontSize: "14px",
                    border: isSelected ? "2px solid var(--purple)" : "1px solid var(--border)",
                    background: isSelected ? "var(--purple-light)" : "var(--card)",
                    color: isSelected ? "var(--purple)" : "var(--text-main)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s"
                  }}
                >
                  <BookOpen size={16} />
                  <span>{mod.title}</span>
                  <span style={{ fontSize: "12px", background: "white", padding: "2px 8px", borderRadius: "99px", border: "1px solid var(--border)" }}>
                    {mod.progress_pct}%
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="card" style={{ padding: "48px", textAlign: "center" }}>
            <p className="text-muted">Loading library sequence...</p>
          </div>
        )}

        {!loading && selectedModule && (
          <>
            {/* Module Overview Card */}
            <div className="card" style={{ marginBottom: "28px", padding: "24px 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "var(--purple)" }}>
                    {selectedModule.subject || "Course Module"}
                  </span>
                  <h2 className="text-2xl font-bold" style={{ marginTop: "4px" }}>{selectedModule.title}</h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="text-sm font-bold text-muted">Module Completion</span>
                  <h3 className="text-2xl font-bold" style={{ color: "var(--purple)" }}>{selectedModule.progress_pct}%</h3>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-bar-container" style={{ height: "10px", borderRadius: "99px" }}>
                <div className="progress-bar-fill" style={{ width: `${selectedModule.progress_pct}%`, borderRadius: "99px", background: "var(--purple)" }}></div>
              </div>
            </div>

            {/* Sequenced Parts Progress Tracker (Parts A, B, C) */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <Sparkles size={18} color="var(--purple)" />
                <h3 className="text-lg font-bold">My Library Sequence</h3>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  (Each section unlocks the next upon quiz completion)
                </span>
              </div>

              <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "16px" }}>
                {(() => {
                  const sequenceItems = [];
                  (selectedModule.lessons || []).forEach((lesson, idx) => {
                    sequenceItems.push({
                      ...lesson,
                      isQuiz: false,
                      displayStatus: lesson.status,
                      idx: idx
                    });

                    if (lesson.quiz_id) {
                      let q_status = "locked";
                      if (lesson.status === "completed") {
                        q_status = "completed"; // We don't have quiz attempt status, so assume accessible/done if lesson is done
                      }
                      sequenceItems.push({
                        id: lesson.quiz_id,
                        quiz_id: lesson.quiz_id,
                        title: `Quiz: ${lesson.title}`,
                        isQuiz: true,
                        lesson_id: lesson.id,
                        displayStatus: q_status,
                        idx: idx
                      });
                    }
                  });

                  return sequenceItems.map((item, i) => {
                    const isSelected = !item.isQuiz && activeLesson && activeLesson.id === item.id;
                    const isCompleted = item.displayStatus === "completed";
                    const isLocked = item.displayStatus === "locked";
                    const isInProgress = item.displayStatus === "in_progress";

                    return (
                      <div
                        key={item.isQuiz ? `q-${item.quiz_id}` : `l-${item.id}`}
                        onClick={() => {
                          if (item.isQuiz) {
                            if (isLocked) alert("This quiz is locked! Please complete the lesson first.");
                            else router.push(`/quiz?id=${item.quiz_id}&lesson_id=${item.lesson_id}`);
                          } else {
                            handleSelectLesson(item);
                          }
                        }}
                        style={{
                          minWidth: "220px",
                          flexShrink: 0,
                          background: isSelected ? "white" : item.isQuiz ? "var(--amber-light)" : "var(--card)",
                          border: isSelected ? "2px solid var(--purple)" : item.isQuiz ? "1px solid var(--amber)" : "1px solid var(--border)",
                          borderRadius: "16px",
                          padding: "18px 20px",
                          cursor: isLocked ? "not-allowed" : "pointer",
                          opacity: isLocked ? 0.6 : 1,
                          boxShadow: isSelected ? "0 8px 20px rgba(124, 58, 237, 0.12)" : "none",
                          transition: "all 0.2s ease",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                          <span style={{ 
                            fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px",
                            background: item.isQuiz 
                                        ? (isCompleted ? "var(--green-light)" : isInProgress ? "var(--amber)" : "rgba(255,255,255,0.5)") 
                                        : (isCompleted ? "var(--green-light)" : isInProgress ? "var(--purple-light)" : "var(--bg)"),
                            color: item.isQuiz 
                                   ? (isCompleted ? "var(--green)" : isInProgress ? "white" : "var(--amber-dark)")
                                   : (isCompleted ? "var(--green)" : isInProgress ? "var(--purple)" : "var(--text-muted)")
                          }}>
                            {item.isQuiz ? `Quiz ${item.idx + 1}` : `Part ${item.idx + 1}`}
                          </span>

                          {isCompleted && <CheckCircle size={20} color="var(--green)" />}
                          {isInProgress && !item.isQuiz && <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--purple)", display: "inline-block", boxShadow: "0 0 8px var(--purple)" }}></span>}
                          {isInProgress && item.isQuiz && <Award size={18} color="white" />}
                          {isLocked && <Lock size={18} color="var(--text-muted)" />}
                        </div>

                        <h4 className="font-bold text-base" style={{ marginBottom: "6px", lineHeight: "1.4", color: item.isQuiz ? "var(--amber-dark)" : "var(--text-main)" }}>
                          {item.title}
                        </h4>

                        {!item.isQuiz && item.quiz_id && isCompleted && (
                          <p style={{ fontSize: "12px", color: "var(--green)", fontWeight: "600", marginTop: "auto", paddingTop: "8px" }}>
                            Completed
                          </p>
                        )}

                        {isInProgress && (
                          <p style={{ fontSize: "12px", color: item.isQuiz ? "var(--amber-dark)" : "var(--purple)", fontWeight: "600", marginTop: "auto", paddingTop: "8px" }}>
                            Current Active &rarr;
                          </p>
                        )}

                        {isLocked && (
                          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "auto", paddingTop: "8px" }}>
                            Locked
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Active Sequenced Content Viewer */}
            {activeLesson && (
              <div className="card" style={{ padding: "32px", position: "relative", border: "2px solid var(--purple-border)" }}>
                
                {/* Section Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: "20px", marginBottom: "24px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ background: "var(--purple-light)", color: "var(--purple)", fontWeight: "700", fontSize: "12px", padding: "4px 12px", borderRadius: "99px" }}>
                        Sequenced Section {activeLesson.sequence_order}
                      </span>
                      {activeLesson.status === "completed" && (
                        <span style={{ background: "var(--green-light)", color: "var(--green)", fontWeight: "700", fontSize: "12px", padding: "4px 12px", borderRadius: "99px" }}>
                          Completed
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold">{activeLesson.title}</h2>
                  </div>

                  {/* Audio Read-Aloud Button */}
                  <button 
                    className="btn-outline" 
                    onClick={() => playAudio(activeLesson.transcript)}
                    style={{ 
                      display: "flex", alignItems: "center", gap: "8px", 
                      padding: "10px 20px", borderRadius: "99px",
                      background: isPlayingAudio ? "var(--purple)" : "white",
                      color: isPlayingAudio ? "white" : "var(--purple)",
                      borderColor: "var(--purple)"
                    }}
                  >
                    {isPlayingAudio ? <Pause size={18} /> : <Volume2 size={18} />}
                    <span style={{ fontWeight: "600" }}>{isPlayingAudio ? "Pause Audio" : "Listen to Section"}</span>
                  </button>
                </div>

                {/* Audio Playing Bar */}
                {isPlayingAudio && (
                  <div style={{ background: "var(--purple-light)", padding: "12px 20px", borderRadius: "12px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <Volume2 size={20} color="var(--purple)" />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--purple-dark)" }}>Speaking lesson via Piper Text-to-Speech...</span>
                    <div style={{ flex: 1, height: "6px", background: "white", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ width: `${audioProgress}%`, height: "100%", background: "var(--purple)", transition: "width 0.2s" }}></div>
                    </div>
                  </div>
                )}

                {/* Lesson Content / Transcript */}
                <div style={{ background: "var(--bg)", borderRadius: "16px", padding: "28px", marginBottom: "32px", fontSize: "16px", lineHeight: "1.8", color: "var(--text-main)" }}>
                  <p style={{ margin: 0, fontStyle: "normal" }}>{activeLesson.transcript}</p>
                </div>

                {/* Associated Quiz Information Card */}
                {activeLesson.quiz_id && (
                  <div style={{ 
                    background: "white", 
                    border: "1px solid var(--border)", 
                    borderRadius: "16px", 
                    padding: "20px 24px", 
                    marginBottom: "32px",
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between" 
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "var(--amber-light)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Award size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-base">Checkpoint Quiz</h4>
                        <p className="text-sm text-muted">
                          {activeLesson.status === "completed" 
                            ? `Section completed. You can retake the quiz.` 
                            : "Initiates automatically upon completing this section"}
                        </p>
                      </div>
                    </div>

                    {activeLesson.status === "completed" && (
                      <button 
                        className="btn-outline" 
                        onClick={() => router.push(`/quiz?id=${activeLesson.quiz_id}&lesson_id=${activeLesson.id}`)}
                        style={{ padding: "8px 16px", fontSize: "13px" }}
                      >
                        Retake Quiz
                      </button>
                    )}
                  </div>
                )}

                {/* Completion & Auto-Quiz Action Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "13px" }}>
                    <AlertCircle size={16} />
                    <span>Completing this section automatically records progress and launches its quiz checkpoint.</span>
                  </div>

                  <button 
                    className="btn-primary" 
                    onClick={() => handleCompleteSection(false)}
                    style={{ padding: "14px 32px", fontSize: "15px", display: "flex", alignItems: "center", gap: "10px", borderRadius: "12px" }}
                  >
                    <span>Complete Section & Start Quiz</span>
                    <ArrowRight size={18} />
                  </button>
                </div>

              </div>
            )}
          </>
        )}

      </div>

      {/* Automatic Quiz Initiation Modal Overlay */}
      {initiatingQuiz && targetQuiz && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "white",
            borderRadius: "24px",
            padding: "48px 40px",
            maxWidth: "500px",
            width: "90%",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <div style={{ 
              width: "80px", height: "80px", borderRadius: "50%", 
              background: "var(--purple-light)", color: "var(--purple)", 
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px", fontSize: "36px", fontWeight: "bold" 
            }}>
              {quizCountdown}
            </div>

            <h3 className="text-2xl font-bold mb-2">Section Completed!</h3>
            <p className="text-muted text-base mb-6">
              Initiating checkpoint quiz for <strong>{targetQuiz.lesson_title}</strong> in {quizCountdown} seconds...
            </p>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                className="btn-outline" 
                onClick={() => {
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                  setInitiatingQuiz(false);
                  loadCurriculum();
                }}
                style={{ padding: "12px 24px" }}
              >
                Review Section First
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                  router.push(`/quiz?id=${targetQuiz.id}&lesson_id=${targetQuiz.lesson_id}&auto=true`);
                }}
                style={{ padding: "12px 32px" }}
              >
                Start Quiz Now &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
