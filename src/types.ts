// Types locaux à l'interface React

export type AgentState = "idle" | "thinking" | "speaking" | "error";

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

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
  actions?: Action[];
  pendingActions?: PendingAction[];
}

export type Domain = "messagerie" | "code" | "reseaux-sociaux" | "general";