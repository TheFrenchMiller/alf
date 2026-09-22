import { useCallback, useRef, useState } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<{ base64: string; mimeType: string } | null>;
  error: string | null;
  duration: number;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((value: { base64: string; mimeType: string } | null) => void) | null>(null);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== "undefined";

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("L'enregistrement audio n'est pas supporté par ce navigateur.");
      return;
    }

    setError(null);
    chunksRef.current = [];
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Essaie webm, sinon mp4 (Safari), sinon défaut
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("[Recorder] Erreur:", event);
        setError("Erreur pendant l'enregistrement.");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Chronomètre
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        setError("Accès au micro refusé. Autorise le micro dans les paramètres Windows.");
      } else if (msg.includes("NotFound")) {
        setError("Aucun microphone détecté.");
      } else {
        setError(`Impossible de démarrer l'enregistrement : ${msg}`);
      }
      setIsRecording(false);
    }
  }, [isSupported]);

  const stop = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      resolveRef.current = resolve;

      recorder.onstop = async () => {
        // Arrête le timer
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Arrête le stream micro
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        setIsRecording(false);

        // Assemble le blob
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        // Convertit en base64
        try {
          const base64 = await blobToBase64(blob);
          resolve({ base64, mimeType });
        } catch (e) {
          console.error("[Recorder] Conversion base64 échouée:", e);
          setError("Impossible de traiter l'audio enregistré.");
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, []);

  return { isRecording, isSupported, start, stop, error, duration };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        // Retire le préfixe "data:audio/...;base64,"
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      } else {
        reject(new Error("Format de lecture inattendu"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}