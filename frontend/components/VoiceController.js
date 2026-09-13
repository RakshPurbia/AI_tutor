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

  const router = useRouter();
  useEffect(() => { routerRef.current = router; }, [router]);

  const updateStatus = (newStatus) => {
    statusRef.current = newStatus;
    setDisplayStatus(newStatus);
  };

  const playTTS = async (text, onComplete) => {
    updateStatus("speaking");
    if (audioRef.current) audioRef.current.pause();
    
    // temporarily stop recognition so it doesn't hear itself
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
    }

    try {
      const res = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
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

  const sendToAI = async (query) => {
    updateStatus("processing");
    try {
      const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";
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
      playTTS(data.answer);
    } catch (err) {
      console.error("AI fetch failed:", err);
      playTTS("Sorry, I could not reach the server right now.");
    }
  };

  const finishRecording = () => {
    const finalQuery = accumulatedQueryRef.current.trim();
    accumulatedQueryRef.current = "";
    
    if (finalQuery.length > 0) {
      const lower = finalQuery.toLowerCase();
      // Navigation commands
      if (lower.includes("go to dashboard") || lower.includes("open dashboard") || lower.includes("home")) {
          playTTS("Going to dashboard.");
          routerRef.current.push("/dashboard");
          return;
      }
      if (lower.includes("go to quiz") || lower.includes("open quiz") || lower.includes("quizzes")) {
          playTTS("Opening quizzes.");
          routerRef.current.push("/quizzes");
          return;
      }
      if (lower.includes("go to profile") || lower.includes("open profile")) {
          playTTS("Opening profile.");
          routerRef.current.push("/profile");
          return;
      }
      if (lower.includes("go to tutor") || lower.includes("open tutor") || lower.includes("ai tutor")) {
          playTTS("Opening AI Tutor.");
          routerRef.current.push("/tutor");
          return;
      }

      // If we are already on the tutor page, let the tutor page handle it natively!
      if (routerRef.current.pathname === "/tutor") {
          updateStatus("idle");
          setDisplayTranscript("");
          window.dispatchEvent(new CustomEvent("tutor_query", { detail: finalQuery }));
          return;
      }

      // Otherwise send to AI via global popup
      sendToAI(finalQuery);
    } else {
      updateStatus("idle");
      setDisplayTranscript("");
    }
  };

  const resetRecordingTimeout = () => {
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    // If no speech for 1.5 seconds while recording, assume they are done
    recordingTimeoutRef.current = setTimeout(() => {
      if (statusRef.current === "recording") {
        finishRecording();
      }
    }, 1500);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    
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

      if (statusRef.current === "idle") {
        if (text.includes("hey tutor")) {
          updateStatus("recording");
          // Extract anything said after "hey tutor"
          const idx = text.indexOf("hey tutor");
          const queryPart = text.substring(idx + 9).trim();
          accumulatedQueryRef.current = queryPart;
          setDisplayTranscript(queryPart || "Listening...");
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
  }, []);

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
        style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: displayStatus === "recording" ? "var(--green)" : 
                      displayStatus === "processing" ? "var(--dark-gray)" :
                      displayStatus === "speaking" ? "var(--blue)" : "var(--purple)",
          color: "white", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: displayStatus !== "idle" ? "0 0 20px currentColor" : "0 4px 12px rgba(0,0,0,0.2)",
          transition: "all 0.3s ease",
          animation: displayStatus !== "idle" ? "pulse 1.5s infinite" : "none"
        }}
        title="Always listening for 'Hey Tutor'"
      >
        {displayStatus === "idle" ? <Sparkles size={28} /> : 
         displayStatus === "processing" ? <Loader2 size={28} className="animate-spin" /> :
         displayStatus === "speaking" ? <Volume2 size={28} /> :
         <Mic size={28} />}
      </div>
    </div>
  );
}
