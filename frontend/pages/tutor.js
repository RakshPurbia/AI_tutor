import DashboardLayout from "../components/DashboardLayout";
import { Send, Trash2, Loader2, Volume2, Square } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Tutor() {
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const processQuery = async (queryText) => {
    if (!queryText.trim() || isProcessing) return;
    
    setMessages(prev => [...prev, { role: "student", text: queryText }]);
    setIsProcessing(true);
    
    const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002";

    try {
      const res = await fetch("http://localhost:8000/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          question: queryText,
          page_context: "/tutor"
        })
      });
      const data = await res.json();
      
      let audioIndex = -1;
      setMessages(prev => {
        audioIndex = prev.length;
        return [...prev, { 
          role: "tutor", 
          text: data.answer,
          showListen: true
        }];
      });
      if (audioIndex !== -1) {
        playTTS(data.answer, audioIndex);
      }
    } catch (error) {
      console.error("Error asking tutor:", error);
      setMessages(prev => [...prev, { 
        role: "tutor", 
        text: "Sorry, I could not reach the server right now.",
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
      if (audioRef.current) audioRef.current.pause();
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

  const playTTS = async (text, index) => {
    if (playingAudio === index && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudio(null);
      return;
    }
    
    setPlayingAudio(index);
    if (audioRef.current) audioRef.current.pause();

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
        setPlayingAudio(null);
      };
      
      audio.play();
    } catch (error) {
      console.error("Error playing TTS:", error);
      setPlayingAudio(null);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "tutor",
        text: "Hello! I am your AI Tutor. What would you like to learn about today?",
        showListen: true
      }
    ]);
  };

  return (
    <DashboardLayout userName="Student" title="AI Tutor" subtitle="Your personal learning companion">
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", maxWidth: "900px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="font-bold">Chat</h3>
          <button className="btn-outline" onClick={clearChat} style={{ padding: "6px 12px", fontSize: "13px" }}>
            <Trash2 size={14} /> Clear Chat
          </button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <p>{msg.text}</p>
              {msg.showListen && (
                <button 
                  onClick={() => playTTS(msg.text, i)}
                  className="btn-outline" 
                  style={{ 
                    marginTop: "12px", padding: "6px 12px", fontSize: "12px", 
                    borderRadius: "99px", background: "var(--green-light)", 
                    borderColor: "var(--green-light)", color: "var(--green)",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}
                >
                  {playingAudio === i ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />} 
                  {playingAudio === i ? "Stop" : "Listen"}
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
              placeholder={"Type your question or say 'Hey Tutor'..."} 
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
