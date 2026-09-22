// Client API pour parler à l'orchestrateur (server/index.ts)

const API_BASE = "http://localhost:3001";

// --- Types (miroir de server/types.ts) ---

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
}

export interface ToolsResponse {
  all: ToolDefinition[];
  byDomain: Record<string, ToolDefinition[]>;
}

// --- Fonctions ---

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Erreur status: ${res.status}`);
  return res.json();
}

export async function getTools(): Promise<ToolsResponse> {
  const res = await fetch(`${API_BASE}/tools`);
  if (!res.ok) throw new Error(`Erreur tools: ${res.status}`);
  return res.json();
}

export async function sendMessage(
  prompt: string,
  conversationId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, conversationId }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Erreur chat (${res.status}): ${errorBody}`);
  }
  return res.json();
}

export async function resetConversation(conversationId: string): Promise<void> {
  await fetch(`${API_BASE}/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
}

export async function transcribeAudio(
  base64: string,
  mimeType: string
): Promise<{ text: string; error?: string }> {
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64, mimeType }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return { text: "", error: `Erreur transcription (${res.status}): ${errorBody}` };
  }

  return res.json();
}

export async function executeAction(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ result: string; error?: string }> {
  const res = await fetch(`${API_BASE}/execute-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName, args }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return { result: "", error: `Erreur exécution (${res.status}): ${errorBody}` };
  }

  return res.json();
}