import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";
import { McpManager } from "./mcp-manager.js";
import type {
  Action,
  ChatResponse,
  PendingAction,
  ToolDefinition,
} from "./types.js";

/**
 * Outils qui ne s'exécutent JAMAIS automatiquement.
 * Ils sont créés en "pending" et attendent une validation explicite de l'utilisateur.
 */
const TOOLS_REQUIRING_VALIDATION = new Set(["envoyer_email"]);

const SYSTEM_INSTRUCTION = `Tu es Alf, l'assistant personnel autonome d'Erwan (The French Miller / WARM-TV / Wearerockmetal).

Ta mission : l'épauler dans sa communication numérique, ses relations presse (secteur musical/métal), la gestion de ses trois comptes email, et à terme ses projets de développement web et ses réseaux sociaux.

Tu as un accès direct à plusieurs comptes emails :
1. "thefrenchmiller" : Compte pro principal (stratégie, relations presse, agence).
2. "wearerockmetal" : Compte dédié au Webzine WARM-TV (news, articles, émission Mid Week Live).
3. "yahoo" : Compte personnel.

Règles absolues de comportement :
- TRANSVERSALITÉ : N'isole pas les comptes. Utilise les actualités RP reçues sur l'agence pour alimenter la création de contenu WARM-TV, et inversement.
- SYNTHÈSE : Lorsque tu lis un email, résume d'abord les informations clés (Qui écrit ? Que veut-il ? Quelle est l'urgence ?).
- PROACTIVITÉ : Si un email appelle une réponse, propose un brouillon.
- SÉCURITÉ : Tu peux appeler l'outil d'envoi d'email quand l'utilisateur te le demande explicitement (par exemple "envoie un mail à X" ou "réponds à Y"). L'envoi ne sera PAS exécuté immédiatement : il sera mis en attente et l'utilisateur devra le valider manuellement dans l'interface. Tu n'as donc PAS besoin de demander confirmation en langage naturel avant d'appeler l'outil — appelle-le directement, l'interface gère la validation.
- Ne JAMAIS appeler l'outil d'envoi sans que l'utilisateur te l'ait demandé explicitement.

Réponds en français, de manière concise et actionnable.

FORMAT DE RÉPONSE OBLIGATOIRE : Réponds en texte brut, en phrases complètes et naturelles. N'utilise AUCUN formatage : pas d'astérisques, pas de dièses, pas de backticks, pas de tirets de liste, pas d'emojis, pas de symboles décoratifs. Quand tu listes des éléments, écris-les dans une phrase séparés par des virgules.`;

export class Orchestrator {
  private ai: GoogleGenAI;
  private mcp: McpManager;
  private conversations: Map<string, any> = new Map();

  constructor(apiKey: string, mcp: McpManager) {
    this.ai = new GoogleGenAI({ apiKey });
    this.mcp = mcp;
  }

  private buildGeminiTools(): {
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  } {
    const tools: ToolDefinition[] = this.mcp.getAllTools();
    return {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "OBJECT",
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      })),
    };
  }

  private getOrCreateChat(conversationId: string) {
    if (!this.conversations.has(conversationId)) {
      const chat = this.ai.chats.create({
        model: "gemini-3.1-flash-lite",
        config: {
          tools: [this.buildGeminiTools()],
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
      this.conversations.set(conversationId, chat);
    }
    return this.conversations.get(conversationId)!;
  }

  async chat(prompt: string, conversationId?: string): Promise<ChatResponse> {
    const cid = conversationId || randomUUID();
    const chat = this.getOrCreateChat(cid);
    const actions: Action[] = [];
    const pendingActions: PendingAction[] = [];

    try {
      let response = await chat.sendMessage({ message: prompt });

      // Boucle d'appel d'outils
      let safetyCounter = 0;
      while (
        response.functionCalls &&
        response.functionCalls.length > 0 &&
        safetyCounter < 10
      ) {
        safetyCounter++;
        const call = response.functionCalls[0];

        // --- INTERCEPTION : outils à validation différée ---
        if (TOOLS_REQUIRING_VALIDATION.has(call.name)) {
          const pending: PendingAction = {
            id: randomUUID(),
            toolName: call.name,
            serverId: this.mcp.getTool(call.name)?.serverId || "unknown",
            args: (call.args as Record<string, unknown>) || {},
            createdAt: Date.now(),
          };
          pendingActions.push(pending);

          response = await chat.sendMessage({
            message: {
              functionResponse: {
                name: call.name,
                response: {
                  result:
                    "Action mise en attente de validation par l'utilisateur. Ne relance pas cette action, elle sera exécutée manuellement via l'interface.",
                },
              },
            },
          });

          continue;
        }
        // --- FIN INTERCEPTION ---

        try {
          const resultText = await this.mcp.callTool(
            call.name,
            (call.args as Record<string, unknown>) || {}
          );

          actions.push({
            toolName: call.name,
            serverId: this.mcp.getTool(call.name)?.serverId || "unknown",
            args: (call.args as Record<string, unknown>) || {},
            result: resultText,
            timestamp: Date.now(),
          });

          response = await chat.sendMessage({
            message: {
              functionResponse: {
                name: call.name,
                response: { result: resultText },
              },
            },
          });
        } catch (toolError) {
          const errorMsg =
            toolError instanceof Error ? toolError.message : String(toolError);
          actions.push({
            toolName: call.name,
            serverId: this.mcp.getTool(call.name)?.serverId || "unknown",
            args: (call.args as Record<string, unknown>) || {},
            result: `ERREUR : ${errorMsg}`,
            timestamp: Date.now(),
          });
          break;
        }
      }

      return {
        conversationId: cid,
        response: response.text || "(pas de réponse textuelle)",
        actions,
        pendingActions,
      };
    } catch (error) {
      return {
        conversationId: cid,
        response: "",
        actions,
        pendingActions,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Transcrit un audio en base64 via Gemini.
   */
  async transcribe(
    audioBase64: string,
    mimeType: string
  ): Promise<{ text: string; error?: string }> {
    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, "");

    const maxRetries = 3;
    const delays = [1000, 3000, 6000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Transcribe] Tentative ${attempt + 1}/${maxRetries}`);

        const response = await this.ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: "Transcris exactement ce qui est dit dans cet audio, en français. Réponds uniquement avec la transcription, sans commentaire, sans ponctuation superflue, sans guillemets. Si l'audio est silencieux ou incompréhensible, réponds avec une chaîne vide.",
                },
              ],
            },
          ],
        });

        return { text: (response.text || "").trim() };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRetryable =
          message.includes("503") ||
          message.includes("UNAVAILABLE") ||
          message.includes("overloaded") ||
          message.includes("high demand");

        console.error(
          `[Transcribe] Tentative ${attempt + 1} échouée:`,
          message
        );

        if (attempt === maxRetries - 1 || !isRetryable) {
          return { text: "", error: message };
        }

        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    return { text: "", error: "Échec après plusieurs tentatives" };
  }

  /**
   * Exécute une action qui était en attente de validation.
   * Appelé depuis l'interface quand l'utilisateur clique sur Envoyer.
   */
  async executePendingAction(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ result: string; error?: string }> {
    try {
      const result = await this.mcp.callTool(toolName, args);
      return { result };
    } catch (error) {
      return {
        result: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  resetConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}