import { useEffect, useRef, useState } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";

type BackendStatus = "starting" | "ready" | "error";

// ⚠️ Chemins absolus vers les fichiers de config.
// À adapter si tu déplaces le projet ou changes de machine.
const ENV_PATH =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\mcp-servers\\.env";
const MCP_CONFIG_PATH =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\alf-2.0.1-hq\\server\\mcp.config.json";
const MCP_SERVERS_DIR =
  "D:\\Documents\\2026 - Web\\2026.09_DEV_GEMINI\\mcp-servers";
const DEV_ROOT_PATH = "D:\\Documents\\2026 - Web";

/**
 * Lance le backend Alf (sidecar) au démarrage de l'application.
 * Attend qu'il soit prêt avant de renvoyer "ready".
 * Le backend écoute ensuite sur http://localhost:3001 comme d'habitude.
 */
export function useBackend() {
  const [status, setStatus] = useState<BackendStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const childRef = useRef<Child | null>(null);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        console.log("[Backend] Lancement du sidecar...");
        const command = Command.sidecar("binaries/alf-backend", [], {
          env: {
            ALF_ENV_PATH: ENV_PATH,
            ALF_MCP_CONFIG_PATH: MCP_CONFIG_PATH,
            MCP_SERVERS_DIR: MCP_SERVERS_DIR,
            DEV_ROOT_PATH: DEV_ROOT_PATH,
          },
        });

        // Écoute des logs du backend (pour debug)
        command.stdout.on("data", (line) => {
          console.log("[Backend]", line);
        });
        command.stderr.on("data", (line) => {
          console.error("[Backend ERR]", line);
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

        // Polling : attend que le serveur réponde sur /status
        const ok = await waitForBackend(20000);
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
        if (mounted) {
          setStatus("error");
          setError(err instanceof Error ? err.message : String(err));
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
 * Poll /status jusqu'à ce que le backend soit prêt, ou timeout.
 */
async function waitForBackend(timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch("http://localhost:3001/status");
      if (res.ok) return true;
    } catch {
      // Pas encore prêt, on réessaie
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}