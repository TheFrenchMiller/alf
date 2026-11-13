import { useEffect, useRef, useState } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";

type BackendStatus = "starting" | "ready" | "error";

const ENV_PATH =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\mcp-servers\\.env";
const MCP_CONFIG_PATH =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\alf-2.0.1-hq\\server\\mcp.config.json";
const MCP_SERVERS_DIR =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\mcp-servers";
const DEV_ROOT_PATH = "D:\\Documents\\2026 - Web";

function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

export function useBackend() {
  const [status, setStatus] = useState<BackendStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const childRef = useRef<Child | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let mounted = true;

    async function start() {
      // 1. Si nous sommes dans un navigateur classique (npm run dev)
      if (!isTauriEnvironment()) {
        console.log("[Backend] Mode navigateur détecté (hors runtime Tauri). Vérification du serveur...");
        const ready = await waitForBackend(5000);
        if (mounted) {
          if (ready) {
            console.log("[Backend] Serveur local détecté et prêt.");
            setStatus("ready");
          } else {
            console.warn("[Backend] Serveur non joignable sur http://localhost:3001.");
            setStatus("error");
            setError(
              "En mode navigateur, le backend doit être lancé séparément : lance 'npm run server' dans un second terminal, ou lance l'application complète avec 'npm run tauri dev'."
            );
          }
        }
        return;
      }

      // 2. Si nous sommes dans le runtime Tauri natif (app installée ou npm run tauri dev)
      try {
        console.log("[Backend] Runtime Tauri détecté. Lancement du sidecar...");
        const command = Command.sidecar("binaries/alf-backend", [], {
          env: {
            ALF_ENV_PATH: ENV_PATH,
            ALF_MCP_CONFIG_PATH: MCP_CONFIG_PATH,
            MCP_SERVERS_DIR: MCP_SERVERS_DIR,
            DEV_ROOT_PATH: DEV_ROOT_PATH,
          },
        });

        command.stdout.on("data", (line) => {
          console.log("[Backend]", line);
        });

        command.stderr.on("data", (line) => {
          const lineStr = String(line);
          const isLikelyInfo =
            lineStr.includes("injected env") ||
            lineStr.includes("running on stdio") ||
            lineStr.includes("MCP Server");
          if (isLikelyInfo) {
            console.log("[Backend]", lineStr);
          } else {
            console.error("[Backend ERR]", lineStr);
          }
        });

        command.on("close", (data) => {
          console.warn(`[Backend] Processus terminé (code ${data.code})`);
        });

        command.on("error", (err) => {
          console.error("[Backend] Erreur processus:", err);
          if (mounted) {
            setStatus("error");
            setError(String(err));
          }
        });

        const child = await command.spawn();
        childRef.current = child;
        console.log("[Backend] Sidecar lancé, attente de disponibilité...");

        const ok = await waitForBackend(90000);
        if (mounted) {
          if (ok) {
            console.log("[Backend] Prêt.");
            setStatus("ready");
          } else {
            setStatus("error");
            setError("Le backend n'a pas répondu dans les temps.");
          }
        }
      } catch (err) {
        console.error("[Backend] Impossible de lancer le sidecar:", err);
        // Si le sidecar échoue mais que le serveur tourne déjà, on vérifie quand même
        const ok = await waitForBackend(3000);
        if (mounted) {
          if (ok) {
            setStatus("ready");
          } else {
            setStatus("error");
            setError(err instanceof Error ? err.message : String(err));
          }
        }
      }
    }

    start();

    return () => {
      mounted = false;
      if (childRef.current) {
        childRef.current.kill().catch((err: unknown) => {
          console.error("[Backend] Échec kill:", err);
        });
      }
    };
  }, []);

  return { status, error };
}

/**
 * Poll /status avec timeout strict par requête.
 */
async function waitForBackend(timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;

    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch("http://localhost:3001/status", {
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      if (res.ok) {
        return true;
      }
    } catch {
      // ignore et réessaie
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return false;
}