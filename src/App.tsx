import { useEffect, useState } from "react";
import Avatar from "./components/Avatar";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import ActionPanel from "./components/ActionPanel";
import { getStatus, getTools, sendMessage, executeAction, setApiKey, toggleDemoMode } from "./api";
import type { ToolDefinition } from "./api";
import type {
  AgentState,
  ChatMessage,
  Domain,
  PendingAction,
  Action,
} from "./types";
import { useSpeech } from "./hooks/useSpeech";
import { useBackend } from "./hooks/useBackend";

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

  // Mode démo et configuration clé API
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  const { status: backendStatus, error: backendError } = useBackend();

  const { isSupported: voiceSupported, isSpeaking, speak, stop } = useSpeech({
    lang: "fr-FR",
    rate: 1.0,
    pitch: 1.0,
  });

  async function refreshServerState() {
    try {
      const status = await getStatus();
      setServerStatus(status.servers);
      if (typeof status.demoMode === "boolean") {
        setIsDemoMode(status.demoMode);
      }
      setHasApiKey(Boolean(status.hasApiKey));

      const toolsRes = await getTools();
      setTools(toolsRes.all);
    } catch {
      setError(
        "Impossible de contacter l'orchestrateur. Vérifie que le backend tourne bien sur le port 3001."
      );
      setAgentState("error");
    }
  }

  useEffect(() => {
    if (backendStatus !== "ready") return;
    refreshServerState();
  }, [backendStatus]);

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

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;

    try {
      await setApiKey(keyInput.trim());
      setConfigFeedback("Clé API configurée avec succès !");
      setKeyInput("");
      await refreshServerState();
      setTimeout(() => {
        setConfigFeedback(null);
        setShowConfigModal(false);
      }, 1200);
    } catch (err) {
      setConfigFeedback(
        err instanceof Error ? err.message : "Erreur lors de la configuration."
      );
    }
  }

  async function handleToggleDemo() {
    const nextMode = !isDemoMode;
    setIsDemoMode(nextMode);
    try {
      await toggleDemoMode(nextMode);
      setConfigFeedback(
        nextMode
          ? "Mode Démonstration ASUS activé."
          : "Mode Écosystème Réel activé."
      );
    } catch {
      setConfigFeedback(
        nextMode
          ? "Mode Démonstration activé (interface locale)."
          : "Mode Écosystème Réel activé (interface locale)."
      );
    }
    setTimeout(() => setConfigFeedback(null), 1500);
  }

  useEffect(() => {
    if (!isSpeaking && agentState === "speaking" && voiceEnabled) {
      const t = setTimeout(() => setAgentState("idle"), 300);
      return () => clearTimeout(t);
    }
  }, [isSpeaking, agentState, voiceEnabled]);

  if (backendStatus === "starting") {
    return (
      <div className="flex items-center justify-center h-screen bg-alf-bg text-alf-text">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold">Démarrage d'Alf...</div>
          <div className="text-sm text-alf-muted">
            Initialisation du backend en cours
          </div>
        </div>
      </div>
    );
  }

  if (backendStatus === "error") {
    return (
      <div className="flex items-center justify-center h-screen text-red-400 bg-alf-bg">
        <div className="max-w-md text-center">
          <div className="mb-4 text-lg font-semibold">Erreur de démarrage</div>
          <div className="text-sm">
            {backendError || "Impossible de lancer le backend."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-alf-bg text-alf-text">
      <header className="flex items-center justify-between px-6 py-3 border-b border-alf-border bg-alf-panel">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-alf-text">Alf 2.0.2</h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
              ASUS AI Ready · NPU & GPU RTX
            </span>
          </div>
          <p className="text-xs text-alf-muted">
            {isDemoMode
              ? "Démonstrateur autonome pour ASUS"
              : "Assistant personnel autonome pour The French Miller & WARM-TV"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Badge mode cliquable */}
          <button
            onClick={handleToggleDemo}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
              isDemoMode
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            }`}
            title="Cliquer pour basculer entre Mode Réel et Mode Démo ASUS"
          >
            {isDemoMode ? "Mode Démo ASUS" : "Écosystème Réel Actif"}
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="text-xs px-2.5 py-1 rounded-md border border-alf-border text-alf-muted hover:text-alf-text hover:border-alf-accent transition-colors"
            title="Gérer la clé API"
          >
            ⚙ Clé API
          </button>

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

      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md p-6 rounded-lg bg-alf-panel border border-alf-border shadow-xl">
            <h3 className="text-base font-semibold text-alf-text mb-2">
              Configuration de l'Inférence
            </h3>
            <p className="text-xs text-alf-muted mb-4">
              {hasApiKey
                ? "Votre clé API Gemini est chargée et active. Vous pouvez la remplacer ci-dessous à tout moment."
                : "L'application fonctionne actuellement sans clé avec des réponses simulées."}
            </p>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-alf-muted mb-1">
                  Clé API Google Gemini
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Collez votre clé API Gemini ici..."
                  className="w-full px-3 py-2 text-sm rounded bg-alf-bg border border-alf-border text-alf-text focus:outline-none focus:border-alf-accent"
                />
              </div>

              <div className="pt-2 border-t border-alf-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-alf-muted">Mode actuel :</span>
                  <button
                    type="button"
                    onClick={handleToggleDemo}
                    className="px-2.5 py-1 rounded border border-alf-border text-alf-accent hover:border-alf-accent"
                  >
                    Basculer vers {isDemoMode ? "Mode Réel" : "Mode Démo ASUS"}
                  </button>
                </div>
              </div>

              {configFeedback && (
                <div className="text-xs text-alf-accent">{configFeedback}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    setConfigFeedback(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-alf-border text-alf-muted hover:text-alf-text"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded bg-alf-accent text-white font-medium hover:opacity-90"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
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
              isDemoMode={isDemoMode}
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