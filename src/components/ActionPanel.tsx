import type { Action, PendingAction } from "../types";
import {
  ActionDispatcher,
  PendingActionDispatcher,
} from "./actions/ActionDispatcher";

interface ActionPanelProps {
  actions: Action[];
  pendingActions?: PendingAction[];
  executedPendingIds?: Set<string>;
  onExecutePending?: (pending: PendingAction) => void;
}

export default function ActionPanel({
  actions,
  pendingActions = [],
  executedPendingIds = new Set(),
  onExecutePending = () => {},
}: ActionPanelProps) {
  const allItems = [
    ...actions.map((a) => ({
      type: "action" as const,
      data: a,
      ts: a.timestamp,
    })),
    ...pendingActions.map((p) => ({
      type: "pending" as const,
      data: p,
      ts: p.createdAt,
    })),
  ].sort((a, b) => b.ts - a.ts);

  const total = allItems.length;

  return (
    <div className="flex flex-col h-full border-l bg-alf-panel border-alf-border">
      <div className="p-4 border-b border-alf-border">
        <div className="mb-1 text-xs tracking-widest uppercase text-alf-muted">
          Actions
        </div>
        <div className="text-xs text-alf-muted">
          {total} élément{total > 1 ? "s" : ""} dans cette session
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {total === 0 && (
          <div className="px-2 mt-8 text-xs text-center text-alf-muted">
            Les actions effectuées par Alf apparaîtront ici.
          </div>
        )}

        {allItems.map((item, i) => {
          if (item.type === "action") {
            return (
              <ActionDispatcher
                key={`action-${item.data.timestamp}-${i}`}
                action={item.data as Action}
              />
            );
          } else {
            const pending = item.data as PendingAction;
            const isExecuted = executedPendingIds.has(pending.id);
            const executedAction = isExecuted
              ? actions.find(
                  (a) =>
                    a.toolName === pending.toolName &&
                    a.timestamp > pending.createdAt
                )
              : undefined;

            return (
              <PendingActionDispatcher
                key={`pending-${pending.id}`}
                pending={pending}
                executed={executedAction}
                onValidate={onExecutePending}
              />
            );
          }
        })}
      </div>
    </div>
  );
}