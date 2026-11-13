import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { transcribeAudio } from "../api";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (prompt: string) => void;
  disabled: boolean;
  isDemoMode?: boolean;
}

export default function ChatPanel({
  messages,
  onSend,
  disabled,
  isDemoMode = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isRecording,
    isSupported: micSupported,
    start: startRec,
    stop: stopRec,
    error: recorderError,
    duration,
  } = useAudioRecorder();

  useEffect(() => {
    if (recorderError) setMicError(recorderError);
  }, [recorderError]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleMicClick = async () => {
    setMicError(null);

    if (isRecording) {
      setIsTranscribing(true);
      const result = await stopRec();
      if (!result) {
        setIsTranscribing(false);
        setMicError("Aucun audio capturé.");
        return;
      }

      try {
        const res = await transcribeAudio(result.base64, result.mimeType);
        if (res.error) {
          setMicError(`Transcription échouée : ${res.error}`);
        } else if (res.text) {
          setInput((prev) => (prev ? prev + " " + res.text : res.text));
          setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          setMicError("Aucune parole détectée.");
        }
      } catch (e) {
        setMicError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsTranscribing(false);
      }
    } else {
      await startRec();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const placeholder = isRecording
    ? `🎤 Enregistrement... (${formatDuration(duration)}) — clique ⏹ pour transcrire`
    : isTranscribing
    ? "Transcription en cours..."
    : disabled
    ? "Alf réfléchit..."
    : "Écris ton message ou clique sur le micro... / Type in French or English...";

  const demoSuggestions = [
    {
      title: "Rédiger une chronique WARM-TV · Write a music review",
      desc: "Créer un article rock avec mise en valeur SEO · Generate complete rock review",
      prompt: "Rédige une chronique pour WARM-TV sur le nouvel album de Gojira.",
    },
    {
      title: "Inspecter les emails RP · Triage press emails",
      desc: "Trier les communiqués et extraire les photos · Filter PR releases and extract visuals",
      prompt: "Vérifie les nouveaux emails de relations presse et résume-moi les actualités.",
    },
    {
      title: "Analyser l'architecture du code · Audit code architecture",
      desc: "Évaluer l'optimisation pour ASUS NPU · Evaluate ASUS NPU & RTX optimization",
      prompt: "Inspect the project architecture and suggest optimizations for ASUS hardware.",
    },
  ];

  return (
    <div className="h-full flex flex-col bg-alf-bg">
      <div className="p-4 border-b border-alf-border">
        <div className="text-sm font-semibold text-alf-text">Conversation</div>
        <div className="text-xs text-alf-muted">
          {messages.length} message{messages.length > 1 ? "s" : ""}
        </div>
      </div>

      {micError && (
        <div className="bg-red-950/40 border-b border-red-800 text-red-300 px-4 py-2 text-xs flex items-center justify-between">
          <span>{micError}</span>
          <button
            onClick={() => setMicError(null)}
            className="text-red-300 hover:text-red-100 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && isDemoMode && (
          <div className="max-w-xl mx-auto my-6 space-y-4">
            <div className="text-center">
              <h2 className="text-base font-medium text-alf-text">
                Bienvenue dans le démonstrateur Alf · Welcome to Alf
              </h2>
              <p className="text-xs text-alf-muted mt-1">
                Choisissez une suggestion rapide ou tapez en français ou en anglais.
                <br />
                Select a quick scenario or type freely in English or French.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              {demoSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSend(item.prompt)}
                  disabled={disabled}
                  className="p-3 text-left rounded-lg border border-alf-border bg-alf-panel hover:border-alf-accent transition-all group disabled:opacity-50"
                >
                  <div className="text-xs font-semibold text-alf-text group-hover:text-alf-accent">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-alf-muted mt-0.5">
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !isDemoMode && (
          <div className="text-center text-alf-muted text-sm mt-8">
            Commence par poser une question à Alf...
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-alf-accent text-white"
                  : "bg-alf-panel border border-alf-border text-alf-text"
              }`}
            >
              <div className="text-xs opacity-60 mb-1">
                {msg.role === "user" ? "Toi / You" : "Alf"} · {formatTime(msg.timestamp)}
              </div>
              <div className="text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </div>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-alf-border/50 text-xs opacity-70">
                  {msg.actions.length} action{msg.actions.length > 1 ? "s" : ""}{" "}
                  effectuée{msg.actions.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-alf-border flex gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || isRecording || isTranscribing}
          className="flex-1 px-4 py-2 rounded-md bg-alf-panel border border-alf-border text-alf-text text-sm focus:outline-none focus:border-alf-accent disabled:opacity-50"
        />

        {micSupported && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={disabled || isTranscribing}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : isTranscribing
                ? "bg-alf-panel border border-alf-border text-alf-muted"
                : "bg-alf-panel border border-alf-border text-alf-text hover:border-alf-accent"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              isRecording
                ? "Arrêter et transcrire"
                : isTranscribing
                ? "Transcription..."
                : "Démarrer l'enregistrement"
            }
          >
            {isRecording ? "⏹" : isTranscribing ? "⏳" : "🎤"}
          </button>
        )}

        <button
          type="submit"
          disabled={
            disabled || !input.trim() || isRecording || isTranscribing
          }
          className="px-4 py-2 rounded-md bg-alf-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}