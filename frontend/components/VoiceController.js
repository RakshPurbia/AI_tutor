import { useEffect, useState, useRef } from "react";
import { Mic, Loader2, Volume2, Sparkles } from "lucide-react";
import { useRouter } from "next/router";

export default function VoiceController() {
  const [displayStatus, setDisplayStatus] = useState("idle"); 
  const [displayTranscript, setDisplayTranscript] = useState("");
  
  const statusRef = useRef("idle"); // 'idle', 'recording', 'processing', 'speaking'
  const accumulatedQueryRef = useRef("");
  const recognitionRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const audioRef = useRef(null);
  const routerRef = useRef(null);
  const tutorNameRef = useRef("Tutor");
  const lastSpokenTextRef = useRef("");

  const router = useRouter();
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    const fetchTutorInfo = async () => {
      const rawId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      try {
        const res = await fetch(`http://localhost:8000/api/voice-profiles/${studentId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tutor_name) {
            tutorNameRef.current = data.tutor_name;
          }
        }
      } catch (e) {
        console.error("Could not fetch active tutor name", e);
      }
    };
    fetchTutorInfo();

    const handleProfileUpdate = (e) => {
      if (e.detail && e.detail.tutor_name) {
        tutorNameRef.current = e.detail.tutor_name;
      }
    };
    window.addEventListener("voice_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("voice_profile_updated", handleProfileUpdate);
  }, []);

  const checkIsBlocked = () => {
    if (!router || !router.pathname) return false;
    if (router.pathname.startsWith("/parent") || router.pathname.startsWith("/teacher") || router.pathname === "/upload") {
      return true;
    }
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user_role") || localStorage.getItem("role");
      if (stored === "parent" || stored === "teacher") {
        return true;
      }
    }
    return false;
  };

  const updateStatus = (newStatus) => {
    statusRef.current = newStatus;
    setDisplayStatus(newStatus);
  };

  const playTTS = async (text, onComplete) => {
    if (checkIsBlocked()) return;
    lastSpokenTextRef.current = text;
    updateStatus("speaking");
    if (audioRef.current) audioRef.current.pause();
    
    // temporarily stop recognition so it doesn't hear itself
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

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
        audioRef.current = audio;
        
        audio.onended = () => {
          if (onComplete) onComplete();
          updateStatus("idle");
          setDisplayTranscript("");
          if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch(e) {}
          }
        };
        audio.play().catch(e => {
            console.error("Audio playback blocked:", e);
            window.dispatchEvent(new CustomEvent("audio_blocked"));
            updateStatus("idle");
            if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch(e) {}
            }
        });
      } else {
         if (onComplete) onComplete();
         updateStatus("idle");
         if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch(e) {}
         }
      }
    } catch (err) {
      console.error("Piper TTS failed:", err);
      updateStatus("idle");
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  // Allow other components to trigger TTS
  useEffect(() => {
    if (checkIsBlocked()) return;
    const handleGlobalTTS = (e) => {
      if (checkIsBlocked()) return;
      if (e.detail && e.detail.text) {
        playTTS(e.detail.text, e.detail.onComplete);
      }
    };
    const handleTutorSpeechStart = () => {
      if (checkIsBlocked()) return;
      updateStatus("speaking");
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
    const handleTutorSpeechEnd = () => {
      if (checkIsBlocked()) return;
      updateStatus("idle");
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    };

    window.addEventListener("play_global_tts", handleGlobalTTS);
    window.addEventListener("tutor_speech_start", handleTutorSpeechStart);
    window.addEventListener("tutor_speech_end", handleTutorSpeechEnd);
    return () => {
      window.removeEventListener("play_global_tts", handleGlobalTTS);
      window.removeEventListener("tutor_speech_start", handleTutorSpeechStart);
      window.removeEventListener("tutor_speech_end", handleTutorSpeechEnd);
    };
  }, [router.pathname]);

  const sendToAI = async (query) => {
    updateStatus("processing");
    try {
      const rawId = localStorage.getItem("student_id");
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      const res = await fetch("http://localhost:8000/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          student_id: studentId, 
          question: query,
          page_context: routerRef.current.pathname 
        })
      });
      const data = await res.json();
      
      if (data.navigation_action) {
        let dest = data.navigation_action.split("_")[1].toLowerCase();
        
        // Normalize the destination returned by AI to match valid Next.js routes
        if (dest.includes("library") || dest.includes("lesson")) dest = "lessons";
        else if (dest.includes("tutor") || dest.includes("ai")) dest = "tutor";
        else if (dest.includes("quiz")) dest = "quizzes";
        else if (dest.includes("dash") || dest.includes("home")) dest = "dashboard";
        else if (dest.includes("set")) dest = "settings";
        else if (dest.includes("prof")) dest = "profile";
        else if (dest.includes("prog")) dest = "progress";
        else if (dest.includes("hist")) dest = "history";

        setTimeout(() => {
          if (routerRef.current && routerRef.current.pathname !== `/${dest}`) {
            routerRef.current.push(`/${dest}`);
          }
        }, 1500);
      }
      playTTS(data.answer);
    } catch (err) {
      console.error("AI fetch failed:", err);
      playTTS("Sorry, I could not reach the server right now.");
    }
  };

  const finishRecording = () => {
    const finalQuery = accumulatedQueryRef.current.trim();
    accumulatedQueryRef.current = "";
    
    if (!finalQuery) {
      updateStatus("idle");
      setDisplayTranscript("");
      return;
    }

    const lower = finalQuery.toLowerCase().trim();

    // Accessibility & Navigation for blind students
    if (lower === "stop" || lower === "pause" || lower === "be quiet" || lower === "cancel" || lower === "shut up") {
      if (audioRef.current) audioRef.current.pause();
      updateStatus("idle");
      setDisplayTranscript("");
      return;
    }

    if (lower.includes("where am i") || lower.includes("what page") || lower.includes("current page") || lower.includes("which page")) {
      const path = routerRef.current?.pathname || "";
      let desc = "You are on your main Dashboard. Say 'Go to Lessons', 'Go to Quizzes', or ask a question.";
      if (path.startsWith("/lessons")) desc = "You are in My Library. Say 'Play Part 1' or 'Start Lesson' to listen.";
      else if (path.startsWith("/quiz")) desc = "You are in an active Quiz. Say 'Option 1', 'Option 2', 'Option 3', or 'Option 4' to answer.";
      else if (path.startsWith("/tutor")) desc = `You are with your personal tutor, ${tutorNameRef.current}. Ask any study question.`;
      else if (path.startsWith("/profile")) desc = "You are on your Profile and Voice Persona Settings.";
      else if (path.startsWith("/progress")) desc = "You are on your Progress and Analytics page.";
      playTTS(desc);
      return;
    }

    if (lower.includes("repeat") || lower.includes("say that again") || lower.includes("what did you say")) {
      if (lastSpokenTextRef.current) {
        playTTS(lastSpokenTextRef.current);
        return;
      }
    }

    // We now rely purely on NLP backend for all navigation, suggestions, and information queries!

    // 3. NORMAL CASE: Do not navigate! Handle in-place on current active page:
    if (routerRef.current.pathname === "/tutor") {
      updateStatus("idle");
      setDisplayTranscript("");
      window.dispatchEvent(new CustomEvent("tutor_query", { detail: finalQuery }));
      return;
    }

    if (routerRef.current.pathname.startsWith("/quiz")) {
      updateStatus("idle");
      setDisplayTranscript("");
      window.dispatchEvent(new CustomEvent("quiz_voice_command", { detail: finalQuery }));
      return;
    }

    if (routerRef.current.pathname.startsWith("/lessons")) {
      updateStatus("idle");
      setDisplayTranscript("");
      window.dispatchEvent(new CustomEvent("lessons_voice_command", { detail: finalQuery }));
      return;
    }

    // Otherwise, answer questions right here through the AI tutor without navigating away
    sendToAI(finalQuery);
  };

  const playWakeSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("AudioContext not supported", e);
    }
  };

  const resetRecordingTimeout = () => {
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    // Give them more time if they haven't said anything after the wake word
    const timeoutDuration = accumulatedQueryRef.current.trim().length === 0 ? 4000 : 2000;
    
    recordingTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === "recording") {
        finishRecording();
      }
    }, timeoutDuration);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (checkIsBlocked()) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (audioRef.current) audioRef.current.pause();
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech recognition not supported");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Use interim to catch wake word faster
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      if (statusRef.current === "speaking" || statusRef.current === "processing") return;

      let currentInterim = "";
      let newFinals = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newFinals += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      const text = (newFinals + " " + currentInterim).toLowerCase();
      const cleanText = text.replace(/[.,!?]/g, '');

      if (statusRef.current === "idle") {
        const customName = (tutorNameRef.current || "").toLowerCase().trim();
        let wakeList = [];
        if (customName && customName !== "tutor" && customName.length > 1) {
          wakeList = [
            `hey ${customName}`,
            `hi ${customName}`,
            `hello ${customName}`,
            `ok ${customName}`
          ];
        } else {
          wakeList = ["hey tutor", "hi tutor", "hello tutor", "ok tutor"];
        }

        let detected = null;
        for (const w of wakeList) {
          if (cleanText.includes(w)) {
            detected = w;
            break;
          }
        }

        if (detected) {
          playWakeSound();
          updateStatus("recording");
          const idx = cleanText.indexOf(detected);
          const queryPart = cleanText.substring(idx + detected.length).trim();
          accumulatedQueryRef.current = queryPart;
          setDisplayTranscript(queryPart || `Listening for ${tutorNameRef.current}...`);
          resetRecordingTimeout();
        }
      } else if (statusRef.current === "recording") {
        if (newFinals) {
          accumulatedQueryRef.current += " " + newFinals;
        }
        setDisplayTranscript(accumulatedQueryRef.current + " " + currentInterim);
        resetRecordingTimeout();
      }
    };

    recognition.onend = () => {
      if (statusRef.current === "idle" || statusRef.current === "recording") {
        try { recognition.start(); } catch(e) {}
      }
    };

    // Auto-start on mount
    try { recognition.start(); } catch(e) {}

    return () => {
      recognition.onend = null;
      try { recognition.stop(); } catch(e) {}
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [router.pathname]);

  if (checkIsBlocked()) {
    return null;
  }

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
      {displayStatus !== "idle" && (
        <div style={{ background: "rgba(0,0,0,0.8)", color: "white", padding: "12px 24px", borderRadius: "12px", fontSize: "14px", maxWidth: "300px" }}>
          {displayStatus === "recording" && <strong style={{color: "var(--green)"}}>Listening: </strong>}
          {displayStatus === "processing" && <strong style={{color: "var(--purple)"}}>Thinking... </strong>}
          {displayStatus === "speaking" && <strong style={{color: "var(--blue)"}}>Speaking: </strong>}
          <span style={{ fontStyle: "italic" }}>{displayTranscript}</span>
        </div>
      )}
      <div 
        onClick={() => {
          if (displayStatus === "idle") {
            playWakeSound();
            updateStatus("recording");
            accumulatedQueryRef.current = "";
            setDisplayTranscript("Listening...");
            resetRecordingTimeout();
          } else if (displayStatus === "recording") {
            finishRecording();
          }
        }}
        style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: displayStatus === "recording" ? "var(--green)" : 
                      displayStatus === "processing" ? "var(--dark-gray)" :
                      displayStatus === "speaking" ? "var(--blue)" : "var(--purple)",
          color: "white", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: displayStatus !== "idle" ? "0 0 20px currentColor" : "0 4px 12px rgba(0,0,0,0.2)",
          transition: "all 0.3s ease",
          animation: displayStatus !== "idle" ? "pulse 1.5s infinite" : "none",
          cursor: "pointer"
        }}
        title={`Always listening for 'Hey ${tutorNameRef.current}', or click to speak`}
      >
        {displayStatus === "idle" ? <Sparkles size={28} /> : 
         displayStatus === "processing" ? <Loader2 size={28} className="animate-spin" /> :
         displayStatus === "speaking" ? <Volume2 size={28} /> :
         <Mic size={28} />}
      </div>
    </div>
  );
}
