import { useCallback, useEffect, useRef, useState } from "react";
import { speakText } from "../api";

interface UseSpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
}

interface UseSpeechReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
  availableVoices: SpeechSynthesisVoice[];
}

type BackendStatus = "unknown" | "available" | "unavailable";

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const {
    lang = "fr-FR",
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    voiceName,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("unknown");

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const browserSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Charge les voix navigateur (fallback)
  useEffect(() => {
    if (!browserSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [browserSupported]);

  // Détecte si Pocket TTS est dispo au premier appel
  // (on ne teste pas au montage pour ne pas bloquer le démarrage)

  const stop = useCallback(() => {
    // Stoppe Pocket TTS (audio element)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    // Stoppe la voix navigateur
    if (browserSupported) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }, [browserSupported]);

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!browserSupported || !text) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      if (voiceName) {
        const selected = availableVoices.find((v) => v.name === voiceName);
        if (selected) utterance.voice = selected;
      } else {
        const frenchVoice = availableVoices.find((v) =>
          v.lang.startsWith("fr")
        );
        if (frenchVoice) utterance.voice = frenchVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [browserSupported, lang, rate, pitch, volume, voiceName, availableVoices]
  );

  const speakWithBackend = useCallback(
    async (text: string) => {
      const blob = await speakText(text);
      const url = URL.createObjectURL(blob);
      currentUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        if (currentUrlRef.current) {
          URL.revokeObjectURL(currentUrlRef.current);
          currentUrlRef.current = null;
        }
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        if (currentUrlRef.current) {
          URL.revokeObjectURL(currentUrlRef.current);
          currentUrlRef.current = null;
        }
        audioRef.current = null;
      };

      await audio.play();
    },
    []
  );

  const speak = useCallback(
    (text: string) => {
      if (!text) return;

      // Coupe toute lecture en cours
      stop();

      // Tente Pocket TTS en priorité (si dispo ou statut inconnu)
      if (backendStatus !== "unavailable") {
        speakWithBackend(text)
          .then(() => {
            if (backendStatus === "unknown") {
              setBackendStatus("available");
            }
          })
          .catch((err) => {
            console.warn(
              "[Speech] Pocket TTS indisponible, fallback navigateur :",
              err.message
            );
            setBackendStatus("unavailable");
            speakWithBrowser(text);
          });
        return;
      }

      // Statut déjà "unavailable" → fallback direct
      speakWithBrowser(text);
    },
    [backendStatus, speakWithBackend, speakWithBrowser, stop]
  );

  // Nettoyage à la fermeture
  useEffect(() => {
    return () => {
      stop();
      if (browserSupported) window.speechSynthesis.cancel();
    };
  }, [browserSupported, stop]);

  return {
    isSupported: true, // toujours true : Pocket TTS OU navigateur
    isSpeaking,
    speak,
    stop,
    availableVoices,
  };
}