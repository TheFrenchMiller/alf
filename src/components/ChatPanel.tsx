import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { transcribeAudio } from "../api";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (prompt: string) => void;
  disabled: boolean;
}

export default function ChatPanel({ messages, onSend, disabled }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Enregistrement audio ---
  const {
    isRecording,
    isSupported: micSupported,
    start: startRec,
    stop: stopRec,
    error: recorderError,
    duration,
  } = useAudioRecorder();

  // Synchronise l'erreur du recorder dans l'état local
  useEffect(() => {
    if (recorderError) setMicError(recorderError);
  }, [recorderError]);

  // Auto-scroll vers le bas quand un nouveau message arrive
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
      // Arrête l'enregistrement et transcrit
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
          // Focus sur l'input pour que l'utilisateur puisse valider direct
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
      // Démarre l'enregistrement
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

  // Texte affiché dans l'input
  const placeholder = isRecording
    ? `🎤 Enregistrement... (${formatDuration(duration)}) — clique ⏹ pour transcrire`
    : isTranscribing
    ? "Transcription en cours..."
    : disabled
    ? "Alf réfléchit..."
    : "Écris ton message ou clique sur le micro...";

  return (
    <div className="h-full flex flex-col bg-alf-bg">
      {/* En-tête */}
      <div className="p-4 border-b border-alf-border">
        <div className="text-sm font-semibold text-alf-text">Conversation</div>
        <div className="text-xs text-alf-muted">
          {messages.length} message{messages.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Bandeau erreur micro */}
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

      {/* Historique */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
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
                {msg.role === "user" ? "Toi" : "Alf"} · {formatTime(msg.timestamp)}
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

      {/* Formulaire de saisie */}
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

        {/* Bouton micro */}
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