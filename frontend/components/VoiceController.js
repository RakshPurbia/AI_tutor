import { useEffect, useState, useCallback, useRef } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useRouter } from "next/router";

export default function VoiceController() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const router = useRouter();
  const audioRef = useRef(null);

  const speak = useCallback(async (text) => {
    // API: Piper TTS is used here for Text-to-Speech (instead of browser native synthesis)
    if (audioRef.current) {
      audioRef.current.pause();
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
        audio.play();
      }
    } catch (err) {
      console.error("Piper TTS failed:", err);
    }
  }, []);

  const handleCommand = useCallback((command) => {
    const cmd = command.toLowerCase();
    
    if (cmd.includes("go to quizzes") || cmd.includes("open quizzes")) {
      speak("Going to quizzes.");
      router.push("/quizzes");
    } else if (cmd.includes("go to dashboard") || cmd.includes("home")) {
      speak("Going to dashboard.");
      router.push("/dashboard");
    } else if (cmd.includes("start quiz")) {
      speak("Starting quiz.");
      // If we are on dashboard, just find the first quiz. For demo, we just route to /quizzes
      router.push("/quizzes");
    } else if (cmd.includes("read lesson") || cmd.includes("read text")) {
      // Find text on screen and read it
      const headings = Array.from(document.querySelectorAll("h1, h2, h3, p")).map(el => el.innerText).join(". ");
      speak(`Reading page content. ${headings}`);
    } else if (cmd.includes("stop") || cmd.includes("quiet")) {
      if (audioRef.current) audioRef.current.pause();
    } else {
      speak("I heard you say: " + command + ". You can say 'go to dashboard', 'go to quizzes', or 'read lesson'.");
    }
  }, [router, speak]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // API: Browser Web Speech API is still used here for Speech-to-Text (Whisper is planned next phase)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const resultText = event.results[current][0].transcript;
      setTranscript(resultText);
      handleCommand(resultText);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start(); // auto restart if it stops unexpectedly while active
      }
    };

    if (isListening) {
      recognition.start();
      speak("Voice assistant listening. Say a command.");
    } else {
      recognition.stop();
    }

    return () => {
      recognition.stop();
    };
  }, [isListening, handleCommand, speak]);

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
      {transcript && (
        <div style={{ background: "rgba(0,0,0,0.8)", color: "white", padding: "12px 24px", borderRadius: "12px", fontSize: "14px", maxWidth: "250px" }}>
          You said: "{transcript}"
        </div>
      )}
      <button 
        onClick={toggleListening}
        style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: isListening ? "var(--red)" : "var(--purple)",
          color: "white", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer",
          animation: isListening ? "pulse 1.5s infinite" : "none"
        }}
      >
        {isListening ? <Mic size={28} /> : <MicOff size={28} />}
      </button>
    </div>
  );
}
