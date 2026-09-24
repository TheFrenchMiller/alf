import { useState } from "react";
import type { PendingAction, Action } from "../../types";

interface WordPressYoastRendererProps {
  pending: PendingAction;
  executed?: Action;
  onValidate: (pending: PendingAction) => void;
}

/**
 * Aperçu des modifications Yoast SEO d'un article existant.
 * Pattern aligné sur WordPressDraftRenderer (expand/collapse, 3 états visuels, compteurs).
 */
export default function WordPressYoastRenderer({
  pending,
  executed,
  onValidate,
}: WordPressYoastRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState(false);

  const articleId = (pending.args.id as number) || 0;
  const expressionCle = (pending.args.mot_cle_focus as string) || "";
  const titreSeo = (pending.args.titre_seo as string) || "";
  const metaDescription = (pending.args.meta_description as string) || "";

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const countFocusWords = (str: string): number => {
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
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

  const nbMotsCle = countFocusWords(expressionCle);
  const hasAnyField = expressionCle || titreSeo || metaDescription;

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
              ? "Mise à jour Yoast échouée"
              : "Yoast SEO mis à jour"
            : "Prêt à modifier le Yoast SEO"}
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(pending.createdAt)}
        </div>
      </div>

      {/* Article ciblé */}
      <div className="mb-2">
        <div className="text-alf-muted mb-0.5">Article :</div>
        <div className="text-sm font-semibold text-alf-text">
          #{articleId}
        </div>
      </div>

      {/* Replié */}
      {!expanded && (
        <div className="italic truncate text-alf-muted">
          {hasAnyField
            ? `Modification de ${[
                expressionCle && "expression clé",
                titreSeo && "titre SEO",
                metaDescription && "méta description",
              ]
                .filter(Boolean)
                .join(", ")}`
            : "Aucun champ à modifier"}
        </div>
      )}

      {/* Déplié */}
      {expanded && (
        <>
          {!hasAnyField && (
            <div className="p-2 mb-2 rounded text-amber-400 bg-amber-950/30">
              Aucun champ Yoast à modifier. Vérifie les args.
            </div>
          )}

          {hasAnyField && (
            <div className="p-2 mb-2 border rounded border-blue-800/50 bg-blue-950/20">
              <div className="text-blue-300 font-medium mb-2 text-[10px] uppercase tracking-wide">
                Nouvelles valeurs Yoast
              </div>

              {/* Expression clé principale */}
              {expressionCle && (
                <div className="mb-2">
                  <div className="text-alf-muted text-[10px]">
                    Expression clé principale{" "}
                    <span
                      className={
                        nbMotsCle > 4 ? "text-red-400" : "text-alf-muted"
                      }
                    >
                      ({nbMotsCle} mot{nbMotsCle > 1 ? "s" : ""})
                    </span>
                  </div>
                  <div className="font-medium break-words text-alf-text">
                    {expressionCle}
                  </div>
                </div>
              )}

              {/* Titre SEO */}
              {titreSeo && (
                <div className="mb-2">
                  <div className="text-alf-muted text-[10px]">
                    Titre SEO{" "}
                    <span
                      className={
                        titreSeo.length > 60 ? "text-red-400" : "text-alf-muted"
                      }
                    >
                      ({titreSeo.length}/60)
                    </span>
                  </div>
                  <div className="break-words text-alf-text">{titreSeo}</div>
                </div>
              )}

              {/* Méta description */}
              {metaDescription && (
                <div>
                  <div className="text-alf-muted text-[10px]">
                    Méta description{" "}
                    <span
                      className={
                        metaDescription.length > 155
                          ? "text-red-400"
                          : "text-alf-muted"
                      }
                    >
                      ({metaDescription.length}/155)
                    </span>
                  </div>
                  <div className="break-words text-alf-text">
                    {metaDescription}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bouton de validation */}
          {!isExecuted && hasAnyField && (
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validating ? "Mise à jour..." : "✅ Appliquer les modifications"}
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