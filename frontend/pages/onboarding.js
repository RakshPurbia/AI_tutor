import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { Mic, Headphones, CheckCircle2, User, EyeOff, Ear, Keyboard, ShieldAlert, Sparkles, AudioLines, ArrowRight, Activity, Clock, HeartHandshake, Volume2 } from "lucide-react";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [studentName, setStudentName] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const transcriptBuffer = useRef("");
  const extractionTimeout = useRef(null);
  const initialForm = {
    name: "",
    age: "",
    grade: "",
    onset_type: "congenital", // congenital or acquired
    vision_status: "", // partial_sight, color_blind, total_loss
    support_type: "vision",
    learning_mode: "mostly_audio",
    speech_speed: "normal",
  };
  const [form, setForm] = useState(initialForm);
  const formRef = useRef(initialForm);
  
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

  useEffect(() => {
    setStudentName(localStorage.getItem("student_name") || "");
    formRef.current = { ...formRef.current, name: localStorage.getItem("student_name") || "" };
    setForm(formRef.current);
  }, []);

  const startOnboarding = useCallback(() => {
    setHasStarted(true);
    setIsListening(true);
    speak("Hi, I am your AI Tutor. I can hear you. Let's set up your learning experience. Say next to continue.");
  }, [speak]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasStarted) {
        startOnboarding();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [hasStarted, startOnboarding]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // API: Browser Web Speech API is still used here for Speech-to-Text (Whisper is planned next phase)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    recognition.onresult = async (event) => {
      const current = event.resultIndex;
      const resultText = event.results[current][0].transcript.toLowerCase();
      setTranscript(resultText);
      transcriptBuffer.current += " " + resultText;
      
      let updates = {};

      // Keyword matching for options
      if (step === 2) {
        let updates = {};
        
        // Age parsing
        const ageMatch = resultText.match(/(?:age is|i am) (\d+)/) || resultText.match(/\b([1-9][0-9]?)\b/);
        if (ageMatch && parseInt(ageMatch[1]) > 5 && parseInt(ageMatch[1]) < 30) updates.age = ageMatch[1];
        
        // Grade parsing
        const gradeMatch = resultText.match(/(?:class|grade) (\d+)/) || resultText.match(/(?:in) (\d+)/) || (resultText.includes("12th") ? ["", "12"] : null) || (resultText.includes("11th") ? ["", "11"] : null) || (resultText.includes("10th") ? ["", "10"] : null);
        if (gradeMatch && parseInt(gradeMatch[1]) > 0 && parseInt(gradeMatch[1]) <= 12) updates.grade = gradeMatch[1] + (gradeMatch[1] === "1" ? "st" : gradeMatch[1] === "2" ? "nd" : gradeMatch[1] === "3" ? "rd" : "th");
        
        // Name parsing
        const cleanText = resultText.replace(/[.,!?]/g, '');
        const nameMatch = cleanText.match(/name is (\w+)/) || cleanText.match(/i am (\w+)/);
        if (nameMatch && isNaN(nameMatch[1])) {
            updates.name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
        } else if (cleanText.split(' ').length <= 2 && !cleanText.match(/\d/)) {
            updates.name = cleanText.trim().charAt(0).toUpperCase() + cleanText.trim().slice(1);
        }
        
        if (Object.keys(updates).length > 0) {
            formRef.current = { ...formRef.current, ...updates };
            setForm(formRef.current);
        }
      } else if (step === 3) {
        if (resultText.includes("first") || resultText.includes("birth") || resultText.includes("congenital")) {
          update("onset_type", "congenital");
        } else if (resultText.includes("second") || resultText.includes("acquired") || resultText.includes("later")) {
          update("onset_type", "acquired");
        }
      } else if (step === 3.5) {
        if (resultText.includes("first") || resultText.includes("partial")) update("vision_status", "partial_sight");
        else if (resultText.includes("second") || resultText.includes("color")) update("vision_status", "color_blind");
        else if (resultText.includes("third") || resultText.includes("total") || resultText.includes("no vision")) update("vision_status", "total_loss");
      } else if (step === 4) {
        if (resultText.includes("first") || resultText.includes("mostly audio")) update("learning_mode", "mostly_audio");
        else if (resultText.includes("second") || resultText.includes("conversation")) update("learning_mode", "voice");
        else if (resultText.includes("third") || resultText.includes("audio") && resultText.includes("text")) update("learning_mode", "audio_text");
        else if (resultText.includes("fourth") || resultText.includes("ai")) update("learning_mode", "ai");
      } else if (step === 5) {
        if (resultText.includes("first") || resultText.includes("vision")) update("support_type", "vision");
        else if (resultText.includes("second") || resultText.includes("audio")) update("support_type", "audio");
        else if (resultText.includes("third") || resultText.includes("text") || resultText.includes("keyboard")) update("support_type", "text");
        else if (resultText.includes("fourth") || resultText.includes("other")) update("support_type", "other");
        else if (resultText.includes("fifth") || resultText.includes("none") || resultText.includes("no specific")) update("support_type", "none");
      }

      if (resultText.includes("next") || resultText.includes("continue") || resultText.includes("yes") || resultText.includes("start") || resultText.includes("let's go")) {
        handleNext();
        return;
      }

      // Debounce the extraction call
      if (extractionTimeout.current) clearTimeout(extractionTimeout.current);
      
      extractionTimeout.current = setTimeout(async () => {
        if (step >= 2 && step <= 5) {
          try {
            console.log("Sending to backend for parsing:", transcriptBuffer.current);
            const res = await fetch("http://localhost:8000/api/parse_voice_data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: transcriptBuffer.current, step: step === 3.5 ? 3 : step })
            });
            if (res.ok) {
              const extracted = await res.json();
              console.log("Extracted data:", extracted);
              if (extracted && Object.keys(extracted).length > 0) {
                formRef.current = { ...formRef.current, ...extracted };
                setForm(formRef.current);
              }
            } else {
              console.error("Failed to parse voice data", await res.text());
            }
          } catch (e) {
            console.error("Parse voice data error:", e);
          }
        }
      }, 1500); // Wait 1.5s after they stop speaking to process
    };
    
    recognition.onend = () => {
      if (isListening) recognition.start();
    };

    if (isListening) recognition.start();
    else recognition.stop();

    return () => {
      recognition.stop();
      if (extractionTimeout.current) clearTimeout(extractionTimeout.current);
    };
  }, [isListening, step]);

  // Clear buffer on step change
  useEffect(() => {
    transcriptBuffer.current = "";
  }, [step]);

  const update = (key, value) => {
    formRef.current = { ...formRef.current, [key]: value };
    setForm(formRef.current);
  };

  const [isGeneratingDiagnostic, setIsGeneratingDiagnostic] = useState(false);

  const handleNext = async () => {
    const currentForm = formRef.current;
    if (step === 2) {
      if (!currentForm.name) {
        speak("Please tell me your name.");
        return;
      }
      if (!currentForm.age) {
        speak("Please tell me your age.");
        return;
      }
      if (!currentForm.grade) {
        speak("Please tell me which class you are in.");
        return;
      }
    }

    if (step === 3 && currentForm.onset_type === "acquired") {
      setStep(3.5);
      speak("Can you tell me how it happened, and if you can still see light, have partial vision, or are color blind?");
      return;
    }
    if (step === 3.5) {
      setStep(4);
      speak("How would you like to learn? Mostly audio, or let AI decide?");
      return;
    }
    
    if (step === 6) {
      setIsGeneratingDiagnostic(true);
      try {
        const studentId = localStorage.getItem("student_id") || "00000000-0000-0000-0000-000000000002"; // dummy id
        await fetch("http://localhost:8000/api/onboarding/diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, grade: currentForm.grade || "12th Grade" })
        });
      } catch (e) {
        console.error(e);
      }
      setIsGeneratingDiagnostic(false);
      setStep(7);
      speak("Your personalized plan is ready! Say let's go to start learning.");
      return;
    }

    if (step < 7) {
      const nextStep = step + 1;
      setStep(nextStep);
      
      // Voice prompts for next steps
      if (nextStep === 2) speak("What is your name, age, and which class are you in?");
      if (nextStep === 3) speak("Is your visual impairment from birth, or acquired later?");
      if (nextStep === 4) speak("How would you like to learn? Mostly audio, or let AI decide?");
      if (nextStep === 5) speak("How can I support you better in learning? Select vision, audio, or text.");
      if (nextStep === 6) speak("I will ask you a few questions to understand your level. Ready?");
    } else {
      router.push("/profile");
    }
  };

  const TopProgress = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--green-light)", color: "var(--green)", padding: "8px 16px", borderRadius: "99px", fontWeight: "bold", fontSize: "14px" }}>
          <Headphones size={18} /> ALWAYS LISTENING
        </div>
        <span className="text-sm text-muted">The app understands your voice.</span>
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{ width: "40px", height: "6px", borderRadius: "3px", background: step >= i ? "var(--purple)" : "var(--border)", transition: "background 0.3s" }}></div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "white", padding: "40px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1e1b4b", textAlign: "center", marginBottom: "40px" }}>
          Student Interaction Flow <span style={{ color: "var(--purple)" }}>– Voice-First & Always Listening</span> <AudioLines size={28} className="text-purple" style={{ verticalAlign: "middle" }} />
        </h1>

        <TopProgress />

        <div style={{ display: "flex", gap: "32px", justifyContent: "center", minHeight: "600px", alignItems: "stretch" }}>
          
          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="onboarding-card welcome-card">
              <div className="step-badge">1</div>
              <h2 className="step-title" style={{ color: "white" }}>Welcome</h2>
              
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div className="avatar-glow">
                  <Headphones size={64} color="#a5b4fc" />
                </div>
                
                <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>Hi! I'm your AI Tutor.</h3>
                <p style={{ fontSize: "16px", color: "#c7d2fe", textAlign: "center", maxWidth: "250px", lineHeight: "1.5" }}>
                  I can hear you. Let's set up your learning experience.
                </p>
              </div>

              <div className="listening-bar">
                <span>I'm listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 2: About You */}
          {step === 2 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">2</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Profile</h2>
                </div>
                <span className="text-sm text-muted">Step 1 of 6</span>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Chat Flow */}
                <div className="chat-msg ai">What's your name?</div>
                <div className="chat-msg user"><User size={16} /> <input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Type name..." className="invisible-input" /></div>
                
                <div className="chat-msg ai" style={{ animationDelay: "0.5s" }}>What is your age?</div>
                <div className="chat-msg user" style={{ animationDelay: "0.7s" }}><User size={16} /> <input value={form.age} onChange={e => update("age", e.target.value)} placeholder="Type age..." className="invisible-input" type="number" /></div>
                
                <div className="chat-msg ai" style={{ animationDelay: "1s" }}>Which class are you in?</div>
                <div className="chat-msg user" style={{ animationDelay: "1.2s" }}><User size={16} /> <input value={form.grade} onChange={e => update("grade", e.target.value)} placeholder="Type class..." className="invisible-input" /></div>
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 3: Condition History */}
          {step === 3 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">3</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Condition History</h2>
                </div>
                <span className="text-sm text-muted">Step 2 of 6</span>
              </div>

              <p className="chat-msg ai mb-6">Is your visual impairment from birth, or was it acquired later?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {[
                  { id: "congenital", icon: <Sparkles size={20} />, title: "From Birth", desc: "(Congenital)" },
                  { id: "acquired", icon: <Activity size={20} />, title: "Acquired Later", desc: "(Due to accident or illness)" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.onset_type === opt.id ? 'active' : ''}`}
                    onClick={() => update("onset_type", opt.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <div>
                        <span style={{ fontWeight: "bold", display: "block" }}>{opt.title}</span>
                        <span className="text-sm text-muted">{opt.desc}</span>
                      </div>
                    </div>
                    {form.onset_type === opt.id && <CheckCircle2 size={24} className="text-purple" />}
                  </div>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 3.5: Visual Details */}
          {step === 3.5 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">3.5</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Visual Details</h2>
                </div>
                <span className="text-sm text-muted">Step 2.5 of 6</span>
              </div>

              <p className="chat-msg ai mb-6">Can you tell me how it happened, and if you can still see light, have partial vision, or are color blind?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {[
                  { id: "partial_sight", icon: <EyeOff size={20} />, title: "Partial Sight", desc: "(Can see some shapes or light)" },
                  { id: "color_blind", icon: <EyeOff size={20} />, title: "Color Blind", desc: "(Difficulty distinguishing colors)" },
                  { id: "total_loss", icon: <EyeOff size={20} />, title: "Total Loss", desc: "(No vision)" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.vision_status === opt.id ? 'active' : ''}`}
                    onClick={() => update("vision_status", opt.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <div>
                        <span style={{ fontWeight: "bold", display: "block" }}>{opt.title}</span>
                        <span className="text-sm text-muted">{opt.desc}</span>
                      </div>
                    </div>
                    {form.vision_status === opt.id && <CheckCircle2 size={24} className="text-purple" />}
                  </div>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 5: Accessibility */}
          {step === 5 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">5</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Accessibility Preferences</h2>
                </div>
                <span className="text-sm text-muted">Step 4 of 6</span>
              </div>

              <p className="chat-msg ai mb-6">How can I support you better in learning?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {[
                  { id: "vision", icon: <EyeOff size={20} />, title: "Vision Support", desc: "(I have difficulty seeing)" },
                  { id: "audio", icon: <Ear size={20} />, title: "Audio Learning", desc: "(I learn better by listening)" },
                  { id: "text", icon: <Keyboard size={20} />, title: "Text / Keyboard", desc: "(I prefer reading & typing)" },
                  { id: "other", icon: <ShieldAlert size={20} />, title: "Other Support", desc: "(I need different support)" },
                  { id: "none", icon: <CheckCircle2 size={20} />, title: "No specific support needed", desc: "" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.support_type === opt.id ? 'active' : ''}`}
                    onClick={() => update("support_type", opt.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <div>
                        <span style={{ fontWeight: "bold", display: "block" }}>{opt.title}</span>
                        {opt.desc && <span className="text-sm text-muted">{opt.desc}</span>}
                      </div>
                    </div>
                    {form.support_type === opt.id && <CheckCircle2 size={24} className="text-purple" />}
                  </div>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 4: Personalize */}
          {step === 4 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">4</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Learning Style</h2>
                </div>
                <span className="text-sm text-muted">Step 3 of 6</span>
              </div>

              <p className="chat-msg ai mb-6">How would you like to learn?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                {[
                  { id: "mostly_audio", icon: <Volume2 size={20} />, title: "Mostly Audio" },
                  { id: "voice", icon: <Mic size={20} />, title: "Voice Conversation" },
                  { id: "audio_text", icon: <Volume2 size={20} />, title: "Audio + Text" },
                  { id: "ai", icon: <Sparkles size={20} />, title: "Let AI decide" }
                ].map(opt => (
                  <div key={opt.id} className={`select-btn ${form.learning_mode === opt.id ? 'active' : ''}`} onClick={() => update("learning_mode", opt.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <span style={{ fontWeight: "bold" }}>{opt.title}</span>
                    </div>
                    {form.learning_mode === opt.id && <CheckCircle2 size={24} className="text-purple" />}
                  </div>
                ))}
              </div>

              <p className="font-bold mb-4">How should I speak?</p>
              <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                {['Slow', 'Normal', 'Fast'].map(speed => (
                  <button 
                    key={speed}
                    onClick={() => update("speech_speed", speed.toLowerCase())}
                    className={`pill-btn ${form.speech_speed === speed.toLowerCase() ? 'active' : ''}`}
                  >
                    {speed}
                  </button>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 6: Assessment */}
          {step === 6 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">6</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Baseline Assessment</h2>
                </div>
                <span className="text-sm text-muted">Step 5 of 6</span>
              </div>

              <p className="chat-msg ai text-center mx-auto mb-12">I will ask you a few questions to understand your level.</p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "32px" }}>
                <div className="sound-wave-large">
                  {/* CSS visualizer */}
                  {[1,2,3,4,5,6,5,4,3,2,1].map((h, i) => (
                    <div key={i} className="bar" style={{ height: `${h * 15}px`, animationDelay: `${i*0.1}s` }}></div>
                  ))}
                </div>
                
                <div style={{ width: "80px", height: "80px", borderRadius: "24px", background: "var(--purple)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 25px rgba(91,79,224,0.4)" }}>
                  <Headphones size={40} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "24px 0", borderTop: "1px solid var(--border)" }}>
                <div className="feature-stat"><Activity size={24} className="text-purple mb-2" /> <span>5-10<br/>Questions</span></div>
                <div className="feature-stat"><Clock size={24} className="text-purple mb-2" /> <span>~5<br/>Minutes</span></div>
                <div className="feature-stat"><HeartHandshake size={24} className="text-purple mb-2" /> <span>No Right<br/>or Wrong</span></div>
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}

          {/* STEP 7: Profile */}
          {step === 7 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">7</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Learning Goals & Personalized Plan</h2>
                </div>
                <span className="text-sm text-muted">Step 6 of 6</span>
              </div>

              <p className="chat-msg ai text-center mx-auto mb-8">Your personalized plan is ready!</p>

              <div style={{ background: "white", borderRadius: "20px", padding: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid var(--border)", flex: 1 }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#fef08a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>🧑🏽</div>
                  <div>
                    <h3 style={{ fontSize: "20px", fontWeight: "bold" }}>{form.name || "Student"}</h3>
                    <p className="text-muted">{form.grade || "7th Grade"} - Science</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div className="profile-row">
                    <Headphones size={20} className="text-purple" />
                    <div>
                      <span className="label">Learning Mode:</span>
                      <span className="value">Voice-First (Audio)</span>
                    </div>
                  </div>
                  <div className="profile-row">
                    <EyeOff size={20} className="text-purple" />
                    <div>
                      <span className="label">Support:</span>
                      <span className="value">Audio Descriptions</span>
                    </div>
                  </div>
                  <div className="profile-row">
                    <Activity size={20} className="text-purple" />
                    <div>
                      <span className="label">Condition Onset:</span>
                      <span className="value">{form.onset_type === 'congenital' ? "From Birth" : "Acquired Later"}</span>
                    </div>
                  </div>
                  {form.onset_type === 'acquired' && form.vision_status && (
                    <div className="profile-row">
                      <EyeOff size={20} className="text-purple" />
                      <div>
                        <span className="label">Vision Status:</span>
                        <span className="value">
                          {form.vision_status === 'partial_sight' ? "Partial Sight" : 
                           form.vision_status === 'color_blind' ? "Color Blind" : "Total Loss"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="profile-row">
                    <Sparkles size={20} className="text-purple" />
                    <div>
                      <span className="label">Focus Areas:</span>
                      <span className="value">Human Biology, Ear Anatomy</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="listening-bar purple-bar mt-auto">
                <span>Listening...</span>
                <AudioLines size={24} />
              </div>
            </div>
          )}
          
          <div style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
            <button 
              onClick={handleNext}
              style={{ width: "48px", height: "48px", borderRadius: "50%", background: "white", color: "var(--purple)", border: "1px solid var(--purple-light)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(91,79,224,0.1)", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <ArrowRight size={24} />
            </button>
          </div>

        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          .onboarding-card {
            width: 400px;
            background: white;
            border: 1px solid var(--purple-light);
            border-radius: 32px;
            padding: 32px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 50px rgba(91,79,224,0.08);
            position: relative;
            overflow: hidden;
            animation: slideIn 0.5s ease-out;
          }

          .welcome-card {
            background: linear-gradient(180deg, #1e1b4b 0%, #0d0b1a 100%);
            color: white;
            border: none;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          }

          .step-badge {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--purple);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
          }

          .step-title {
            font-size: 22px;
            font-weight: bold;
            color: #1e1b4b;
          }

          .avatar-glow {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(91,79,224,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 40px rgba(91,79,224,0.6);
            margin-bottom: 32px;
            animation: pulse-glow 3s infinite alternate;
          }

          .listening-bar {
            background: rgba(255,255,255,0.1);
            border-radius: 99px;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: white;
            font-weight: 500;
            margin-top: auto;
          }
          
          .purple-bar {
            background: var(--purple);
            box-shadow: 0 10px 20px rgba(91,79,224,0.3);
          }

          .chat-msg {
            padding: 16px 24px;
            border-radius: 20px;
            font-size: 15px;
            line-height: 1.5;
            max-width: 85%;
            animation: fadeIn 0.4s ease-out forwards;
            opacity: 0;
            transform: translateY(10px);
          }

          .chat-msg.ai {
            background: var(--bg);
            color: var(--text-main);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            border: 1px solid var(--purple-light);
          }

          .chat-msg.user {
            background: var(--purple-light);
            color: var(--purple-dark);
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 600;
          }

          .invisible-input {
            border: none;
            background: transparent;
            font-weight: 600;
            color: var(--purple-dark);
            width: 100px;
            outline: none;
          }
          .invisible-input::placeholder { color: rgba(91,79,224,0.4); }

          .select-btn {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-radius: 16px;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.2s;
            background: white;
          }
          .select-btn:hover { border-color: var(--purple-light); background: var(--bg); }
          .select-btn.active {
            border-color: var(--purple);
            background: var(--purple-light);
            color: var(--purple-dark);
          }
          .icon-wrapper { color: var(--text-muted); }
          .select-btn.active .icon-wrapper { color: var(--purple); }

          .pill-btn {
            flex: 1;
            padding: 12px;
            border-radius: 99px;
            border: 1px solid var(--border);
            background: white;
            font-weight: 600;
            cursor: pointer;
            color: var(--text-main);
            transition: all 0.2s;
          }
          .pill-btn.active { background: var(--purple-light); color: var(--purple); border-color: var(--purple); }

          .sound-wave-large {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 100px;
          }
          .sound-wave-large .bar {
            width: 8px;
            background: var(--purple-light);
            border-radius: 4px;
            animation: wave 1.2s infinite ease-in-out alternate;
          }

          .feature-stat {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
          }

          .profile-row {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }
          .profile-row .label { display: block; font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px; }
          .profile-row .value { display: block; font-size: 15px; color: var(--text-main); font-weight: 600; }

          @keyframes pulse-glow {
            from { box-shadow: 0 0 20px rgba(91,79,224,0.4); }
            to { box-shadow: 0 0 60px rgba(91,79,224,0.8); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeIn {
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes wave {
            0% { transform: scaleY(0.2); background: var(--purple-light); }
            100% { transform: scaleY(1); background: var(--purple); }
          }
        `}} />
      </div>
    </div>
  );
}
