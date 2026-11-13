// Types partagés entre le serveur Express et l'interface React

export interface McpServerConfig {
  command: string;
  args: string[];
  domains: string[];
  description: string;
  env?: Record<string, string>;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
  domain: string;
}

export interface Action {
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: number;
}

export interface PendingAction {
  id: string;
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
  createdAt: number;
}

export interface ChatRequest {
  prompt: string;
  conversationId?: string;
}

export interface ChatResponse {
  conversationId: string;
  response: string;
  actions: Action[];
  pendingActions?: PendingAction[];
  error?: string;
}

export interface ServerStatus {
  id: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

export interface StatusResponse {
  servers: ServerStatus[];
  totalTools: number;
  hasApiKey?: boolean;
  demoMode?: boolean;
}