import DashboardLayout from "../components/DashboardLayout";
import { Send, Trash2, Loader2, Volume2, Square, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Tutor() {
  const [tutorName, setTutorName] = useState("Tutor");
  const [messages, setMessages] = useState([
    {
      role: "tutor",
      text: "Hello! I am your AI Tutor. What would you like to learn about today?",
      showListen: true
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);

  const chatEndRef = useRef(null);
  const audioRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const lastTutorTextRef = useRef("Hello! I am your AI Tutor. What would you like to learn about today?");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  useEffect(() => {
    const fetchHistoryAndProfile = async () => {
      const rawId = localStorage.getItem("student_id");
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      try {
        // Fetch active persona name
        const profileRes = await fetch(`http://localhost:8000/api/voice-profiles/${studentId}`);
        let activeName = "Tutor";
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.tutor_name) {
            activeName = profileData.tutor_name;
            setTutorName(activeName);
          }
        }

        const res = await fetch(`http://localhost:8000/api/tutor/history?student_id=${studentId}`);
        const data = await res.json();
        const welcomeMsg = activeName && activeName !== "Tutor"
          ? `Hello! I am ${activeName}, your personalized AI Tutor. What would you like to learn about today?`
          : "Hello! I am your AI Tutor. What would you like to learn about today?";

        if (data.messages && data.messages.length > 0) {
          setMessages([
            {
              role: "tutor",
              text: welcomeMsg,
              showListen: true
            },
            ...data.messages
          ]);
          const tutorMsgs = data.messages.filter(m => m.role === "tutor");
          if (tutorMsgs.length > 0) {
            lastTutorTextRef.current = tutorMsgs[tutorMsgs.length - 1].text;
          }
        } else {
          setMessages([
            {
              role: "tutor",
              text: welcomeMsg,
              showListen: true
            }
          ]);
          lastTutorTextRef.current = welcomeMsg;
        }
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    };
    fetchHistoryAndProfile();

    return () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      window.dispatchEvent(new CustomEvent("tutor_speech_end"));
    };
  }, []);

  const stopAllAudio = () => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudio(null);
    window.dispatchEvent(new CustomEvent("tutor_speech_end"));
  };

  const playTTS = async (text, index) => {
    if (!text) return;

    // Toggle stop if user clicks the button for currently playing item
    if (playingAudio === index) {
      stopAllAudio();
      return;
    }

    stopAllAudio();
    setPlayingAudio(index);
    window.dispatchEvent(new CustomEvent("tutor_speech_start"));

    try {
      const rawId = typeof window !== "undefined" ? localStorage.getItem("student_id") : null;
      const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;
      const res = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, student_id: studentId })
      });

      if (!res.ok) throw new Error(`Piper TTS failed with status ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudio(null);
        window.dispatchEvent(new CustomEvent("tutor_speech_end"));
      };

      audio.onerror = (e) => {
        console.warn("Audio playback error, falling back to Web Speech API:", e);
        fallbackWebSpeech(text, index);
      };

      await audio.play();
    } catch (error) {
      console.warn("Piper TTS network/audio failed, falling back to Web Speech API:", error);
      fallbackWebSpeech(text, index);
    }
  };

  const fallbackWebSpeech = (text, index) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setPlayingAudio(null);
      window.dispatchEvent(new CustomEvent("tutor_speech_end"));
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setPlayingAudio(null);
      window.dispatchEvent(new CustomEvent("tutor_speech_end"));
    };

    utterance.onerror = () => {
      setPlayingAudio(null);
      window.dispatchEvent(new CustomEvent("tutor_speech_end"));
    };

    setPlayingAudio(index);
    window.speechSynthesis.speak(utterance);
  };

  const processQuery = async (queryText) => {
    const trimmed = queryText.trim();
    if (!trimmed || isProcessing) return;

    // Check if the student is asking to repeat
    const isRepeat = /^\s*(repeat|repeat\s+that|repeat\s+content|repeat\s+please|can\s+you\s+repeat|say\s+again|say\s+that\s+again|speak\s+again|once\s+more|pardon)\s*[\.\?\!]?\s*$/i.test(trimmed);
    if (isRepeat) {
      stopAllAudio();
      setMessages(prev => [...prev, { role: "student", text: trimmed }]);
      if (lastTutorTextRef.current) {
        const textToRepeat = lastTutorTextRef.current;
        setMessages(prev => {
          const next = [...prev, { role: "tutor", text: textToRepeat, showListen: true }];
          const newIdx = next.length - 1;
          setTimeout(() => {
            playTTS(textToRepeat, newIdx);
          }, 400);
          return next;
        });
      } else {
        setMessages(prev => [...prev, {
          role: "tutor",
          text: "There is no previous message to repeat. Please ask me a question!",
          showListen: true
        }]);
      }
      return;
    }

    stopAllAudio();
    setMessages(prev => [...prev, { role: "student", text: trimmed }]);
    setIsProcessing(true);

    const rawId = localStorage.getItem("student_id");
    const studentId = (!rawId || rawId === "undefined" || rawId === "null") ? "00000000-0000-0000-0000-000000000002" : rawId;

    try {
      const res = await fetch("http://localhost:8000/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          question: trimmed,
          page_context: "/tutor"
        })
      });
      const data = await res.json();
      const tutorAnswer = data.answer || "I'm here to help. What would you like to explore?";
      lastTutorTextRef.current = tutorAnswer;

      setMessages(prev => {
        const next = [...prev, {
          role: "tutor",
          text: tutorAnswer,
          showListen: true
        }];
        const answerIndex = next.length - 1;

        // Take a 2-second break after text generation before speaking
        // Auto-speaks only 1 time
        speechTimeoutRef.current = setTimeout(() => {
          playTTS(tutorAnswer, answerIndex);
        }, 2000);

        return next;
      });
    } catch (error) {
      console.error("Error asking tutor:", error);
      setMessages(prev => [...prev, {
        role: "tutor",
        text: "Sorry, I could not reach the server right now. Please try again.",
        showListen: false
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleTutorQuery = (e) => {
      const query = e.detail;
      if (query) {
        processQuery(query);
      }
    };
    window.addEventListener("tutor_query", handleTutorQuery);
    return () => {
      window.removeEventListener("tutor_query", handleTutorQuery);
      stopAllAudio();
    };
  }, [isProcessing]);

  const handleSend = () => {
    if (input.trim()) {
      processQuery(input);
      setInput("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const clearChat = () => {
    stopAllAudio();
    lastTutorTextRef.current = "Hello! I am your AI Tutor. What would you like to learn about today?";
    setMessages([
      {
        role: "tutor",
        text: "Hello! I am your AI Tutor. What would you like to learn about today?",
        showListen: true
      }
    ]);
  };

  return (
    <DashboardLayout userName="Student" title="AI Tutor" subtitle="Your personal learning companion" disableAutoTTS={true}>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", maxWidth: "900px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h3 className="font-bold" style={{ margin: 0 }}>Chat</h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Ask anything about your quizzes, scores, or lessons</span>
          </div>
          <button className="btn-outline" onClick={clearChat} style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Trash2 size={14} /> Clear Chat
          </button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{msg.text}</p>
              {msg.showListen && (
                <button 
                  onClick={() => playTTS(msg.text, i)}
                  className="btn-outline" 
                  title={playingAudio === i ? "Stop speaking" : "Listen or Repeat this message"}
                  style={{ 
                    marginTop: "12px", padding: "6px 14px", fontSize: "12px", 
                    borderRadius: "99px", background: playingAudio === i ? "var(--purple-light)" : "var(--green-light)", 
                    borderColor: playingAudio === i ? "var(--purple-border)" : "var(--green-light)", 
                    color: playingAudio === i ? "var(--purple)" : "var(--green)",
                    display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {playingAudio === i ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />} 
                  {playingAudio === i ? "Stop" : "Repeat / Listen"}
                </button>
              )}
            </div>
          ))}
          {isProcessing && (
            <div className="chat-bubble tutor">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Loader2 size={16} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "white", padding: "8px 16px", borderRadius: "99px", border: '1px solid var(--border)', transition: 'all 0.2s' }}>
            <input 
              type="text" 
              placeholder={"Ask your quiz status, quiz scores, or say 'repeat'..."} 
              className="w-full"
              style={{ border: "none", outline: "none", fontSize: "15px", background: "transparent" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button 
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              style={{ background: (isProcessing || !input.trim()) ? "var(--border)" : "var(--purple)", color: "white", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: (isProcessing || !input.trim()) ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
              <Send size={16} style={{ marginLeft: "2px" }} />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
