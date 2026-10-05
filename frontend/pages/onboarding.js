import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { 
  Mic, MicOff, Headphones, CheckCircle2, User, EyeOff, Ear, Keyboard, 
  ShieldAlert, Sparkles, AudioLines, ArrowRight, ArrowLeft, Activity, 
  Clock, HeartHandshake, Volume2, AlertTriangle 
} from "lucide-react";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isGeneratingDiagnostic, setIsGeneratingDiagnostic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialForm = {
    name: "",
    age: "",
    grade: "",
    onset_type: "congenital", // congenital or acquired
    vision_status: "partial_sight", // partial_sight, color_blind, total_loss
    support_type: "vision", // vision, audio, text, other, none
    learning_mode: "mostly_audio", // mostly_audio, voice, audio_text, ai
    speech_speed: "normal", // slow, normal, fast
  };

  const [form, setForm] = useState(initialForm);
  const formRef = useRef(initialForm);
  const stepRef = useRef(1);
  const isListeningRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const micPermissionDeniedRef = useRef(false);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const transcriptBuffer = useRef("");
  const extractionTimeout = useRef(null);
  const isDestroyedRef = useRef(false);
  const hasSpokenWelcomeRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    micPermissionDeniedRef.current = micPermissionDenied;
  }, [micPermissionDenied]);

  // Load existing student name if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("student_name") || "";
      if (storedName) {
        setForm(prev => {
          const updated = { ...prev, name: storedName };
          formRef.current = updated;
          return updated;
        });
      }
    }
  }, []);

  const update = (key, value) => {
    formRef.current = { ...formRef.current, [key]: value };
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Text-To-Speech with Piper TTS + native SpeechSynthesis fallback
  const speak = useCallback((text, onComplete) => {
    if (typeof window === "undefined") return;

    if (audioRef.current) {
      try { audioRef.current.pause(); } catch(e){}
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch(e){}
    }

    setIsSpeaking(true);
    isSpeakingRef.current = true;

    const playFallback = (fallbackText, cb) => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(fallbackText);
        const speed = formRef.current.speech_speed;
        utterance.rate = speed === "slow" ? 0.85 : speed === "fast" ? 1.25 : 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          if (cb) cb();
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          if (cb) cb();
        };

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        if (cb) cb();
      }
    };

    const tryPiper = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch("http://localhost:8000/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            if (onComplete) onComplete();
          };

          audio.onerror = () => {
            playFallback(text, onComplete);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              playFallback(text, onComplete);
            });
          }
          return true;
        }
      } catch (err) {
        // Fallback below
      }
      return false;
    };

    tryPiper().then((success) => {
      if (!success) {
        playFallback(text, onComplete);
      }
    });
  }, []);

  // Spoken voice prompts per step
  const speakStepPrompt = useCallback((stepNum) => {
    const s = stepNum !== undefined ? stepNum : stepRef.current;
    if (s === 1) {
      speak("Hi, I am your AI Tutor. I can hear you. Let's set up your learning experience.", () => {
        if (stepRef.current === 1) {
          handleNext();
        }
      });
    } else if (s === 2) {
      speak("Please tell me your name, age, and class. For example, say: My name is Alex, I am 15, in 10th grade.");
    } else if (s === 3) {
      speak("Is your visual impairment from birth, or acquired later? Say birth for option 1, or acquired later for option 2.");
    } else if (s === 3.5) {
      speak("Can you tell me your visual status? Say partial sight for option 1, color blind for option 2, or total loss for option 3.");
    } else if (s === 4) {
      speak("How would you like to learn? Say mostly audio for option 1, voice conversation for option 2, audio and text for option 3, or let AI decide for option 4. You can also say slow, normal, or fast speed.");
    } else if (s === 5) {
      speak("How can I support you better? Say vision support, audio learning, text keyboard, other, or none.");
    } else if (s === 6) {
      speak("I will prepare a brief baseline assessment to understand your level. Say ready or next to start.");
    } else if (s === 7) {
      speak("Your personalized learning plan is ready! Say let's go or start learning to finish.");
    }
  }, [speak]);

  // Navigate to next step
  const handleNext = useCallback(async () => {
    const curStep = stepRef.current;
    const curForm = formRef.current;

    if (curStep === 1) {
      setStep(2);
      speakStepPrompt(2);
      return;
    }

    if (curStep === 2) {
      if (!curForm.name) {
        speak("Please tell me your name first.");
        return;
      }
      if (!curForm.age) {
        speak("Please tell me your age.");
        return;
      }
      if (!curForm.grade) {
        speak("Please tell me which class you are in.");
        return;
      }
      setStep(3);
      speakStepPrompt(3);
      return;
    }

    if (curStep === 3) {
      if (curForm.onset_type === "acquired") {
        setStep(3.5);
        speakStepPrompt(3.5);
        return;
      } else {
        setStep(4);
        speakStepPrompt(4);
        return;
      }
    }

    if (curStep === 3.5) {
      setStep(4);
      speakStepPrompt(4);
      return;
    }

    if (curStep === 4) {
      setStep(5);
      speakStepPrompt(5);
      return;
    }

    if (curStep === 5) {
      setStep(6);
      speakStepPrompt(6);
      return;
    }

    if (curStep === 6) {
      setIsGeneratingDiagnostic(true);
      speak("Generating your diagnostic assessment, please wait a moment.");
      try {
        const studentName = curForm.name || "Student";
        const payload = {
          name: studentName,
          age: parseInt(curForm.age) || 16,
          grade: curForm.grade || "10th Grade",
          preferred_language: "English",
          support_type: curForm.support_type || "vision",
          onset_type: curForm.onset_type || "congenital",
          residual_vision: curForm.vision_status === "total_loss" ? "none" : "low_vision",
          learning_mode: curForm.learning_mode || "mostly_audio",
          speech_speed: curForm.speech_speed || "normal",
          color_blind: curForm.vision_status === "color_blind"
        };

        const res = await fetch("http://localhost:8000/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        let newStudentId = "00000000-0000-0000-0000-000000000002";
        if (res.ok) {
          const data = await res.json();
          if (typeof window !== "undefined") {
            if (data.user_id) {
              newStudentId = data.user_id;
              localStorage.setItem("student_id", newStudentId);
            }
            localStorage.setItem("student_name", studentName);
            localStorage.setItem("user_name", studentName);
            localStorage.setItem("user_role", "student");
          }
        }

        await fetch("http://localhost:8000/api/onboarding/diagnostic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: newStudentId, grade: curForm.grade || "10th Grade" })
        });
      } catch (e) {
        console.warn("Diagnostic notice:", e);
      }
      setIsGeneratingDiagnostic(false);
      setStep(7);
      speakStepPrompt(7);
      return;
    }

    if (curStep === 7) {
      setIsSubmitting(true);
      speak("Your setup is complete! Welcome to AI Tutor.", () => {
        router.push("/dashboard");
      });
    }
  }, [speak, speakStepPrompt, router]);

  // Navigate back
  const handleBack = useCallback(() => {
    const curStep = stepRef.current;
    if (curStep === 1) return;

    if (curStep === 3.5) {
      setStep(3);
      speakStepPrompt(3);
      return;
    }

    if (curStep === 4) {
      if (formRef.current.onset_type === "acquired") {
        setStep(3.5);
        speakStepPrompt(3.5);
      } else {
        setStep(3);
        speakStepPrompt(3);
      }
      return;
    }

    const prevStep = curStep - 1;
    setStep(prevStep);
    speakStepPrompt(prevStep);
  }, [speakStepPrompt]);

  // Process voice input and select options / fill fields
  const processVoiceInput = useCallback((rawText) => {
    const text = rawText.toLowerCase().trim();
    if (!text) return;

    const curStep = stepRef.current;

    // 1. Navigation Commands
    if (
      text.includes("next") || 
      text.includes("continue") || 
      text.includes("proceed") || 
      text.includes("go next") || 
      text.includes("let's go") || 
      (curStep === 1 && (text.includes("start") || text.includes("begin") || text.includes("yes"))) ||
      (curStep === 6 && (text.includes("start") || text.includes("ready") || text.includes("yes") || text.includes("ok"))) ||
      (curStep === 7 && (text.includes("finish") || text.includes("done") || text.includes("start learning")))
    ) {
      handleNext();
      return;
    }

    if (text.includes("back") || text.includes("previous") || text.includes("go back")) {
      handleBack();
      return;
    }

    if (text.includes("repeat") || text.includes("say again") || text.includes("what did you say") || text.includes("help") || text.includes("read options")) {
      speakStepPrompt(curStep);
      return;
    }

    // 2. Step 2: Name, Age, Grade
    if (curStep === 2) {
      let updates = {};
      let spokeField = null;

      // Age
      const ageDigitMatch = text.match(/\b(?:age\s+is\s+|i\s+am\s+|i\'m\s+)?([1-9][0-9]?)\b(?:\s+years?\s+old)?/);
      if (ageDigitMatch) {
        const val = parseInt(ageDigitMatch[1]);
        if (val >= 5 && val <= 80) {
          updates.age = String(val);
          spokeField = `Age ${val}`;
        }
      }
      if (!updates.age) {
        const spokenNumbers = {
          "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
          "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14", "fifteen": "15",
          "sixteen": "16", "seventeen": "17", "eighteen": "18", "nineteen": "19", "twenty": "20"
        };
        for (const [w, n] of Object.entries(spokenNumbers)) {
          if (text.includes(w)) {
            updates.age = n;
            spokeField = `Age ${n}`;
            break;
          }
        }
      }

      // Grade
      const gradeDigitMatch = text.match(/\b(?:class|grade|standard)\s*(\d{1,2})(?:st|nd|rd|th)?\b/) || text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|class|standard)?\b/);
      if (gradeDigitMatch) {
        const gNum = gradeDigitMatch[1];
        const sfx = gNum === "1" ? "st" : gNum === "2" ? "nd" : gNum === "3" ? "rd" : "th";
        updates.grade = `${gNum}${sfx} Grade`;
        spokeField = `${gNum}${sfx} Grade`;
      } else {
        const wordGrades = {
          "first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th", "fifth": "5th",
          "sixth": "6th", "seventh": "7th", "eighth": "8th", "ninth": "9th", "tenth": "10th",
          "eleventh": "11th", "twelfth": "12th"
        };
        for (const [wg, wgs] of Object.entries(wordGrades)) {
          if (text.includes(`${wg} grade`) || text.includes(`grade ${wg}`) || text.includes(`class ${wg}`)) {
            updates.grade = `${wgs} Grade`;
            spokeField = `${wgs} Grade`;
            break;
          }
        }
      }

      // Name
      const nameMatch = rawText.match(/\b(?:my\s+name\s+is|name\s+is|i\s+am|call\s+me)\s+([A-Za-z]+)/i);
      if (nameMatch) {
        const candidate = nameMatch[1].trim();
        const forbidden = ["a", "in", "the", "from", "and", "class", "grade", "years", "old", "at", "student", "my", "name", "an"];
        if (!forbidden.includes(candidate.toLowerCase()) && isNaN(candidate)) {
          updates.name = candidate.charAt(0).toUpperCase() + candidate.slice(1);
          spokeField = `Name ${updates.name}`;
        }
      } else if (!formRef.current.name && text.split(" ").length <= 3 && !text.match(/\d/)) {
        const words = rawText.split(" ").filter(w => !["hello", "hi", "tutor", "yes", "no", "next", "start", "please", "ok", "hey"].includes(w.toLowerCase()));
        if (words.length > 0) {
          const joinedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          updates.name = joinedName;
          spokeField = `Name ${joinedName}`;
        }
      }

      if (Object.keys(updates).length > 0) {
        formRef.current = { ...formRef.current, ...updates };
        setForm(prev => ({ ...prev, ...updates }));
        if (spokeField) {
          if (formRef.current.name && formRef.current.age && formRef.current.grade) {
            speak(`Got it! ${spokeField}. All details captured.`, () => handleNext());
          } else {
            speak(`Got it! ${spokeField}.`);
          }
        }
      }
    }

    // 3. Step 3: Condition History
    else if (curStep === 3) {
      if (
        text.includes("birth") || text.includes("born") || text.includes("congenital") || 
        text.includes("option 1") || text.includes("option one") || text.includes("first option") || 
        text === "first" || text === "one" || text === "1"
      ) {
        update("onset_type", "congenital");
        speak("Selected From Birth.", () => handleNext());
      } else if (
        text.includes("later") || text.includes("acquired") || text.includes("accident") || text.includes("illness") || 
        text.includes("option 2") || text.includes("option two") || text.includes("second option") || 
        text === "second" || text === "two" || text === "2"
      ) {
        update("onset_type", "acquired");
        speak("Selected Acquired Later.", () => handleNext());
      }
    }

    // 4. Step 3.5: Visual Details
    else if (curStep === 3.5) {
      if (
        text.includes("partial") || text.includes("light") || text.includes("shapes") || text.includes("some vision") || 
        text.includes("option 1") || text.includes("first") || text === "1" || text === "one"
      ) {
        update("vision_status", "partial_sight");
        speak("Selected Partial Sight.", () => handleNext());
      } else if (
        text.includes("color") || text.includes("colors") || text.includes("color blind") || text.includes("colorblind") || 
        text.includes("option 2") || text.includes("second") || text === "2" || text === "two"
      ) {
        update("vision_status", "color_blind");
        speak("Selected Color Blind.", () => handleNext());
      } else if (
        text.includes("total") || text.includes("blind") || text.includes("completely") || text.includes("no vision") || 
        text.includes("total loss") || text.includes("option 3") || text.includes("third") || text === "3" || text === "three"
      ) {
        update("vision_status", "total_loss");
        speak("Selected Total Loss of vision.", () => handleNext());
      }
    }

    // 5. Step 4: Learning Style & Speed
    else if (curStep === 4) {
      let modeSet = false;
      if (
        text.includes("mostly audio") || text.includes("audio only") || text.includes("sound only") || 
        text.includes("option 1") || text.includes("first option") || text === "1" || text === "one"
      ) {
        update("learning_mode", "mostly_audio");
        speak("Selected Mostly Audio learning.", () => handleNext());
        modeSet = true;
      } else if (
        text.includes("voice") || text.includes("conversation") || text.includes("speaking") || text.includes("talk") || 
        text.includes("option 2") || text.includes("second option") || text === "2" || text === "two"
      ) {
        update("learning_mode", "voice");
        speak("Selected Voice Conversation mode.", () => handleNext());
        modeSet = true;
      } else if (
        text.includes("both") || text.includes("audio and text") || text.includes("audio plus text") || text.includes("text and audio") || 
        text.includes("option 3") || text.includes("third option") || text === "3" || text === "three"
      ) {
        update("learning_mode", "audio_text");
        speak("Selected Audio plus Text mode.", () => handleNext());
        modeSet = true;
      } else if (
        text.includes("ai") || text.includes("let ai decide") || text.includes("you decide") || 
        text.includes("option 4") || text.includes("fourth option") || text === "4" || text === "four"
      ) {
        update("learning_mode", "ai");
        speak("Selected Let AI Decide.", () => handleNext());
        modeSet = true;
      }

      // Speed
      if (text.includes("slow") || text.includes("slowly") || text.includes("slower")) {
        update("speech_speed", "slow");
        speak("Speech speed set to Slow.");
      } else if (text.includes("normal") || text.includes("medium") || text.includes("regular")) {
        update("speech_speed", "normal");
        speak("Speech speed set to Normal.");
      } else if (text.includes("fast") || text.includes("faster") || text.includes("quick")) {
        update("speech_speed", "fast");
        speak("Speech speed set to Fast.");
      }
    }

    // 6. Step 5: Support Type
    else if (curStep === 5) {
      if (
        text.includes("vision") || text.includes("seeing") || text.includes("sight") || 
        text.includes("option 1") || text.includes("first option") || text === "1" || text === "one"
      ) {
        update("support_type", "vision");
        speak("Selected Vision Support.", () => handleNext());
      } else if (
        text.includes("audio") || text.includes("listening") || text.includes("hear") || text.includes("ears") || 
        text.includes("option 2") || text.includes("second option") || text === "2" || text === "two"
      ) {
        update("support_type", "audio");
        speak("Selected Audio Learning.", () => handleNext());
      } else if (
        text.includes("text") || text.includes("keyboard") || text.includes("typing") || 
        text.includes("option 3") || text.includes("third option") || text === "3" || text === "three"
      ) {
        update("support_type", "text");
        speak("Selected Text and Keyboard support.", () => handleNext());
      } else if (
        text.includes("other") || text.includes("different") || 
        text.includes("option 4") || text.includes("fourth option") || text === "4" || text === "four"
      ) {
        update("support_type", "other");
        speak("Selected Other Support.", () => handleNext());
      } else if (
        text.includes("none") || text.includes("no support") || text.includes("nothing") || text.includes("no specific") || 
        text.includes("option 5") || text.includes("fifth option") || text === "5" || text === "five"
      ) {
        update("support_type", "none");
        speak("Selected No specific support needed.", () => handleNext());
      }
    }
  }, [handleNext, handleBack, speak, speakStepPrompt]);

  // Automatic Always-Listening Engine
  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e){}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setMicPermissionDenied(false);
    };

    recognition.onresult = (event) => {
      if (isSpeakingRef.current) return;

      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += part + " ";
        } else {
          interim += part;
        }
      }

      const spoken = (finalChunk || interim).trim();
      if (spoken) {
        setLiveTranscript(spoken);
        transcriptBuffer.current += " " + spoken;
      }

      if (finalChunk.trim().length > 0) {
        processVoiceInput(finalChunk.trim());
      } else if (interim.trim().length > 0 && (
        interim.toLowerCase().includes("next") || 
        interim.toLowerCase().includes("back") || 
        interim.toLowerCase().includes("option")
      )) {
        processVoiceInput(interim.trim());
      }

      // Debounce server extraction
      if (extractionTimeout.current) clearTimeout(extractionTimeout.current);
      extractionTimeout.current = setTimeout(async () => {
        const curStep = stepRef.current;
        if (curStep >= 2 && curStep <= 5 && transcriptBuffer.current.trim()) {
          try {
            const res = await fetch("http://localhost:8000/api/parse_voice_data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                transcript: transcriptBuffer.current, 
                step: curStep 
              })
            });
            if (res.ok) {
              const extracted = await res.json();
              if (extracted && Object.keys(extracted).length > 0) {
                formRef.current = { ...formRef.current, ...extracted };
                setForm(prev => ({ ...prev, ...extracted }));
                
                // Auto-advance if fully extracted
                const form = formRef.current;
                if (curStep === 2 && form.name && form.age && form.grade) {
                  speak(`Got it! Name is ${form.name}.`, () => handleNext());
                } else if (curStep === 3 && form.onset_type) {
                  speak("Selected.", () => handleNext());
                } else if (curStep === 3.5 && form.vision_status) {
                  speak("Selected.", () => handleNext());
                } else if (curStep === 4 && form.learning_mode && form.speech_speed !== "normal") {
                  speak("Selected.", () => handleNext());
                } else if (curStep === 5 && form.support_type) {
                  speak("Selected.", () => handleNext());
                }
              }
            }
          } catch (e) {}
        }
      }, 1000);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setMicPermissionDenied(true);
        setIsListening(false);
        isListeningRef.current = false;
      } else if (event.error === "no-speech") {
        // Natural silence - will auto-restart
      }
    };

    recognition.onend = () => {
      if (isDestroyedRef.current) return;
      if (isListeningRef.current && !micPermissionDeniedRef.current) {
        setTimeout(() => {
          try {
            if (isListeningRef.current && !isDestroyedRef.current) {
              recognition.start();
            }
          } catch (e) {}
        }, 150);
      }
    };

    try {
      recognition.start();
    } catch (e) {}
  }, [processVoiceInput]);

  // AUTO-ENABLE on mount: immediately start listening & play welcome prompt
  useEffect(() => {
    isDestroyedRef.current = false;
    isListeningRef.current = true;
    setIsListening(true);

    // Auto-start microphone immediately
    startRecognition();

    // Auto-play welcome prompt immediately
    const timer = setTimeout(() => {
      if (!hasSpokenWelcomeRef.current) {
        hasSpokenWelcomeRef.current = true;
        speakStepPrompt(1);
      }
    }, 400);

    // Global unlock for audio autoplay policy on any user gesture
    const unlockAudio = () => {
      if (!hasSpokenWelcomeRef.current) {
        hasSpokenWelcomeRef.current = true;
        speakStepPrompt(stepRef.current);
      }
      try {
        if (!isListeningRef.current) {
          isListeningRef.current = true;
          setIsListening(true);
          startRecognition();
        }
      } catch(e){}
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      isDestroyedRef.current = true;
      clearTimeout(timer);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e){}
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch(e){}
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch(e){}
      }
      if (extractionTimeout.current) clearTimeout(extractionTimeout.current);
    };
  }, [startRecognition, speakStepPrompt]);

  // Clear live buffer on step change
  useEffect(() => {
    transcriptBuffer.current = "";
    setLiveTranscript("");
  }, [step]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleBack();
      } else if (e.key === " ") {
        e.preventDefault();
        if (isListening) {
          setIsListening(false);
          isListeningRef.current = false;
          recognitionRef.current?.stop();
        } else {
          setIsListening(true);
          isListeningRef.current = true;
          startRecognition();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handleBack, isListening, startRecognition]);

  // Top Progress Bar Component
  const TopProgress = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          onClick={() => {
            if (isListening) {
              setIsListening(false);
              isListeningRef.current = false;
              recognitionRef.current?.stop();
            } else {
              setIsListening(true);
              isListeningRef.current = true;
              startRecognition();
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: micPermissionDenied ? "#fee2e2" : isListening ? "var(--green-light)" : "#f3f4f6",
            color: micPermissionDenied ? "#dc2626" : isListening ? "var(--green)" : "#6b7280",
            border: "1px solid " + (micPermissionDenied ? "#fca5a5" : isListening ? "var(--green)" : "#d1d5db"),
            padding: "8px 16px",
            borderRadius: "99px",
            fontWeight: "bold",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          title="Click to toggle microphone"
        >
          {micPermissionDenied ? (
            <><MicOff size={18} /> MIC BLOCKED</>
          ) : isListening ? (
            <><Headphones size={18} className="pulse-icon" /> ALWAYS LISTENING</>
          ) : (
            <><MicOff size={18} /> MIC MUTED - CLICK TO LISTEN</>
          )}
        </button>
        <span className="text-sm text-muted">
          {isSpeaking ? "Tutor is speaking..." : isListening ? "Listening for your voice (speak anytime or say 'Next')" : "Microphone paused"}
        </span>
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div 
            key={i} 
            style={{ 
              width: "40px", 
              height: "6px", 
              borderRadius: "3px", 
              background: step >= i ? "var(--purple)" : "var(--border)", 
              transition: "background 0.3s" 
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "white", padding: "40px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1e1b4b", textAlign: "center", marginBottom: "32px" }}>
          Student Interaction Flow <span style={{ color: "var(--purple)" }}>– Voice-First & Always Listening</span> <AudioLines size={28} className="text-purple" style={{ verticalAlign: "middle" }} />
        </h1>

        {micPermissionDenied && (
          <div style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#b91c1c", borderRadius: "16px", padding: "16px 20px", marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <AlertTriangle size={24} />
              <div>
                <strong>Microphone Permission Blocked:</strong> Please allow microphone access in your browser address bar to use voice commands.
              </div>
            </div>
            <button 
              onClick={() => { setMicPermissionDenied(false); setIsListening(true); isListeningRef.current = true; startRecognition(); }}
              style={{ background: "#dc2626", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
            >
              Retry Mic
            </button>
          </div>
        )}

        <TopProgress />

        <div style={{ display: "flex", gap: "24px", justifyContent: "center", minHeight: "620px", alignItems: "stretch" }}>
          
          {/* Back Navigation Button */}
          {step > 1 && (
            <div style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
              <button 
                onClick={handleBack}
                title="Go back (or say 'Back')"
                style={{ 
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "50%", 
                  background: "white", 
                  color: "#4b5563", 
                  border: "1px solid var(--border)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  cursor: "pointer", 
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)", 
                  transition: "all 0.2s" 
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <ArrowLeft size={24} />
              </button>
            </div>
          )}

          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="onboarding-card welcome-card">
              <div className="step-badge">1</div>
              <h2 className="step-title" style={{ color: "white" }}>Welcome</h2>
              
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div className="avatar-glow">
                  <Headphones size={64} color="#a5b4fc" />
                </div>
                
                <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px", textAlign: "center" }}>
                  Hi! I'm your AI Tutor.
                </h3>
                <p style={{ fontSize: "16px", color: "#c7d2fe", textAlign: "center", maxWidth: "290px", lineHeight: "1.5", marginBottom: "24px" }}>
                  I can hear you. Let's set up your personalized voice learning experience.
                </p>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button
                    onClick={() => speakStepPrompt(1)}
                    className="repeat-audio-btn"
                    title="Replay tutor audio"
                  >
                    <Volume2 size={18} /> Replay Audio
                  </button>
                  <button
                    onClick={handleNext}
                    className="next-step-btn"
                    title="Continue to next step"
                  >
                    Next <ArrowRight size={18} />
                  </button>
                </div>
              </div>

              <div className="listening-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} color="#a5b4fc" className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Listening... Say 'Next' or click arrow"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening || isSpeaking ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 2: Profile (Name, Age, Grade) */}
          {step === 2 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">2</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Profile Details</h2>
                </div>
                <span className="text-sm text-muted">Step 1 of 5</span>
              </div>

              <p className="text-sm text-muted" style={{ marginBottom: "16px" }}>
                Speak naturally (e.g. <em>“My name is Alex, age 15, class 10”</em>) or type into the fields.
              </p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Name */}
                <div>
                  <div className="chat-msg ai" style={{ marginBottom: "8px" }}>What is your name?</div>
                  <div className="chat-msg user">
                    <User size={16} /> 
                    <input 
                      value={form.name} 
                      onChange={e => update("name", e.target.value)} 
                      placeholder="Type or speak name..." 
                      className="invisible-input" 
                    />
                  </div>
                </div>
                
                {/* Age */}
                <div>
                  <div className="chat-msg ai" style={{ marginBottom: "8px" }}>What is your age?</div>
                  <div className="chat-msg user">
                    <User size={16} /> 
                    <input 
                      value={form.age} 
                      onChange={e => update("age", e.target.value)} 
                      placeholder="Type or speak age..." 
                      className="invisible-input" 
                      type="number" 
                    />
                  </div>
                </div>
                
                {/* Grade */}
                <div>
                  <div className="chat-msg ai" style={{ marginBottom: "8px" }}>Which class are you in?</div>
                  <div className="chat-msg user">
                    <User size={16} /> 
                    <input 
                      value={form.grade} 
                      onChange={e => update("grade", e.target.value)} 
                      placeholder="e.g. 10th Grade..." 
                      className="invisible-input" 
                    />
                  </div>
                </div>
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Listening... Speak name, age, class"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 3: Condition History */}
          {step === 3 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">3</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Condition History</h2>
                </div>
                <span className="text-sm text-muted">Step 2 of 5</span>
              </div>

              <p className="chat-msg ai mb-6">
                Is your visual impairment from birth, or was it acquired later?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                {[
                  { id: "congenital", num: "1", icon: <Sparkles size={20} />, title: "From Birth", desc: "(Congenital) – Say 'Option 1' or 'Birth'" },
                  { id: "acquired", num: "2", icon: <Activity size={20} />, title: "Acquired Later", desc: "(Accident or illness) – Say 'Option 2' or 'Later'" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.onset_type === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      update("onset_type", opt.id);
                      speak(`Selected ${opt.title}. Say next to continue.`);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="option-num-badge">{opt.num}</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Birth' or 'Acquired Later'"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 3.5: Visual Details */}
          {step === 3.5 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">3.5</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Visual Details</h2>
                </div>
                <span className="text-sm text-muted">Step 2.5 of 5</span>
              </div>

              <p className="chat-msg ai mb-6">
                Tell me if you have partial vision, are color blind, or have total vision loss.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {[
                  { id: "partial_sight", num: "1", icon: <EyeOff size={20} />, title: "Partial Sight", desc: "Can see light or shapes (Say 'Option 1')" },
                  { id: "color_blind", num: "2", icon: <EyeOff size={20} />, title: "Color Blind", desc: "Difficulty seeing colors (Say 'Option 2')" },
                  { id: "total_loss", num: "3", icon: <EyeOff size={20} />, title: "Total Loss", desc: "No vision (Say 'Option 3')" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.vision_status === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      update("vision_status", opt.id);
                      speak(`Selected ${opt.title}. Say next to continue.`);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="option-num-badge">{opt.num}</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Option 1', '2', or '3'"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 4: Learning Style */}
          {step === 4 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">4</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Learning Style</h2>
                </div>
                <span className="text-sm text-muted">Step 3 of 5</span>
              </div>

              <p className="chat-msg ai mb-4">How would you like to learn?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {[
                  { id: "mostly_audio", num: "1", icon: <Volume2 size={20} />, title: "Mostly Audio" },
                  { id: "voice", num: "2", icon: <Mic size={20} />, title: "Voice Conversation" },
                  { id: "audio_text", num: "3", icon: <Volume2 size={20} />, title: "Audio + Text" },
                  { id: "ai", num: "4", icon: <Sparkles size={20} />, title: "Let AI decide" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.learning_mode === opt.id ? 'active' : ''}`} 
                    onClick={() => {
                      update("learning_mode", opt.id);
                      speak(`Selected ${opt.title}.`);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="option-num-badge">{opt.num}</span>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <span style={{ fontWeight: "bold" }}>{opt.title}</span>
                    </div>
                    {form.learning_mode === opt.id && <CheckCircle2 size={22} className="text-purple" />}
                  </div>
                ))}
              </div>

              <p className="font-bold mb-2 text-sm">How should I speak?</p>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                {['Slow', 'Normal', 'Fast'].map(speed => (
                  <button 
                    key={speed}
                    onClick={() => {
                      update("speech_speed", speed.toLowerCase());
                      speak(`Speech speed set to ${speed}.`);
                    }}
                    className={`pill-btn ${form.speech_speed === speed.toLowerCase() ? 'active' : ''}`}
                  >
                    {speed}
                  </button>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Mostly audio', 'Voice', or speed"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 5: Accessibility Preferences */}
          {step === 5 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">5</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Accessibility Support</h2>
                </div>
                <span className="text-sm text-muted">Step 4 of 5</span>
              </div>

              <p className="chat-msg ai mb-4">How can I support you better in learning?</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                {[
                  { id: "vision", num: "1", icon: <EyeOff size={18} />, title: "Vision Support", desc: "(Detailed voice descriptions)" },
                  { id: "audio", num: "2", icon: <Ear size={18} />, title: "Audio Learning", desc: "(Pure audio lessons & quizzes)" },
                  { id: "text", num: "3", icon: <Keyboard size={18} />, title: "Text / Keyboard", desc: "(Reading & typing support)" },
                  { id: "other", num: "4", icon: <ShieldAlert size={18} />, title: "Other Support", desc: "(Specialized assistance)" },
                  { id: "none", num: "5", icon: <CheckCircle2 size={18} />, title: "No Specific Support", desc: "" }
                ].map(opt => (
                  <div 
                    key={opt.id} 
                    className={`select-btn ${form.support_type === opt.id ? 'active' : ''}`}
                    onClick={() => {
                      update("support_type", opt.id);
                      speak(`Selected ${opt.title}. Say next to continue.`);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span className="option-num-badge">{opt.num}</span>
                      <div className="icon-wrapper">{opt.icon}</div>
                      <div>
                        <span style={{ fontWeight: "bold", display: "block", fontSize: "14px" }}>{opt.title}</span>
                        {opt.desc && <span className="text-xs text-muted">{opt.desc}</span>}
                      </div>
                    </div>
                    {form.support_type === opt.id && <CheckCircle2 size={22} className="text-purple" />}
                  </div>
                ))}
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Vision', 'Audio', or 'Option 1-5'"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 6: Baseline Assessment */}
          {step === 6 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">6</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Baseline Assessment</h2>
                </div>
                <span className="text-sm text-muted">Step 5 of 5</span>
              </div>

              <p className="chat-msg ai text-center mx-auto mb-8">
                I will prepare a brief baseline assessment to tailor lessons to your exact grade and pace.
              </p>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
                <div className="sound-wave-large">
                  {[1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((h, i) => (
                    <div key={i} className="bar" style={{ height: `${h * 15}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                
                <div style={{ width: "80px", height: "80px", borderRadius: "24px", background: "var(--purple)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 25px rgba(91,79,224,0.4)" }}>
                  <Headphones size={40} />
                </div>

                {isGeneratingDiagnostic && (
                  <p style={{ color: "var(--purple)", fontWeight: "bold", fontSize: "15px", animation: "pulse 1.5s infinite" }}>
                    Generating diagnostic questions...
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 0", borderTop: "1px solid var(--border)" }}>
                <div className="feature-stat"><Activity size={22} className="text-purple mb-1" /> <span>5-10<br/>Questions</span></div>
                <div className="feature-stat"><Clock size={22} className="text-purple mb-1" /> <span>~5<br/>Minutes</span></div>
                <div className="feature-stat"><HeartHandshake size={22} className="text-purple mb-1" /> <span>No Right<br/>or Wrong</span></div>
              </div>

              <div className="listening-bar purple-bar mt-auto">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Ready' or 'Next' to generate"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}

          {/* STEP 7: Personalized Plan */}
          {step === 7 && (
            <div className="onboarding-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="step-badge">7</div>
                  <h2 className="step-title" style={{ marginBottom: 0 }}>Personalized Plan</h2>
                </div>
                <span className="text-sm text-muted">Complete</span>
              </div>

              <p className="chat-msg ai text-center mx-auto mb-6">
                Your personalized learning profile is ready!
              </p>

              <div style={{ background: "white", borderRadius: "20px", padding: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid var(--border)", flex: 1, overflowY: "auto" }}>
                
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fef08a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                    🧑🏽
                  </div>
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: "bold" }}>{form.name || "Student"}</h3>
                    <p className="text-muted text-sm">{form.grade || "10th Grade"} {form.age ? `• Age ${form.age}` : ""}</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="profile-row">
                    <Headphones size={18} className="text-purple" />
                    <div>
                      <span className="label">Learning Mode:</span>
                      <span className="value">
                        {form.learning_mode === 'voice' ? "Voice Conversation" : 
                         form.learning_mode === 'audio_text' ? "Audio + Text" : 
                         form.learning_mode === 'ai' ? "AI Adaptive" : "Mostly Audio"}
                      </span>
                    </div>
                  </div>
                  <div className="profile-row">
                    <EyeOff size={18} className="text-purple" />
                    <div>
                      <span className="label">Support Type:</span>
                      <span className="value">
                        {form.support_type === 'vision' ? "Vision Descriptions" : 
                         form.support_type === 'audio' ? "Audio Lessons" : 
                         form.support_type === 'text' ? "Text & Keyboard" : 
                         form.support_type === 'none' ? "Standard Support" : "Custom Support"}
                      </span>
                    </div>
                  </div>
                  <div className="profile-row">
                    <Activity size={18} className="text-purple" />
                    <div>
                      <span className="label">Condition Onset:</span>
                      <span className="value">{form.onset_type === 'congenital' ? "From Birth (Congenital)" : "Acquired Later"}</span>
                    </div>
                  </div>
                  {form.onset_type === 'acquired' && (
                    <div className="profile-row">
                      <EyeOff size={18} className="text-purple" />
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
                    <Sparkles size={18} className="text-purple" />
                    <div>
                      <span className="label">Speech Speed:</span>
                      <span className="value">{form.speech_speed.charAt(0).toUpperCase() + form.speech_speed.slice(1)}</span>
                    </div>
                  </div>
                </div>

              </div>

              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="next-step-btn"
                style={{ marginTop: "16px", width: "100%", justifyContent: "center" }}
              >
                {isSubmitting ? "Saving Profile..." : "Start Learning Now →"}
              </button>

              <div className="listening-bar purple-bar mt-auto">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                  <Mic size={18} className={isListening ? "pulse-icon" : ""} />
                  <span style={{ fontSize: "14px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {isSpeaking ? "AI Tutor Speaking..." : liveTranscript ? `“${liveTranscript}”` : "Say 'Start learning' or 'Let's go'"}
                  </span>
                </div>
                <AudioLines size={24} className={isListening ? "pulse-icon" : ""} />
              </div>
            </div>
          )}
          
          {/* Forward Navigation Button */}
          <div style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
            <button 
              onClick={handleNext}
              title="Go to next step (or say 'Next')"
              style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "50%", 
                background: "white", 
                color: "var(--purple)", 
                border: "1px solid var(--purple-light)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                cursor: "pointer", 
                boxShadow: "0 4px 12px rgba(91,79,224,0.15)", 
                transition: "all 0.2s" 
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <ArrowRight size={24} />
            </button>
          </div>

        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          .onboarding-card {
            width: 440px;
            background: white;
            border: 1px solid var(--purple-light);
            border-radius: 32px;
            padding: 28px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 50px rgba(91,79,224,0.08);
            position: relative;
            overflow: hidden;
            animation: slideIn 0.4s ease-out;
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
            font-size: 14px;
          }

          .option-num-badge {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: #f3f4f6;
            color: #4b5563;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .select-btn.active .option-num-badge {
            background: var(--purple);
            color: white;
          }

          .next-step-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: #6366f1;
            color: white;
            font-size: 15px;
            font-weight: 700;
            padding: 12px 24px;
            border-radius: 99px;
            border: none;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(99,102,241,0.4);
            transition: all 0.2s ease;
          }
          .next-step-btn:hover {
            background: #4f46e5;
            transform: translateY(-2px);
          }

          .repeat-audio-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: rgba(255,255,255,0.15);
            color: white;
            font-size: 14px;
            font-weight: 600;
            padding: 12px 20px;
            border-radius: 99px;
            border: 1px solid rgba(255,255,255,0.3);
            cursor: pointer;
            transition: all 0.2s;
          }
          .repeat-audio-btn:hover {
            background: rgba(255,255,255,0.25);
          }

          .step-title {
            font-size: 20px;
            font-weight: bold;
            color: #1e1b4b;
          }

          .avatar-glow {
            width: 110px;
            height: 110px;
            border-radius: 50%;
            background: rgba(91,79,224,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 40px rgba(91,79,224,0.6);
            margin-bottom: 24px;
            animation: pulse-glow 3s infinite alternate;
          }

          .listening-bar {
            background: rgba(255,255,255,0.12);
            border-radius: 99px;
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: white;
            font-weight: 500;
            margin-top: 20px;
            min-height: 52px;
          }
          
          .purple-bar {
            background: var(--purple);
            box-shadow: 0 8px 20px rgba(91,79,224,0.25);
          }

          .pulse-icon {
            animation: pulse 1.2s infinite;
          }

          .chat-msg {
            padding: 12px 18px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
            max-width: 90%;
            animation: fadeIn 0.3s ease-out forwards;
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
            gap: 10px;
            font-weight: 600;
          }

          .invisible-input {
            border: none;
            background: transparent;
            font-weight: 600;
            color: var(--purple-dark);
            width: 140px;
            outline: none;
            font-size: 14px;
          }
          .invisible-input::placeholder { color: rgba(91,79,224,0.5); }

          .select-btn {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 16px;
            border-radius: 14px;
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
            padding: 10px;
            border-radius: 99px;
            border: 1px solid var(--border);
            background: white;
            font-weight: 600;
            font-size: 13px;
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
            height: 90px;
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
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
          }

          .profile-row {
            display: flex;
            align-items: flex-start;
            gap: 14px;
          }
          .profile-row .label { display: block; font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px; }
          .profile-row .value { display: block; font-size: 14px; color: var(--text-main); font-weight: 600; }

          @keyframes pulse-glow {
            from { box-shadow: 0 0 20px rgba(91,79,224,0.4); }
            to { box-shadow: 0 0 60px rgba(91,79,224,0.8); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes wave {
            0% { transform: scaleY(0.2); background: var(--purple-light); }
            100% { transform: scaleY(1); background: var(--purple); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}} />
      </div>
    </div>
  );
}
