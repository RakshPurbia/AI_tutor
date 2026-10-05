const fs = require('fs');

let content = fs.readFileSync('components/VoiceAssistant.js', 'utf8');

const stateToAdd = `  const [response, setResponse] = useState("");
  const [tutorName, setTutorName] = useState("Tutor");

  useEffect(() => {
    if (studentId) {
      fetch(\`http://localhost:8000/api/profile/\${studentId}\`)
        .then(res => res.json())
        .then(data => {
          if (data.tutor_name) {
            setTutorName(data.tutor_name);
          }
        })
        .catch(console.error);
    }
  }, [studentId]);`;
content = content.replace('  const [response, setResponse] = useState("");', stateToAdd);

const oldHandleVoiceInput = `  const handleVoiceInput = (text) => {
    const lower = text.toLowerCase();
    
    // Navigation command parsing
    // Navigation command parsing (ensure questions like "what is my progress" or "past quiz scores" are not hijacked)
    if (lower.includes("go to dashboard") || lower.includes("open dashboard")) {
      router.push("/dashboard");
      onClose();
      return;
    }
    if (lower.includes("go to tutor") || lower.includes("open tutor") || lower.includes("open chat")) {
      router.push("/tutor");
      onClose();
      return;
    }
    if (lower.includes("go to lessons") || lower.includes("open lessons") || lower.includes("go to curriculum")) {
      router.push("/lessons");
      onClose();
      return;
    }
    if (lower.includes("go to quiz") || lower.includes("open quizzes") || lower.includes("go to quizzes")) {
      router.push("/quizzes");
      onClose();
      return;
    }
    if (lower.includes("go to progress") || lower.includes("open progress")) {
      router.push("/progress");
      onClose();
      return;
    }
    if (lower.includes("go to history") || lower.includes("open history")) {
      router.push("/history");
      onClose();
      return;
    }
    if (lower.includes("go to profile") || lower.includes("open profile")) {
      router.push("/profile");
      onClose();
      return;
    }
    if (lower.includes("go to settings") || lower.includes("open settings")) {
      router.push("/settings");
      onClose();
      return;
    }
    
    // Fallback to AI Tutor
    handleAskTutor(text);
  };`;

const newHandleVoiceInput = `  const handleVoiceInput = (text) => {
    handleAskTutor(text);
  };`;
content = content.replace(oldHandleVoiceInput, newHandleVoiceInput);

const oldHandleAskTutor = `      const data = await res.json();
      setResponse(data.answer);
      playTTS(data.answer);
    } catch (error) {`;

const newHandleAskTutor = `      const data = await res.json();
      setResponse(data.answer);
      
      if (data.navigation_action) {
        const dest = data.navigation_action.split("_")[1].toLowerCase();
        setTimeout(() => {
          router.push(\`/\${dest}\`);
          onClose();
        }, 1500);
      }
      
      playTTS(data.answer);
    } catch (error) {`;
content = content.replace(oldHandleAskTutor, newHandleAskTutor);

content = content.replace(
  'You can ask anything about your lessons',
  'Try saying "Hey {tutorName}..."'
);

fs.writeFileSync('components/VoiceAssistant.js', content, 'utf8');
