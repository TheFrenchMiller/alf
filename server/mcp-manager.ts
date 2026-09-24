import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type {
  McpConfig,
  McpServerConfig,
  ToolDefinition,
  ServerStatus,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ManagedServer {
  id: string;
  config: McpServerConfig;
  client: Client | null;
  connected: boolean;
  tools: ToolDefinition[];
  error?: string;
}

/**
 * Remplace les `${VAR}` dans une chaîne par la valeur de process.env.VAR.
 * Utilisé pour injecter des secrets depuis .env dans mcp.config.json.
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`[MCP] Variable d'environnement manquante: ${varName}`);
      return "";
    }
    return envValue;
  });
}

/**
 * Applique la substitution sur tous les champs d'une config serveur.
 */
function resolveServerConfig(config: McpServerConfig): McpServerConfig {
  const resolved: McpServerConfig = { ...config };

  if (resolved.args) {
    resolved.args = resolved.args.map(substituteEnvVars);
  }

  if (resolved.env) {
    const newEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolved.env)) {
      newEnv[key] = substituteEnvVars(value);
    }
    resolved.env = newEnv;
  }

  return resolved;
}

/**
 * Filtre process.env pour ne garder que les valeurs définies (non-undefined).
 * Nécessaire car NodeJS.ProcessEnv est de type Record<string, string | undefined>.
 */
function getCleanEnv(): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

export class McpManager {
  private servers: Map<string, ManagedServer> = new Map();
  private toolsIndex: Map<string, ToolDefinition> = new Map();

  constructor(configPath?: string) {
    // Résolution du chemin de config :
    // - Priorité 1 : paramètre explicite (mode programmatique)
    // - Priorité 2 : variable d'environnement ALF_MCP_CONFIG_PATH (mode exe compilé)
    // - Priorité 3 : __dirname (mode dev, npm run server)
    const path =
      configPath ||
      process.env.ALF_MCP_CONFIG_PATH ||
      resolve(__dirname, "mcp.config.json");

    console.log(`[MCP] Chargement de la config depuis : ${path}`);
    const raw = readFileSync(path, "utf-8");
    const config: McpConfig = JSON.parse(raw);

    for (const [id, serverConfig] of Object.entries(config.servers)) {
      this.servers.set(id, {
        id,
        config: resolveServerConfig(serverConfig),
        client: null,
        connected: false,
        tools: [],
      });
    }
  }

  async connectAll(): Promise<void> {
    const promises = Array.from(this.servers.values()).map((server) =>
      this.connectServer(server)
    );
    await Promise.allSettled(promises);
  }

  private async connectServer(server: ManagedServer): Promise<void> {
    try {
      console.log(`[MCP] Connexion à ${server.id}...`);

      // Résolution des chemins vers les scripts MCP :
      // - Mode exe compilé : MCP_SERVERS_DIR contient le dossier mcp-servers/
      //   → on extrait le basename (mcp-email.js) et on résout depuis ce dossier
      // - Mode dev : __dirname est le dossier server/, on résout le chemin relatif
      const mcpServersDir = process.env.MCP_SERVERS_DIR;
      const resolvedArgs = server.config.args.map((arg) => {
        if (arg.startsWith("./") || arg.startsWith("../")) {
          if (mcpServersDir) {
            const basename = arg.split("/").pop() || arg;
            return resolve(mcpServersDir, basename);
          }
          return resolve(__dirname, arg);
        }
        return arg;
      });

      const transport = new StdioClientTransport({
        command: server.config.command,
        args: resolvedArgs,
        env: {
          ...getCleanEnv(),
          ...(server.config.env || {}),
        },
      });

      const client = new Client(
        { name: `alf-orchestrator-${server.id}`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);

      const list = await client.listTools();

      server.client = client;
      server.connected = true;
      server.tools = list.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        inputSchema: (tool.inputSchema as ToolDefinition["inputSchema"]) || {
          type: "object",
          properties: {},
        },
        serverId: server.id,
        domain: server.config.domains[0] || "general",
      }));

      for (const tool of server.tools) {
        this.toolsIndex.set(tool.name, tool);
      }

      console.log(
        `[MCP] ${server.id} connecté — ${server.tools.length} outil(s)`
      );
    } catch (error) {
      server.connected = false;
      server.error = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Échec ${server.id}:`, server.error);
    }
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.toolsIndex.values());
  }

  getToolsByDomain(): Record<string, ToolDefinition[]> {
    const result: Record<string, ToolDefinition[]> = {};
    for (const tool of this.toolsIndex.values()) {
      if (!result[tool.domain]) result[tool.domain] = [];
      result[tool.domain].push(tool);
    }
    return result;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.toolsIndex.get(name);
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const tool = this.toolsIndex.get(name);
    if (!tool) throw new Error(`Outil inconnu : ${name}`);

    const server = this.servers.get(tool.serverId);
    if (!server || !server.client) {
      throw new Error(`Serveur MCP "${tool.serverId}" non connecté`);
    }

    const result = await server.client.callTool({
      name,
      arguments: args,
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    if (Array.isArray(content)) {
      return content
        .map((c) => (c.type === "text" ? c.text || "" : ""))
        .join("\n");
    }
    return JSON.stringify(result);
  }

  getStatus(): ServerStatus[] {
    return Array.from(this.servers.values()).map((s) => ({
      id: s.id,
      connected: s.connected,
      toolCount: s.tools.length,
      error: s.error,
    }));
  }

  async shutdown(): Promise<void> {
    for (const server of this.servers.values()) {
      if (server.client) {
        try {
          await server.client.close();
        } catch {
          // ignore
        }
      }
    }
  }
}