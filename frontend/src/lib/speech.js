import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import api from "./apiClient.js";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const TAGS = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
export const canListen = !!Recognition;
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

// Browser speech recognition (Chrome/Edge). Calls onFinal(text) once when the user stops talking.
export function useSpeechInput(lang, onFinal) {
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const recRef = useRef(null);
  const heard = useRef("");
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = () => {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = TAGS[lang] || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      heard.current = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setLive(heard.current);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      setLive("");
      if (heard.current.trim()) finalRef.current(heard.current.trim());
    };
    heard.current = "";
    recRef.current = rec;
    rec.start();
    setListening(true);
  };
  const stop = () => recRef.current?.stop();
  return { listening, live, start, stop };
}

// Records a clip and sends it to the backend's Whisper transcription (works in every browser, strong on Hindi/Marathi).
function useWhisperInput(lang, onFinal) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => () => recorder.current?.stream?.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1200) return; // too short to contain speech
        setProcessing(true);
        try {
          const body = new FormData();
          body.append("file", blob, "voice.webm");
          body.append("lang", lang);
          const { data } = await api.post("/voice/transcribe", body);
          if (data.text?.trim()) finalRef.current(data.text.trim());
        } catch {
          setError("transcribe");
        } finally {
          setProcessing(false);
        }
      };
      recorder.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setError("mic");
    }
  };
  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();
  return { listening, processing, error, start, stop };
}

// One voice API for the whole app: Whisper when the server has a Groq key, the browser's recognizer otherwise.
export function useVoiceInput(lang, onFinal) {
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get("/ai/status").then((r) => r.data), staleTime: 60000 });
  const whisperOn = status.data?.stt === "whisper" && canRecord;
  const browser = useSpeechInput(lang, onFinal);
  const whisper = useWhisperInput(lang, onFinal);
  const engine = whisperOn ? whisper : browser;
  return {
    supported: whisperOn || canListen,
    engine: whisperOn ? "whisper" : "browser",
    listening: engine.listening,
    processing: whisperOn ? whisper.processing : false,
    live: whisperOn ? "" : browser.live,
    error: whisperOn ? whisper.error : null,
    start: engine.start,
    stop: engine.stop,
  };
}

// Text-to-speech in the app language when the browser has a matching voice (Marathi falls back to Hindi).
export function speak(text, lang, onEnd) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TAGS[lang] || "en-IN";
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.replace("_", "-").startsWith(u.lang)) ||
    voices.find((v) => v.lang.startsWith(lang === "en" ? "en" : "hi"));
  if (voice) u.voice = voice;
  u.rate = 0.98;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => canSpeak && window.speechSynthesis.cancel();
