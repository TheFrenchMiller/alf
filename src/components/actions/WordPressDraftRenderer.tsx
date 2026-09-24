import { useState } from "react";
import type { PendingAction, Action } from "../../types";

interface WordPressDraftRendererProps {
  pending: PendingAction;
  executed?: Action;
  onValidate: (pending: PendingAction) => void;
}

export default function WordPressDraftRenderer({
  pending,
  executed,
  onValidate,
}: WordPressDraftRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const [validating, setValidating] = useState(false);

  const titre = (pending.args.titre as string) || "(sans titre)";
  const contenu = (pending.args.contenu as string) || "(vide)";
  const extrait = (pending.args.extrait as string) || "";
  const categories = (pending.args.categories as number[]) || [];
  const tags = (pending.args.tags as number[]) || [];

  // Champs Yoast
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

  const countWords = (html: string): number => {
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return 0;
    return text.split(" ").length;
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

  // Extrait le lien admin du résultat pour l'afficher
  const adminLinkMatch = executed?.result.match(
    /Lien admin:\s*(https?:\/\/\S+)/
  );
  const adminLink = adminLinkMatch ? adminLinkMatch[1] : null;

  const nbMots = countWords(contenu);
  const nbMotsCle = countFocusWords(expressionCle);

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
              ? "Création échouée"
              : "Brouillon créé"
            : "Prêt à créer un brouillon WordPress"}
        </button>
        <div className="text-alf-muted whitespace-nowrap">
          {formatTime(pending.createdAt)}
        </div>
      </div>

      {!expanded && (
        <div className="italic truncate text-alf-muted">{titre}</div>
      )}

      {expanded && (
        <>
          {/* Titre */}
          <div className="mb-2">
            <div className="text-alf-muted mb-0.5">Titre :</div>
            <div className="text-sm font-semibold break-words text-alf-text">
              {titre}
            </div>
          </div>

          {/* Catégories et tags */}
          {(categories.length > 0 || tags.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.length > 0 && (
                <div className="text-alf-muted">
                  Catégories :{" "}
                  <span className="text-alf-text">
                    {categories.join(", ")}
                  </span>
                </div>
              )}
              {tags.length > 0 && (
                <div className="text-alf-muted">
                  Tags :{" "}
                  <span className="text-alf-text">{tags.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Extrait */}
          {extrait && (
            <div className="mb-2">
              <div className="text-alf-muted mb-0.5">Extrait :</div>
              <div className="italic break-words text-alf-text/80">
                {extrait}
              </div>
            </div>
          )}

          {/* Yoast SEO */}
          {(expressionCle || titreSeo || metaDescription) && (
            <div className="p-2 mb-2 border rounded border-blue-800/50 bg-blue-950/20">
              <div className="text-blue-300 font-medium mb-1 text-[10px] uppercase tracking-wide">
                Yoast SEO
              </div>

              {/* Expression clé principale — en premier, c'est le champ pilote */}
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

          {/* Contenu */}
          <div className="mb-2">
            <div className="flex items-baseline justify-between mb-0.5">
              <div className="text-alf-muted">Contenu :</div>
              <div className="text-alf-muted text-[10px]">
                {nbMots} mots
              </div>
            </div>
            <div className="p-2 overflow-y-auto border rounded bg-alf-panel border-alf-border/50 max-h-64">
              <div
                className="text-xs leading-relaxed text-alf-text/90 [&_p]:mb-2 [&_h2]:font-bold [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:mt-2 [&_strong]:font-semibold [&_strong]:text-alf-text [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: contenu }}
              />
            </div>
          </div>

          {/* Bouton de validation OU résultat */}
          {!isExecuted && (
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validating ? "Création en cours..." : "✅ Créer le brouillon"}
              </button>
            </div>
          )}

          {/* Résultat après création */}
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