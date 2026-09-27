import type { Action, PendingAction } from "../../types";
import DefaultRenderer from "./DefaultRenderer";
import EmailListRenderer from "./EmailListRenderer";
import EmailReadRenderer from "./EmailReadRenderer";
import EmailSendRenderer from "./EmailSendRenderer";
import WordPressDraftRenderer from "./WordPressDraftRenderer";
import WordPressYoastRenderer from "./WordPressYoastRenderer";
import WordPressModifyRenderer from "./WordPressModifyRenderer";
import PrepareArticleRenderer from "./PrepareArticleRenderer";

interface ActionDispatcherProps {
  action: Action;
}

interface PendingDispatcherProps {
  pending: PendingAction;
  executed?: Action;
  onValidate: (pending: PendingAction) => void;
}

export function ActionDispatcher({ action }: ActionDispatcherProps) {
  switch (action.toolName) {
    case "lister_emails_non_lus":
      return <EmailListRenderer action={action} />;

    case "lire_email_complet":
      return <EmailReadRenderer action={action} />;

    case "envoyer_email":
      return (
        <EmailSendRenderer
          pending={{
            id: `executed-${action.timestamp}`,
            toolName: action.toolName,
            serverId: action.serverId,
            args: action.args,
            createdAt: action.timestamp,
          }}
          executed={action}
          onValidate={() => {}}
        />
      );

    case "wp_creer_brouillon":
      return (
        <WordPressDraftRenderer
          pending={{
            id: `executed-${action.timestamp}`,
            toolName: action.toolName,
            serverId: action.serverId,
            args: action.args,
            createdAt: action.timestamp,
          }}
          executed={action}
          onValidate={() => {}}
        />
      );

    case "wp_definir_yoast":
      return (
        <WordPressYoastRenderer
          pending={{
            id: `executed-${action.timestamp}`,
            toolName: action.toolName,
            serverId: action.serverId,
            args: action.args,
            createdAt: action.timestamp,
          }}
          executed={action}
          onValidate={() => {}}
        />
      );

    case "wp_modifier_article":
      return (
        <WordPressModifyRenderer
          pending={{
            id: `executed-${action.timestamp}`,
            toolName: action.toolName,
            serverId: action.serverId,
            args: action.args,
            createdAt: action.timestamp,
          }}
          executed={action}
          onValidate={() => {}}
        />
      );

    case "preparer_article_avec_images":
      return (
        <PrepareArticleRenderer
          pending={{
            id: `executed-${action.timestamp}`,
            toolName: action.toolName,
            serverId: action.serverId,
            args: action.args,
            createdAt: action.timestamp,
          }}
          executed={action}
          onValidate={() => {}}
        />
      );

    default:
      return <DefaultRenderer action={action} />;
  }
}

export function PendingActionDispatcher({
  pending,
  executed,
  onValidate,
}: PendingDispatcherProps) {
  if (pending.toolName === "envoyer_email") {
    return (
      <EmailSendRenderer
        pending={pending}
        executed={executed}
        onValidate={onValidate}
      />
    );
  }

  if (pending.toolName === "wp_creer_brouillon") {
    return (
      <WordPressDraftRenderer
        pending={pending}
        executed={executed}
        onValidate={onValidate}
      />
    );
  }

  if (pending.toolName === "wp_definir_yoast") {
    return (
      <WordPressYoastRenderer
        pending={pending}
        executed={executed}
        onValidate={onValidate}
      />
    );
  }

  if (pending.toolName === "wp_modifier_article") {
    return (
      <WordPressModifyRenderer
        pending={pending}
        executed={executed}
        onValidate={onValidate}
      />
    );
  }

  if (pending.toolName === "preparer_article_avec_images") {
    return (
      <PrepareArticleRenderer
        pending={pending}
        executed={executed}
        onValidate={onValidate}
      />
    );
  }

  // Fallback pour les futurs pending tools
  return (
    <div className="p-3 text-xs border rounded-md border-amber-700 bg-amber-950/20">
      <div className="mb-2 font-medium text-amber-400">
        Action en attente : {pending.toolName}
      </div>
      <pre className="p-2 break-words whitespace-pre-wrap rounded text-alf-text/80 bg-alf-panel">
        {JSON.stringify(pending.args, null, 2)}
      </pre>
      <button
        onClick={() => onValidate(pending)}
        className="mt-2 w-full px-3 py-1.5 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-500 transition-colors"
      >
        ✅ Valider
      </button>
    </div>
  );
}

export default ActionDispatcher;