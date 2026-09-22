import { useState } from "react";
import type { PendingAction, Action } from "../../types";

interface EmailSendRendererProps {
  pending: PendingAction;
  executed?: Action;
  onValidate: (pending: PendingAction) => void;
}

export default function EmailSendRenderer({
  pending,
  executed,
  onValidate,
}: EmailSendRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState(false);

  const destinataire = (pending.args.destinataire as string) || "?";
  const sujet = (pending.args.sujet as string) || "(sans sujet)";
  const corps = (pending.args.corps as string) || "(vide)";
  const compte = (pending.args.compte as string) || "?";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      await onValidate(pending);
    } finally {
      setValidating(false);
    }
  };

  const isExecuted = !!executed;
  const isError =
    executed &&
    (executed.result.startsWith("Erreur") ||
      executed.result.startsWith("ERREUR"));

  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        isExecuted
          ? isError
            ? "border-red-800 bg-red-950/20"
            : "border-green-800 bg-green-950/20"
          : "border-amber-700 bg-amber-950/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`font-medium hover:opacity-80 text-left ${
            isExecuted
              ? isError
                ? "text-red-400"
                : "text-green-400"
              : "text-amber-400"
          }`}
        >
          {expanded ? "▼" : "▶"}{" "}
          {isExecuted
            ? isError
              ? "Envoi échoué"
              : "Email envoyé"
            : "Prêt à envoyer"}
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(pending.createdAt)}
        </div>
      </div>

      {!expanded && (
        <div className="italic text-alf-muted">
          {destinataire} — {sujet}
        </div>
      )}

      {expanded && (
        <>
          <div className="text-alf-muted mb-2 space-y-0.5">
            <div>
              Depuis : <span className="font-medium text-alf-text">{compte}</span>
            </div>
            <div>
              Vers : <span className="font-medium text-alf-text">{destinataire}</span>
            </div>
            <div>
              Sujet : <span className="font-medium text-alf-text">{sujet}</span>
            </div>
          </div>

          <div className="p-2 mb-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/50 max-h-64">
            <pre className="font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-alf-text/80">
              {corps}
            </pre>
          </div>

          {!isExecuted && (
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 px-3 py-1.5 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validating ? "Envoi en cours..." : "✅ Envoyer"}
              </button>
            </div>
          )}

          {isExecuted && (
            <div
              className={`font-mono rounded p-2 text-[10px] whitespace-pre-wrap break-words ${
                isError
                  ? "text-red-300 bg-red-950/40"
                  : "text-green-300 bg-green-950/40"
              }`}
            >
              {executed.result}
            </div>
          )}
        </>
      )}
    </div>
  );
}