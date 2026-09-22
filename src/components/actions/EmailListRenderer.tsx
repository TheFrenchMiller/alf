import { useState } from "react";
import type { Action } from "../../types";

interface EmailListRendererProps {
  action: Action;
}

interface ParsedEmail {
  uid: string;
  from: string;
  subject: string;
}

function parseEmailList(text: string): ParsedEmail[] {
  const lines = text.split("\n");
  const emails: ParsedEmail[] = [];

  for (const line of lines) {
    const match = line.match(
      /^-\s*\[UID:\s*(\d+)\]\s*De:\s*(.+?)\s*\|\s*Sujet:\s*(.+)$/
    );
    if (match) {
      emails.push({
        uid: match[1],
        from: match[2].trim(),
        subject: match[3].trim(),
      });
    }
  }

  return emails;
}

export default function EmailListRenderer({ action }: EmailListRendererProps) {
  const [expanded, setExpanded] = useState(true);

  const compte = (action.args.compte as string) || "inconnu";
  const emails = parseEmailList(action.result);
  const isError =
    action.result.startsWith("Erreur") || action.result.startsWith("ERREUR");
  const isEmpty = action.result.includes("Aucun nouveau message");

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-3 text-xs border rounded-md border-alf-border bg-alf-bg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-medium text-left text-alf-accent hover:opacity-80"
        >
          {expanded ? "▼" : "▶"} Emails non lus
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(action.timestamp)}
        </div>
      </div>

      <div className="mb-2 text-alf-muted">
        Compte : <span className="font-medium text-alf-text">{compte}</span>
      </div>

      {!expanded && (
        <div className="italic text-alf-muted">
          {isError
            ? "Erreur — clique pour voir"
            : isEmpty
            ? "Aucun message"
            : `${emails.length} message${emails.length > 1 ? "s" : ""}`}
        </div>
      )}

      {expanded && (
        <>
          {isError && (
            <div className="p-2 text-red-400 rounded bg-red-950/30">
              {action.result}
            </div>
          )}

          {!isError && isEmpty && (
            <div className="italic text-alf-muted">Aucun message non lu</div>
          )}

          {!isError && !isEmpty && emails.length > 0 && (
            <div className="space-y-1.5">
              {emails.map((email) => (
                <div
                  key={email.uid}
                  className="p-2 border rounded bg-alf-panel border-alf-border/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium truncate text-alf-text">
                      {email.from}
                    </div>
                    <div className="text-alf-muted whitespace-nowrap text-[10px]">
                      UID {email.uid}
                    </div>
                  </div>
                  <div className="text-alf-text/80 mt-0.5 break-words">
                    {email.subject}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isError && !isEmpty && emails.length === 0 && (
            <div className="p-2 break-words whitespace-pre-wrap rounded text-alf-text/80 bg-alf-panel">
              {action.result}
            </div>
          )}
        </>
      )}
    </div>
  );
}