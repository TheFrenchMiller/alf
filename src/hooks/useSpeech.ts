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

function detectLanguage(text: string): "en-US" | "fr-FR" {
  const englishTokens = /\b(the|this|that|which|with|here|welcome|ready|analyzed|inspected|hardware|autonomous|review)\b/i;
  return englishTokens.test(text) ? "en-US" : "fr-FR";
}

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    voiceName,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const browserSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

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

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }

    if (browserSupported) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }, [browserSupported]);

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!browserSupported || !text) return;

      window.speechSynthesis.cancel();

      const targetLang = detectLanguage(text);
      const prefix = targetLang.slice(0, 2);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      if (voiceName) {
        const selected = availableVoices.find((v) => v.name === voiceName);
        if (selected) utterance.voice = selected;
      } else {
        // Filtrer les voix de la langue cible
        const matchingVoices = availableVoices.filter((v) =>
          v.lang.toLowerCase().startsWith(prefix)
        );

        // Priorité aux voix haute fidélité (Natural, Online ou Neural)
        const premiumVoice = matchingVoices.find(
          (v) =>
            v.name.includes("Natural") ||
            v.name.includes("Online") ||
            v.name.includes("Neural")
        );

        if (premiumVoice) {
          utterance.voice = premiumVoice;
        } else if (matchingVoices.length > 0) {
          utterance.voice = matchingVoices[0];
        }
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [browserSupported, rate, pitch, volume, voiceName, availableVoices]
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

      stop();

      const lang = detectLanguage(text);

      // Si le texte est en anglais, utiliser la voix premium anglaise du navigateur
      if (lang === "en-US") {
        speakWithBrowser(text);
        return;
      }

      // En français, Pocket TTS est tenté en priorité
      speakWithBackend(text).catch((err) => {
        console.warn(
          "[Speech] Pocket TTS indisponible, bascule navigateur :",
          err.message
        );
        speakWithBrowser(text);
      });
    },
    [speakWithBackend, speakWithBrowser, stop]
  );

  useEffect(() => {
    return () => {
      stop();
      if (browserSupported) window.speechSynthesis.cancel();
    };
  }, [browserSupported, stop]);

  return {
    isSupported: true,
    isSpeaking,
    speak,
    stop,
    availableVoices,
  };
}
