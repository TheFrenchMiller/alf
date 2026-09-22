import { useEffect, useState } from "react";
import Avatar from "./components/Avatar";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import ActionPanel from "./components/ActionPanel";
import { getStatus, getTools, sendMessage, executeAction } from "./api";
import type { ToolDefinition } from "./api";
import type {
  AgentState,
  ChatMessage,
  Domain,
  PendingAction,
  Action,
} from "./types";
import { useSpeech } from "./hooks/useSpeech";

function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function App() {
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allPendingActions, setAllPendingActions] = useState<PendingAction[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [serverStatus, setServerStatus] = useState<
    { id: string; connected: boolean; toolCount: number }[]
  >([]);
  const [activeDomain, setActiveDomain] = useState<Domain | "all">("all");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const { isSupported: voiceSupported, isSpeaking, speak, stop } = useSpeech({
    lang: "fr-FR",
    rate: 1.0,
    pitch: 1.0,
  });

  useEffect(() => {
    async function bootstrap() {
      try {
        const status = await getStatus();
        setServerStatus(status.servers);
        const toolsRes = await getTools();
        setTools(toolsRes.all);
      } catch (e) {
        setError(
          "Impossible de contacter l'orchestrateur. Vérifie que 'npm run server' tourne sur le port 3001."
        );
        setAgentState("error");
      }
    }
    bootstrap();
  }, []);

  async function handleSend(prompt: string) {
    stop();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setAgentState("thinking");
    setError(null);

    try {
      const res = await sendMessage(prompt, conversationId);

      if (res.error) {
        setError(res.error);
        setAgentState("error");
        const errorMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: `Erreur : ${res.error}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      setConversationId(res.conversationId);
      setAgentState("speaking");

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: res.response,
        timestamp: Date.now(),
        actions: res.actions,
        pendingActions: res.pendingActions,
      };
      setMessages((prev) => [...prev, agentMsg]);

      if (res.actions && res.actions.length > 0) {
        setAllActions((prev) => [...prev, ...res.actions]);
      }

      const newPending: PendingAction[] = res.pendingActions ?? [];
      if (newPending.length > 0) {
        setAllPendingActions((prev) => [...prev, ...newPending]);
      }

      if (voiceEnabled && res.response) {
        speak(cleanForSpeech(res.response));
      }

      if (!voiceEnabled) {
        setTimeout(() => setAgentState("idle"), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAgentState("error");
    }
  }

  async function handleExecutePending(pending: PendingAction) {
    setError(null);

    try {
      const res = await executeAction(pending.toolName, pending.args);
      if (res.error) {
        setError(res.error);
        return;
      }

      const executedAction: Action = {
        toolName: pending.toolName,
        serverId: pending.serverId,
        args: pending.args,
        result: res.result,
        timestamp: Date.now(),
      };
      setAllActions((prev) => [...prev, executedAction]);

      const confirmation: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: `Action exécutée : ${res.result}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, confirmation]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!isSpeaking && agentState === "speaking" && voiceEnabled) {
      const t = setTimeout(() => setAgentState("idle"), 300);
      return () => clearTimeout(t);
    }
  }, [isSpeaking, agentState, voiceEnabled]);

  return (
    <div className="flex flex-col h-screen bg-alf-bg text-alf-text">
      <header className="flex items-center justify-between px-6 py-3 border-b border-alf-border bg-alf-panel">
        <div>
          <h1 className="text-lg font-semibold text-alf-text">Alf 2.0.1</h1>
          <p className="text-xs text-alf-muted">
            Assistant personnel de The French Miller
          </p>
        </div>
        <div className="flex items-center gap-4">
          {voiceSupported && (
            <button
              onClick={() => {
                if (voiceEnabled) stop();
                setVoiceEnabled(!voiceEnabled);
              }}
              className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                voiceEnabled
                  ? "border-alf-accent text-alf-accent hover:bg-alf-accent/10"
                  : "border-alf-border text-alf-muted hover:bg-alf-border"
              }`}
            >
              {voiceEnabled ? "🔊 Voix ON" : "🔇 Voix OFF"}
            </button>
          )}
          <div className="text-xs text-alf-muted">
            {serverStatus.filter((s) => s.connected).length}/
            {serverStatus.length} serveur
            {serverStatus.length > 1 ? "s" : ""} MCP
          </div>
        </div>
      </header>

      {error && (
        <div className="px-6 py-2 text-sm text-red-300 border-b border-red-800 bg-red-950/40">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-shrink-0 w-56">
          <Sidebar
            tools={tools}
            activeDomain={activeDomain}
            onDomainChange={setActiveDomain}
            serverStatus={serverStatus}
          />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex justify-center p-6 border-b border-alf-border">
            <Avatar state={agentState} size={100} isSpeaking={isSpeaking} />
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              disabled={agentState === "thinking"}
            />
          </div>
        </div>

        <div className="flex-shrink-0 w-80">
          <ActionPanel
            actions={allActions}
            pendingActions={allPendingActions}
            onExecutePending={handleExecutePending}
          />
        </div>
      </div>
    </div>
  );
}