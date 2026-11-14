import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { spawn, ChildProcess } from "child_process";
import { McpManager } from "./mcp-manager.js";
import { Orchestrator } from "./orchestrator.js";
import type { ChatRequest, ChatResponse, StatusResponse, Action } from "./types.js";

const envPath =
  process.env.ALF_ENV_PATH || resolve(process.cwd(), "../mcp-servers/.env");

console.log(`[Orchestrateur] Chargement du .env depuis : ${envPath}`);
dotenv.config({ path: envPath, override: true });

const PORT = 3001;
const POCKET_TTS_PORT = 8000;
const POCKET_TTS_URL = `http://127.0.0.1:${POCKET_TTS_PORT}`;
const POCKET_TTS_VOICE =
  process.env.POCKET_TTS_VOICE ||
  "D:/Documents/2026 - Web/2026.09_GEMINI_AGENT/alf.safetensors";
const POCKET_TTS_LANG = process.env.POCKET_TTS_LANG || "french";

console.log(`[Orchestrateur] Voix de synthese active : ${POCKET_TTS_VOICE}`);

let pocketTtsProcess: ChildProcess | null = null;
let pocketTtsAvailable = false;
let forceDemoMode = false;

async function isPocketTtsAlive(): Promise<boolean> {
  try {
    const res = await fetch(POCKET_TTS_URL, {
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForPocketTts(timeoutMs = 90000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPocketTtsAlive()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startPocketTts(): Promise<void> {
  if (await isPocketTtsAlive()) {
    console.log("[PocketTTS] Serveur déjà en cours, réutilisation de la voix naturelle.");
    pocketTtsAvailable = true;
    return;
  }

  const defaultUvx = "C:\\Users\\erwan\\.local\\bin\\uvx.exe";
  const uvxExecutable = existsSync(defaultUvx) ? defaultUvx : "uvx";

  console.log(`[PocketTTS] Lancement de la voix naturelle (${POCKET_TTS_VOICE}) via ${uvxExecutable}...`);

  try {
    const voiceArg = POCKET_TTS_VOICE.includes(" ")
      ? `"${POCKET_TTS_VOICE}"`
      : POCKET_TTS_VOICE;

    pocketTtsProcess = spawn(
      uvxExecutable,
      [
        "pocket-tts",
        "serve",
        "--language",
        POCKET_TTS_LANG,
        "--default-voice",
        voiceArg,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        env: process.env,
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
      console.warn("[PocketTTS] Impossible de lancer le binaire uvx, bascule navigateur :", err.message);
      pocketTtsAvailable = false;
    });

    pocketTtsProcess.on("exit", () => {
      pocketTtsAvailable = false;
      pocketTtsProcess = null;
    });

    const ready = await waitForPocketTts(90000);
    if (ready) {
      console.log("[PocketTTS] Serveur de voix naturelle prêt.");
      pocketTtsAvailable = true;
    } else {
      console.warn("[PocketTTS] Délai d'attente dépassé, voix navigateur active.");
      pocketTtsAvailable = false;
    }
  } catch {
    pocketTtsAvailable = false;
  }
}

function stopPocketTts(): void {
  if (pocketTtsProcess) {
    try {
      pocketTtsProcess.kill();
    } catch {
      // ignore
    }
    pocketTtsProcess = null;
  }
}

function isEnglishPrompt(text: string): boolean {
  const englishKeywords = /\b(the|is|in|at|which|on|this|that|with|for|and|here|welcome|review|music|album|code|project|ready|draft|analyzed|inspected|hardware|autonomous|write|inspect|check|audit|suggest|suggests|please|hello|hi|hey|show)\b/i;
  return englishKeywords.test(text);
}

function generateDemoResponse(prompt: string, conversationId = "demo-conv"): ChatResponse {
  const lower = prompt.toLowerCase();
  const timestamp = Date.now();
  const isEn = isEnglishPrompt(prompt);

  if (
    lower.includes("chronique") ||
    lower.includes("album") ||
    lower.includes("warm") ||
    lower.includes("rock") ||
    lower.includes("metal") ||
    lower.includes("gojira") ||
    lower.includes("review")
  ) {
    const demoActions: Action[] = [
      {
        toolName: "preparer_article_avec_images",
        serverId: "wordpress",
        args: {
          titre: isEn
            ? "Gojira strikes hard with their monumental new release"
            : "Gojira frappe un grand coup avec son nouveau chef d'oeuvre",
          categorie: "Chroniques",
          yoast_mot_cle: isEn ? "Gojira new album" : "Gojira nouvel album",
        },
        result: isEn
          ? "Draft article created on WordPress (ID: 4128). Featured image and galleries inserted."
          : "Article brouillon créé avec succès sur WordPress (ID: 4128). Image à la une et galeries insérées.",
        timestamp,
      },
    ];

    const response = isEn
      ? "Here is the pre-formatted WARM-TV draft ready on WordPress: **Gojira** strikes hard with their monumental new release. Mario Duplantier's thunderous drumming crushes the speakers while Joe Duplantier's progressive riffs take the listener on a visceral sonic storm. I automatically extracted the high-resolution cover art, prepared the WordPress draft with editorial styling tags, and configured the Yoast SEO title and meta description."
      : "Voici la chronique préformatée pour WARM-TV prête sur WordPress : Gojira ne fait pas semblant avec leur nouvelle sortie monumentale. Les rythmiques lourdes de Mario Duplantier fracassent les tympans tandis que les riffs de Joe Duplantier emmènent l'auditeur dans une tornade progressive. J'ai automatiquement extrait la pochette haute définition, préparé le brouillon WordPress avec les balises de mise en valeur éditoriale et configuré le titre SEO ainsi que la méta description pour Yoast.";

    return {
      conversationId,
      response,
      actions: demoActions,
    };
  }

  if (
    lower.includes("email") ||
    lower.includes("mail") ||
    lower.includes("presse") ||
    lower.includes("communique") ||
    lower.includes("rp") ||
    lower.includes("press")
  ) {
    const demoActions: Action[] = [
      {
        toolName: "chercher_emails",
        serverId: "email",
        args: { compte: "thefrenchmiller", limit: 5 },
        result: isEn
          ? "3 new emails retrieved from Listenable Records and Century Media."
          : "3 nouveaux emails détectés depuis Listenable Records et Century Media.",
        timestamp,
      },
      {
        toolName: "lire_email_complet",
        serverId: "email",
        args: { compte: "thefrenchmiller", uid: 1042 },
        result: isEn
          ? "Email parsed: European tour announcement and new single from Devastator. 2 promo pictures downloaded to sources-warmtv."
          : "Email extrait : Annonce de la tournée européenne et du single de Devastator. 2 photos de promo téléchargées dans sources-warmtv.",
        timestamp: timestamp + 200,
      },
    ];

    const response = isEn
      ? "I inspected The French Miller's press relations inbox: a priority email from Listenable Records announces the upcoming European tour and new single from **Devastator**. I extracted the high-res promo visuals into the sources directory, eliminated tracking pixels, and drafted a structured news summary to feed WARM-TV."
      : "J'ai inspecté la boîte de relations presse The French Miller : un email prioritaire de Listenable Records annonce la nouvelle tournée européenne de Devastator avec un single exclusif. J'ai extrait les visuels en haute résolution dans le dossier sources, supprimé les logos superflus et préparé une synthèse pour alimenter la rubrique News de WARM-TV.";

    return {
      conversationId,
      response,
      actions: demoActions,
    };
  }

  if (
    lower.includes("code") ||
    lower.includes("inspect") ||
    lower.includes("projet") ||
    lower.includes("optimisation") ||
    lower.includes("asus") ||
    lower.includes("architecture") ||
    lower.includes("memoire") ||
    lower.includes("memory")
  ) {
    const demoActions: Action[] = [
      {
        toolName: "lister_dossier",
        serverId: "systeme",
        args: { chemin: "./src" },
        result: isEn
          ? "Directories found: components, hooks, assets. 6 TypeScript/React source files."
          : "Dossiers détectés : components, hooks, assets. 6 fichiers sources TypeScript/React.",
        timestamp,
      },
      {
        toolName: "lire_fichier",
        serverId: "systeme",
        args: { fichier: "MEMOIRE_ALF.md" },
        result: isEn
          ? "Persistent memory loaded: long-term knowledge base active across sessions."
          : "Mémoire persistante chargée : base de connaissances à long terme active entre sessions.",
        timestamp: timestamp + 150,
      },
    ];

    const response = isEn
      ? "I analyzed the architecture of the alf-2.0.3 codebase. The system now incorporates persistent on-disk memory via MEMOIRE_ALF.md, loaded into the system context on startup. Combined with modular React 19 UI and on-device NPU/RTX acceleration, the agent learns continuously across sessions without external cloud storage dependencies."
      : "J'ai analysé l'architecture du projet alf-2.0.3. Le système intègre désormais une mémoire persistante sur disque via le carnet MEMOIRE_ALF.md, injectée au démarrage dans le contexte cognitif de l'agent. Couplée à l'accélération matérielle ASUS NPU et RTX, cette mémoire permet un apprentissage continu d'une session à l'autre sans aucune dépendance cloud externe.";

    return {
      conversationId,
      response,
      actions: demoActions,
    };
  }

  const response = isEn
    ? `Welcome to the Alf 2.0.3 ASUS Evaluation Demonstrator. I received your message: "${prompt}". The agent features persistent local memory across sessions, Model Context Protocol servers, WARM-TV editorial pipelines, and on-device acceleration. You can test our interactive scenarios or configure an API key in the settings.`
    : `Bienvenue dans le démonstrateur Alf 2.0.3 pour ASUS. J'ai bien reçu votre message : "${prompt}". L'agent intègre désormais une mémoire locale persistante entre les sessions, la gestion des protocoles MCP et la chaîne éditoriale WARM-TV. Vous pouvez tester nos scénarios guidés ou renseigner une clé API dans les paramètres pour passer en direct.`;

  return {
    conversationId,
    response,
    actions: [],
  };
}

async function main() {
  let apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.warn(
      `[Orchestrateur] Clé GEMINI_API_KEY non détectée sur ${envPath}. Activation du Mode Démonstration ASUS.`
    );
  } else {
    console.log("[Orchestrateur] Clé GEMINI_API_KEY détectée avec succès.");
  }

  const mcp = new McpManager();
  console.log("[Orchestrateur] Démarrage, connexion aux serveurs MCP...");
  await mcp.connectAll();

  let orchestrator: Orchestrator | null = apiKey ? new Orchestrator(apiKey, mcp) : null;

  startPocketTts().catch(() => {});

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  // --- GET /status : état des serveurs MCP & mode d'inférence ---
  app.get("/status", (_req, res) => {
    const isCurrentlyDemo = forceDemoMode || !Boolean(apiKey);
    const status: StatusResponse = {
      servers: mcp.getStatus(),
      totalTools: mcp.getAllTools().length,
      hasApiKey: Boolean(apiKey),
      demoMode: isCurrentlyDemo,
    };
    res.json(status);
  });

  // --- GET /memory : lire la mémoire persistante locale ---
  app.get("/memory", (_req, res) => {
    try {
      const memoryPath = resolve(process.cwd(), "MEMOIRE_ALF.md");
      const content = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : "";
      res.json({ memory: content });
    } catch {
      res.status(500).json({ error: "Erreur lecture mémoire" });
    }
  });

  // --- POST /memory : mettre à jour la mémoire persistante ---
  app.post("/memory", (req, res) => {
    const { memory } = req.body as { memory?: string };
    if (typeof memory !== "string") {
      res.status(400).json({ error: "Contenu mémoire invalide" });
      return;
    }
    try {
      const memoryPath = resolve(process.cwd(), "MEMOIRE_ALF.md");
      writeFileSync(memoryPath, memory, "utf-8");
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Erreur écriture mémoire" });
    }
  });

  // --- POST /toggle-demo : basculer manuellement entre démo et connecté ---
  app.post("/toggle-demo", (req, res) => {
    const { demo } = req.body as { demo?: boolean };
    forceDemoMode = typeof demo === "boolean" ? demo : !forceDemoMode;
    console.log(`[Orchestrateur] Mode forcé démo basculé à : ${forceDemoMode}`);
    res.json({ demoMode: forceDemoMode || !Boolean(apiKey) });
  });

  // --- POST /api-key : mise à jour de la clé API à chaud ---
  app.post("/api-key", (req, res) => {
    const { apiKey: newKey } = req.body as { apiKey?: string };
    if (!newKey || typeof newKey !== "string" || !newKey.trim()) {
      res.status(400).json({ error: "Clé API invalide" });
      return;
    }
    apiKey = newKey.trim();
    process.env.GEMINI_API_KEY = apiKey;
    orchestrator = new Orchestrator(apiKey, mcp);
    forceDemoMode = false;
    console.log("[Orchestrateur] Nouvelle clé API configurée avec succès.");
    res.json({ ok: true });
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

    if (forceDemoMode || !orchestrator) {
      const demoRes = generateDemoResponse(body.prompt, body.conversationId);
      res.json(demoRes);
      return;
    }

    try {
      const result: ChatResponse = await orchestrator.chat(
        body.prompt,
        body.conversationId
      );
      res.json(result);
    } catch (error) {
      console.warn("[Chat] Erreur cloud, bascule vers réponse démo :", error);
      const fallback = generateDemoResponse(body.prompt, body.conversationId);
      res.json(fallback);
    }
  });

  // --- POST /reset : réinitialiser une conversation ---
  app.post("/reset", (req, res) => {
    const { conversationId } = req.body as { conversationId: string };
    if (orchestrator && conversationId) {
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

    if (forceDemoMode || !orchestrator) {
      res.json({ text: "Transcription de démonstration ASUS prête." });
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

    if (forceDemoMode || !orchestrator) {
      res.json({ result: `Action ${toolName} simulée avec succès dans le mode démonstration ASUS.` });
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

    // Si le statut local indiquait indisponible, on tente un check dynamique au cas où le serveur a démarré
    if (!pocketTtsAvailable) {
      pocketTtsAvailable = await isPocketTtsAlive();
    }

    if (!pocketTtsAvailable) {
      res.status(503).json({
        error: "Pocket TTS non disponible",
        fallback: "browser",
      });
      return;
    }

    try {
      console.log(`[PocketTTS /speak] Synthese en cours avec la voix : ${POCKET_TTS_VOICE}`);
      const form = new FormData();
      form.append("text", text);

      // voice_url n'accepte qu'une URL distante ou un identifiant prédéfini.
      // Un chemin de fichier local Windows provoque une erreur HTTP 400 Bad Request.
      // La voix locale est déjà prise en compte par le serveur grâce au paramètre --default-voice.
      if (
        POCKET_TTS_VOICE.startsWith("http://") ||
        POCKET_TTS_VOICE.startsWith("https://") ||
        POCKET_TTS_VOICE.startsWith("hf://")
      ) {
        form.append("voice_url", POCKET_TTS_VOICE);
      }

      const ttsRes = await fetch(`${POCKET_TTS_URL}/tts`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });

      if (!ttsRes.ok) {
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
      console.error("[PocketTTS /speak] Erreur :", error);
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
    console.log("[Orchestrateur] Mémoire persistante inter-sessions Alf 2.0.3 active.");
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