import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "path";
import { McpManager } from "./mcp-manager.js";
import { Orchestrator } from "./orchestrator.js";
import type { ChatRequest, ChatResponse, StatusResponse } from "./types.js";

// Résolution du chemin du .env :
// - En mode dev (npm run server) : ../../mcp-servers/.env relatif à server/
// - En mode exe compilé : fourni via la variable ALF_ENV_PATH par Tauri
const envPath =
  process.env.ALF_ENV_PATH || resolve(process.cwd(), "../mcp-servers/.env");

console.log(`[Orchestrateur] Chargement du .env depuis : ${envPath}`);
dotenv.config({ path: envPath });

const PORT = 3001;

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

  // --- Démarrage du serveur ---
  const server = app.listen(PORT, () => {
    console.log(`[Orchestrateur] API disponible sur http://localhost:${PORT}`);
    console.log(`[Orchestrateur] ${mcp.getAllTools().length} outil(s) chargé(s)`);
  });

  process.on("SIGINT", async () => {
    console.log("\n[Orchestrateur] Arrêt en cours...");
    await mcp.shutdown();
    server.close(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("[Orchestrateur] Erreur fatale :", error);
  process.exit(1);
});