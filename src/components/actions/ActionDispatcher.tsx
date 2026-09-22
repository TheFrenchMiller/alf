import type { Action, PendingAction } from "../../types";
import DefaultRenderer from "./DefaultRenderer";
import EmailListRenderer from "./EmailListRenderer";
import EmailReadRenderer from "./EmailReadRenderer";
import EmailSendRenderer from "./EmailSendRenderer";

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