import type { Action } from "../../types";

interface DefaultRendererProps {
  action: Action;
}

export default function DefaultRenderer({ action }: DefaultRendererProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncate = (str: string, max: number = 200) => {
    if (str.length <= max) return str;
    return str.slice(0, max) + "...";
  };

  return (
    <div className="p-3 text-xs border rounded-md border-alf-border bg-alf-bg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-medium break-all text-alf-accent">
          {action.toolName}
        </div>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(action.timestamp)}
        </div>
      </div>

      <div className="mb-2 text-alf-muted">
        via <span className="text-alf-text">{action.serverId}</span>
      </div>

      {Object.keys(action.args).length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-alf-muted">Arguments :</div>
          <div className="p-2 overflow-x-auto font-mono break-words whitespace-pre-wrap rounded text-alf-text/80 bg-alf-panel">
            {truncate(JSON.stringify(action.args, null, 2), 300)}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-alf-muted">Résultat :</div>
        <div
          className={`font-mono rounded p-2 overflow-x-auto whitespace-pre-wrap break-words ${
            action.result.startsWith("Erreur") ||
            action.result.startsWith("ERREUR")
              ? "text-red-400 bg-red-950/30"
              : "text-alf-text/80 bg-alf-panel"
          }`}
        >
          {truncate(action.result, 400)}
        </div>
      </div>
    </div>
  );
}