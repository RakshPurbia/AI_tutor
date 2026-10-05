import { Mic, X, Square, Loader2, Volume2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

export default function VoiceAssistant({ onClose, studentId }) {
  const router = useRouter();
  const [status, setStatus] = useState("listening"); // 'listening', 'processing', 'speaking', 'idle'
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [tutorName, setTutorName] = useState("Tutor");

  useEffect(() => {
    if (studentId) {
      fetch(`http://localhost:8000/api/profile/${studentId}`)
        .then(res => res.json())
        .then(data => {
          if (data.tutor_name) {
            setTutorName(data.tutor_name);
          }
        })
        .catch(console.error);
    }
  }, [studentId]);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const statusRef = useRef("listening");
  const transcriptRef = useRef("");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== "no-speech") setStatus("idle");
      };

      recognitionRef.current.onend = () => {
        const finalTranscript = transcriptRef.current;
        if (statusRef.current === "listening" && finalTranscript.trim().length > 0) {
          handleVoiceInput(finalTranscript);
        } else if (statusRef.current === "listening") {
          // Keep listening if nothing was heard
          try { recognitionRef.current.start(); } catch (e) { }
        }
      };

      if (statusRef.current === "listening") {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setTranscript("Speech recognition not supported in this browser.");
      setStatus("error");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // prevent loops on unmount
        recognitionRef.current.stop();
      }
      if (audioRef.current) audioRef.current.pause();
    };
  }, []); // Run once on mount

  const handleVoiceInput = (text) => {
    handleAskTutor(text);
  };

  const handleAskTutor = async (text) => {
    setStatus("processing");
    try {
      const res = await fetch("http://localhost:8000/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId || "00000000-0000-0000-0000-000000000002", // Default to Aarav if not provided
          question: text
        })
      });
      const data = await res.json();
      setResponse(data.answer);

      if (data.navigation_action) {
        const dest = data.navigation_action.split("_")[1].toLowerCase();
        setTimeout(() => {
          router.push(`/${dest}`);
          onClose();
        }, 1500);
      }

      playTTS(data.answer);
    } catch (error) {
      console.error("Error asking tutor:", error);
      setResponse("Sorry, I could not reach the server.");
      setStatus("idle");
    }
  };

  const playTTS = async (text) => {
    setStatus("speaking");
    try {
      const res = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus("listening");
        setTranscript("");
        setResponse("");
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) { }
        }
      };

      audio.play();
    } catch (error) {
      console.error("Error playing TTS:", error);
      setStatus("idle");
    }
  };

  const toggleListening = () => {
    if (status === "listening") {
      if (recognitionRef.current) recognitionRef.current.stop();
      setStatus("idle");
    } else if (status === "idle") {
      setTranscript("");
      setResponse("");
      setStatus("listening");
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { }
      }
    } else if (status === "speaking" && audioRef.current) {
      audioRef.current.pause();
      setStatus("idle");
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(10, 10, 20, 0.95)", zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: "32px", right: "32px", background: "transparent", border: "none", color: "white", cursor: "pointer" }}>
        <X size={32} />
      </button>

      <h2 style={{ color: "white", fontSize: "24px", fontWeight: "bold", marginBottom: "48px" }}>Voice Assistant</h2>

      <p style={{ color: "var(--text-muted)", fontSize: "16px", marginBottom: "32px", minHeight: "24px" }}>
        {status === "listening" && "Listening..."}
        {status === "processing" && "Thinking..."}
        {status === "speaking" && "Speaking..."}
        {status === "idle" && "Paused"}
      </p>

      {/* Wave animation simulation */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "120px", marginBottom: "48px" }}>
        <div style={{ width: "4px", height: "20%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "40%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1.2s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "80%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 0.8s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "100%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1.5s infinite alternate" : "none" }}></div>

        {/* Main Icon Button */}
        <div
          onClick={toggleListening}
          style={{
            margin: "0 24px", width: "96px", height: "96px",
            background: status === "processing" ? "var(--dark-gray)" : "var(--purple)",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", cursor: "pointer",
            boxShadow: status === "processing" ? "none" : "0 0 32px var(--purple)",
            transition: "all 0.3s ease"
          }}>
          {status === "processing" ? <Loader2 size={40} className="animate-spin" style={{ animation: "spin 2s linear infinite" }} /> :
            status === "speaking" ? <Volume2 size={40} /> :
              <Mic size={40} />}
        </div>

        <div style={{ width: "4px", height: "100%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1.1s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "80%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 0.9s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "40%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1.3s infinite alternate" : "none" }}></div>
        <div style={{ width: "4px", height: "20%", background: "var(--purple)", borderRadius: "2px", animation: status === "listening" || status === "speaking" ? "pulse 1s infinite alternate" : "none" }}></div>
      </div>

      <div style={{ maxWidth: "600px", textAlign: "center", minHeight: "100px", padding: "0 20px" }}>
        {transcript && <p style={{ color: "white", fontSize: "18px", fontStyle: "italic", marginBottom: "16px" }}>"{transcript}"</p>}
        {response && <p style={{ color: "var(--purple)", fontSize: "18px", fontWeight: "500", lineHeight: "1.5" }}>{response}</p>}
        {!transcript && !response && <p style={{ color: "white", fontSize: "16px" }}>Try saying "Hey {tutorName}..."</p>}
      </div>

      <button
        className="btn-outline"
        onClick={onClose}
        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", marginTop: "32px" }}
      >
        <Square size={16} fill="white" /> Close Assistant
      </button>

    </div>
  );
}
