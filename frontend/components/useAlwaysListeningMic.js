import { useEffect, useRef, useState, useCallback } from "react";

const WAKE_PHRASES = ["hey tutor", "hey tuter", "hi tutor", "ok tutor"];

/**
 * Always-on microphone with wake-word detection.
 *
 * States:
 *  - "idle"        : mic is listening in the background, waiting for "Hey Tutor"
 *  - "wake_heard"   : wake phrase detected, now capturing the actual question
 *  - "processing"  : question captured, waiting on tutor response
 *  - "muted"       : student has manually muted (optional override, never required)
 *
 * No hold-to-speak / push-to-talk anywhere in this flow - the mic stays open
 * continuously and restarts itself automatically if the browser's speech
 * recognition engine times out from silence.
 */
export function useAlwaysListeningMic({ onQuestion, muted }) {
  const [state, setState] = useState("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef(null);
  const captureBufferRef = useRef("");
  const stateRef = useRef("idle");

  const setStateBoth = (s) => {
    stateRef.current = s;
    setState(s);
  };

  const startRecognition = useCallback(() => {
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser. Use Chrome/Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcriptPiece + " ";
        } else {
          interim += transcriptPiece;
        }
      }

      const lower = (finalChunk + " " + interim).toLowerCase();

      if (stateRef.current === "idle") {
        const heardWake = WAKE_PHRASES.some((phrase) => lower.includes(phrase));
        if (heardWake) {
          setStateBoth("wake_heard");
          captureBufferRef.current = "";
          setLiveTranscript("");
          return;
        }
      } else if (stateRef.current === "wake_heard") {
        // accumulate everything said after the wake phrase as the question
        captureBufferRef.current += finalChunk;
        setLiveTranscript((captureBufferRef.current + interim).trim());

        // once we get a final chunk with real content, treat that as the
        // end of the question (silence/pause implicitly ends the turn
        // because speech recognition only fires "final" after a pause)
        if (finalChunk.trim().length > 0) {
          const question = captureBufferRef.current.trim();
          if (question.length > 0) {
            setStateBoth("processing");
            onQuestion(question).finally(() => {
              captureBufferRef.current = "";
              setLiveTranscript("");
              setStateBoth("idle");
            });
          }
        }
      }
    };

    recognition.onend = () => {
      // browsers stop continuous recognition after periods of silence -
      // restart automatically so the mic is *always* listening, never
      // requiring the student to re-trigger it manually
      if (stateRef.current !== "muted") {
        try {
          recognition.start();
        } catch (e) {
          // already started - ignore
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        console.error("Microphone permission denied.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onQuestion]);

  useEffect(() => {
    if (!muted) {
      startRecognition();
    }
    return () => {
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (muted) {
      setStateBoth("muted");
      recognitionRef.current?.stop();
    } else if (stateRef.current === "muted") {
      setStateBoth("idle");
      startRecognition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  return { state, liveTranscript };
}

export function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
