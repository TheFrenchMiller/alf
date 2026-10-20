import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "path";
import { spawn, ChildProcess } from "child_process";
import { McpManager } from "./mcp-manager.js";
import { Orchestrator } from "./orchestrator.js";
import type { ChatRequest, ChatResponse, StatusResponse } from "./types.js";

const envPath =
  process.env.ALF_ENV_PATH || resolve(process.cwd(), "../mcp-servers/.env");

console.log(`[Orchestrateur] Chargement du .env depuis : ${envPath}`);
dotenv.config({ path: envPath });

const PORT = 3001;
const POCKET_TTS_PORT = 8000;
const POCKET_TTS_URL = `http://localhost:${POCKET_TTS_PORT}`;
const POCKET_TTS_VOICE = process.env.POCKET_TTS_VOICE || "estelle";
const POCKET_TTS_LANG = process.env.POCKET_TTS_LANG || "french";

let pocketTtsProcess: ChildProcess | null = null;
let pocketTtsAvailable = false;

/**
 * Vérifie si le serveur Pocket TTS répond.
 */
async function isPocketTtsAlive(): Promise<boolean> {
  try {
    const res = await fetch(POCKET_TTS_URL, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Attend que Pocket TTS soit prêt (polling toutes les 500ms, timeout 120s).
 */
async function waitForPocketTts(timeoutMs = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPocketTtsAlive()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Lance le serveur Pocket TTS en sous-processus (si pas déjà en cours).
 */
async function startPocketTts(): Promise<void> {
  // Si un serveur Pocket TTS tourne déjà (autre session), on le réutilise.
  if (await isPocketTtsAlive()) {
    console.log("[PocketTTS] Serveur déjà en cours, réutilisation.");
    pocketTtsAvailable = true;
    return;
  }

  console.log(
    `[PocketTTS] Lancement de "uvx pocket-tts serve --language ${POCKET_TTS_LANG} --voice ${POCKET_TTS_VOICE}"...`
  );

  try {
        pocketTtsProcess = spawn(
      "C:\\Users\\erwan\\.local\\bin\\uvx.exe",
            [
        "pocket-tts",
        "serve",
        "--language",
        POCKET_TTS_LANG,
        "--default-voice",
        POCKET_TTS_VOICE,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true, // nécessaire sous Windows pour trouver uvx dans le PATH
      }
    );

    pocketTtsProcess.stdout?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[PocketTTS] ${line}`);
    });

    pocketTtsProcess.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[PocketTTS] ${line}`);
    });

    pocketTtsProcess.on("error", (err) => {
      console.error("[PocketTTS] Erreur de lancement :", err.message);
      pocketTtsAvailable = false;
    });

    pocketTtsProcess.on("exit", (code) => {
      console.log(`[PocketTTS] Processus terminé (code ${code}).`);
      pocketTtsAvailable = false;
      pocketTtsProcess = null;
    });

    console.log("[PocketTTS] Attente de disponibilité...");
    const ready = await waitForPocketTts();

    if (ready) {
      console.log("[PocketTTS] Prêt.");
      pocketTtsAvailable = true;
    } else {
      console.error(
        "[PocketTTS] Timeout : le serveur n'a pas répondu dans les temps."
      );
      pocketTtsAvailable = false;
    }
  } catch (err) {
    console.error("[PocketTTS] Impossible de lancer le serveur :", err);
    pocketTtsAvailable = false;
  }
}

/**
 * Arrête proprement Pocket TTS.
 */
function stopPocketTts(): void {
  if (pocketTtsProcess) {
    console.log("[PocketTTS] Arrêt du serveur...");
    try {
      pocketTtsProcess.kill();
    } catch {
      // ignore
    }
    pocketTtsProcess = null;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      `[ERREUR] GEMINI_API_KEY manquante. Chemin testé : ${envPath}`
    );
    process.exit(1);
  }

  const mcp = new McpManager();
  console.log("[Orchestrateur] Démarrage, connexion aux serveurs MCP...");
  await mcp.connectAll();

  const orchestrator = new Orchestrator(apiKey, mcp);

  // Lance Pocket TTS en arrière-plan (non bloquant)
  startPocketTts().catch((err) => {
    console.error("[PocketTTS] Erreur démarrage :", err);
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  // --- GET /status : état des serveurs MCP ---
  app.get("/status", (_req, res) => {
    const status: StatusResponse = {
      servers: mcp.getStatus(),
      totalTools: mcp.getAllTools().length,
    };
    res.json(status);
  });

  // --- GET /tools : liste des outils disponibles ---
  app.get("/tools", (_req, res) => {
    res.json({
      all: mcp.getAllTools(),
      byDomain: mcp.getToolsByDomain(),
    });
  });

  // --- POST /chat : envoyer un message à Alf ---
  app.post("/chat", async (req, res) => {
    const body = (req.body || {}) as ChatRequest;
    if (!body.prompt || typeof body.prompt !== "string") {
      res.status(400).json({
        error: "prompt manquant ou invalide",
        received: req.body,
      });
      return;
    }

    try {
      const result: ChatResponse = await orchestrator.chat(
        body.prompt,
        body.conversationId
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // --- POST /reset : réinitialiser une conversation ---
  app.post("/reset", (req, res) => {
    const { conversationId } = req.body as { conversationId: string };
    if (conversationId) {
      orchestrator.resetConversation(conversationId);
    }
    res.json({ ok: true });
  });

  // --- POST /transcribe : transcrire un audio via Gemini ---
  app.post("/transcribe", async (req, res) => {
    const { audio, mimeType } = req.body as {
      audio: string;
      mimeType: string;
    };

    if (!audio || typeof audio !== "string") {
      res.status(400).json({ error: "audio manquant ou invalide" });
      return;
    }

    if (!mimeType || typeof mimeType !== "string") {
      res.status(400).json({ error: "mimeType manquant ou invalide" });
      return;
    }

    try {
      const result = await orchestrator.transcribe(audio, mimeType);
      if (result.error) {
        res.status(500).json({ error: result.error });
        return;
      }
      res.json({ text: result.text });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // --- POST /execute-action : exécuter une action validée manuellement ---
  app.post("/execute-action", async (req, res) => {
    const { toolName, args } = req.body as {
      toolName: string;
      args: Record<string, unknown>;
    };

    if (!toolName || typeof toolName !== "string") {
      res.status(400).json({ error: "toolName manquant ou invalide" });
      return;
    }

    if (!args || typeof args !== "object") {
      res.status(400).json({ error: "args manquant ou invalide" });
      return;
    }

    try {
      const result = await orchestrator.executePendingAction(toolName, args);
      if (result.error) {
        res.status(500).json({ error: result.error });
        return;
      }
      res.json({ result: result.result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // --- POST /speak : synthèse vocale via Pocket TTS ---
  app.post("/speak", async (req, res) => {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text manquant ou invalide" });
      return;
    }

    if (!pocketTtsAvailable) {
      res.status(503).json({
        error: "Pocket TTS non disponible",
        fallback: "browser",
      });
      return;
    }

    try {
            const form = new FormData();
      form.append("text", text);
      form.append("voice_url", POCKET_TTS_VOICE);

      const ttsRes = await fetch(`${POCKET_TTS_URL}/tts`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error(`[Speak] Pocket TTS erreur ${ttsRes.status}: ${errText}`);
        res.status(500).json({
          error: `Pocket TTS erreur ${ttsRes.status}`,
          fallback: "browser",
        });
        return;
      }

      const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
      const contentType = ttsRes.headers.get("content-type") || "audio/wav";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error) {
      console.error("[Speak] Erreur :", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        fallback: "browser",
      });
    }
  });

  // --- Démarrage du serveur ---
  const server = app.listen(PORT, () => {
    console.log(`[Orchestrateur] API disponible sur http://localhost:${PORT}`);
    console.log(`[Orchestrateur] ${mcp.getAllTools().length} outil(s) chargé(s)`);
  });

  process.on("SIGINT", async () => {
    console.log("\n[Orchestrateur] Arrêt en cours...");
    stopPocketTts();
    await mcp.shutdown();
    server.close(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    stopPocketTts();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[Orchestrateur] Erreur fatale :", error);
  stopPocketTts();
  process.exit(1);
});