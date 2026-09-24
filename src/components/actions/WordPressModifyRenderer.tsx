import { useState } from "react";
import type { PendingAction, Action } from "../../types";

interface WordPressModifyRendererProps {
  pending: PendingAction;
  executed?: Action;
  onValidate: (pending: PendingAction) => void;
}

export default function WordPressModifyRenderer({
  pending,
  executed,
  onValidate,
}: WordPressModifyRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState(false);

  const articleId = (pending.args.id as number) || 0;
  const titre = (pending.args.titre as string) || "";
  const contenu = (pending.args.contenu as string) || "";
  const extrait = (pending.args.extrait as string) || "";

  const avantTitre = (pending.args._avant_titre as string) || "";
  const avantContenu = (pending.args._avant_contenu as string) || "";
  const avantExtrait = (pending.args._avant_extrait as string) || "";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const countWords = (html: string): number => {
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return 0;
    return text.split(" ").length;
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

  const adminLinkMatch = executed?.result.match(
    /Lien admin:\s*(https?:\/\/\S+)/
  );
  const adminLink = adminLinkMatch ? adminLinkMatch[1] : null;

  const champsModifies: Array<"titre" | "contenu" | "extrait"> = [];
  if (titre) champsModifies.push("titre");
  if (contenu) champsModifies.push("contenu");
  if (extrait) champsModifies.push("extrait");

  const resumeChamps = champsModifies.join(", ");

  return (
    <div
      className={`rounded-md border p-3 text-xs ${
        isExecuted
          ? isError
            ? "border-red-800 bg-red-950/20"
            : "border-green-800 bg-green-950/20"
          : "border-blue-700 bg-blue-950/20"
      }`}
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`font-medium hover:opacity-80 text-left ${
            isExecuted
              ? isError
                ? "text-red-400"
                : "text-green-400"
              : "text-blue-400"
          }`}
        >
          {expanded ? "▼" : "▶"}{" "}
          {isExecuted
            ? isError
              ? "Modification échouée"
              : "Article modifié"
            : "Prêt à modifier un article WordPress"}
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(pending.createdAt)}
        </div>
      </div>

      {/* Article ciblé */}
      <div className="mb-2">
        <div className="text-alf-muted mb-0.5">Article :</div>
        <div className="text-sm font-semibold text-alf-text">#{articleId}</div>
      </div>

      {/* Replié */}
      {!expanded && (
        <div className="italic truncate text-alf-muted">
          {champsModifies.length > 0
            ? `Modification : ${resumeChamps}`
            : "Aucun champ à modifier"}
        </div>
      )}

      {/* Déplié */}
      {expanded && (
        <>
          {champsModifies.length === 0 && (
            <div className="p-2 mb-2 rounded text-amber-400 bg-amber-950/30">
              Aucun champ à modifier. Vérifie les args.
            </div>
          )}

          {/* Champ : Titre */}
          {titre && (
            <div className="mb-3">
              <div className="text-alf-muted mb-1 text-[10px] uppercase tracking-wide">
                Titre
              </div>
              {avantTitre ? (
                <>
                  <div className="p-2 mb-1 border rounded border-red-800/40 bg-red-950/20">
                    <div className="text-red-300 text-[10px] mb-0.5">Avant</div>
                    <div className="line-through break-words text-alf-text/70">
                      {avantTitre}
                    </div>
                  </div>
                  <div className="p-2 border rounded border-green-800/40 bg-green-950/20">
                    <div className="text-green-300 text-[10px] mb-0.5">
                      Après
                    </div>
                    <div className="font-medium break-words text-alf-text">
                      {titre}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-2 border rounded bg-alf-panel border-alf-border/50">
                  <div className="font-medium break-words text-alf-text">
                    {titre}
                  </div>
                  <div className="text-alf-muted text-[10px] mt-1 italic">
                    (valeur actuelle non fournie)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Champ : Extrait */}
          {extrait && (
            <div className="mb-3">
              <div className="text-alf-muted mb-1 text-[10px] uppercase tracking-wide">
                Extrait
              </div>
              {avantExtrait ? (
                <>
                  <div className="p-2 mb-1 border rounded border-red-800/40 bg-red-950/20">
                    <div className="text-red-300 text-[10px] mb-0.5">Avant</div>
                    <div className="italic line-through break-words text-alf-text/70">
                      {avantExtrait}
                    </div>
                  </div>
                  <div className="p-2 border rounded border-green-800/40 bg-green-950/20">
                    <div className="text-green-300 text-[10px] mb-0.5">
                      Après
                    </div>
                    <div className="italic break-words text-alf-text">
                      {extrait}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-2 border rounded bg-alf-panel border-alf-border/50">
                  <div className="italic break-words text-alf-text">
                    {extrait}
                  </div>
                  <div className="text-alf-muted text-[10px] mt-1 italic">
                    (valeur actuelle non fournie)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Champ : Contenu */}
          {contenu && (
            <div className="mb-3">
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-alf-muted text-[10px] uppercase tracking-wide">
                  Contenu
                </div>
                <div className="text-alf-muted text-[10px]">
                  {avantContenu && (
                    <>
                      {countWords(avantContenu)} →{" "}
                      <span
                        className={
                          countWords(contenu) > countWords(avantContenu)
                            ? "text-green-400"
                            : countWords(contenu) < countWords(avantContenu)
                            ? "text-amber-400"
                            : "text-alf-muted"
                        }
                      >
                        {countWords(contenu)} mots
                      </span>
                    </>
                  )}
                  {!avantContenu && <>{countWords(contenu)} mots</>}
                </div>
              </div>

              {avantContenu ? (
                <>
                  <div className="p-2 mb-2 border rounded border-red-800/40 bg-red-950/20">
                    <div className="text-red-300 text-[10px] mb-1">Avant</div>
                    <div className="p-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/30 max-h-48">
                      <div
                        className="text-[11px] leading-relaxed text-alf-text/60 line-through [&_p]:mb-2 [&_h2]:font-bold [&_h2]:text-xs [&_h2]:mt-2 [&_h2]:mb-1 [&_strong]:font-semibold [&_em]:italic"
                        dangerouslySetInnerHTML={{ __html: avantContenu }}
                      />
                    </div>
                  </div>
                  <div className="p-2 border rounded border-green-800/40 bg-green-950/20">
                    <div className="text-green-300 text-[10px] mb-1">Après</div>
                    <div className="p-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/30 max-h-48">
                      <div
                        className="text-[11px] leading-relaxed text-alf-text/90 [&_p]:mb-2 [&_h2]:font-bold [&_h2]:text-xs [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:mt-1 [&_strong]:font-semibold [&_strong]:text-alf-text [&_em]:italic"
                        dangerouslySetInnerHTML={{ __html: contenu }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/50 max-h-64">
                  <div
                    className="text-[11px] leading-relaxed text-alf-text/90 [&_p]:mb-2 [&_h2]:font-bold [&_h2]:text-xs [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:mt-1 [&_strong]:font-semibold [&_strong]:text-alf-text [&_em]:italic"
                    dangerouslySetInnerHTML={{ __html: contenu }}
                  />
                  <div className="text-alf-muted text-[10px] mt-1 italic">
                    (valeur actuelle non fournie)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bouton de validation */}
          {!isExecuted && champsModifies.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validating
                  ? "Modification en cours..."
                  : "✅ Appliquer les modifications"}
              </button>
            </div>
          )}

          {/* Résultat après exécution */}
          {isExecuted && !isError && (
            <div className="text-green-300 bg-green-950/40 rounded p-2 text-[10px] whitespace-pre-wrap break-words">
              <div>{executed.result}</div>
              {adminLink && (
                <a
                  href={adminLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-green-400 underline hover:text-green-200"
                >
                  Ouvrir dans WordPress →
                </a>
              )}
            </div>
          )}

          {isExecuted && isError && (
            <div className="text-red-300 bg-red-950/40 rounded p-2 text-[10px] whitespace-pre-wrap break-words">
              {executed.result}
            </div>
          )}
        </>
      )}
    </div>
  );
}