import DashboardLayout from "../components/DashboardLayout";
import { Mic, Send, Trash2 } from "lucide-react";
import { useState } from "react";

export default function Tutor() {
  const [messages, setMessages] = useState([
    {
      role: "tutor",
      text: "Hello! I am your AI Tutor. What would you like to learn about today?"
    },
    {
      role: "student",
      text: "Explain photosynthesis in simple words."
    },
    {
      role: "tutor",
      text: "Photosynthesis is the process used by green plants to make their own food. They take sunlight, water, and carbon dioxide and turn it into food (glucose) and oxygen. This food gives energy to the plant, and oxygen is released into the air.",
      showListen: true
    },
    {
      role: "student",
      text: "Explain with a diagram."
    }
  ]);
  const [input, setInput] = useState("");

  return (
    <DashboardLayout userName="Ananya" title="AI Tutor" subtitle="Your personal learning companion">
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", maxWidth: "900px", margin: "0 auto", background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="font-bold">Chat</h3>
          <button className="btn-outline" style={{ padding: "6px 12px", fontSize: "13px" }}>
            <Trash2 size={14} /> Clear Chat
          </button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              <p>{msg.text}</p>
              {msg.showListen && (
                <button className="btn-outline" style={{ marginTop: "12px", padding: "6px 12px", fontSize: "12px", borderRadius: "99px", background: "var(--green-light)", borderColor: "var(--green-light)", color: "var(--green)" }}>
                  🔊 Listen
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "white", padding: "8px 16px", borderRadius: "99px", border: "1px solid var(--border)" }}>
            <input 
              type="text" 
              placeholder="Ask anything..." 
              className="w-full"
              style={{ border: "none", outline: "none", fontSize: "15px", background: "transparent" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button style={{ background: "transparent", border: "none", color: "var(--purple)", cursor: "pointer" }}>
              <Mic size={20} />
            </button>
            <button style={{ background: "var(--purple)", color: "white", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Send size={16} />
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
