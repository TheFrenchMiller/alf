import { useState } from "react";
import type { Action } from "../../types";

interface EmailReadRendererProps {
  action: Action;
}

export default function EmailReadRenderer({ action }: EmailReadRendererProps) {
  const [expanded, setExpanded] = useState(true);

  const compte = (action.args.compte as string) || "inconnu";
  const uid = (action.args.uid as number | string) || "?";
  const isError =
    action.result.startsWith("Erreur") || action.result.startsWith("ERREUR");
  const isNotFound = action.result.includes("introuvable");

  // Nettoie le préfixe "Contenu brut :" ajouté par le serveur MCP
  const cleanBody = action.result
    .replace(/^Contenu brut\s*:\s*/i, "")
    .trim();

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-3 text-xs border rounded-md border-alf-border bg-alf-bg">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-medium text-left text-alf-accent hover:opacity-80"
        >
          {expanded ? "▼" : "▶"} Lecture d'un email
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(action.timestamp)}
        </div>
      </div>

      {/* Métadonnées */}
      <div className="text-alf-muted mb-2 space-y-0.5">
        <div>
          Compte : <span className="font-medium text-alf-text">{compte}</span>
        </div>
        <div>
          UID : <span className="text-alf-text">{uid}</span>
        </div>
      </div>

      {/* Replié */}
      {!expanded && (
        <div className="italic text-alf-muted">
          {isError
            ? "Erreur — clique pour voir"
            : isNotFound
            ? "Email introuvable"
            : `${cleanBody.length} caractères`}
        </div>
      )}

      {/* Déplié */}
      {expanded && (
        <>
          {isError && (
            <div className="p-2 text-red-400 rounded bg-red-950/30">
              {action.result}
            </div>
          )}

          {!isError && isNotFound && (
            <div className="p-2 italic rounded text-alf-muted bg-alf-panel">
              Email introuvable (UID {uid} n'existe pas ou a été supprimé).
            </div>
          )}

          {!isError && !isNotFound && (
            <div className="p-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/50 max-h-96">
              <pre className="font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-alf-text/80">
                {cleanBody || "(vide)"}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}