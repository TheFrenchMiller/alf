import type { Domain } from "../types";
import type { ToolDefinition } from "../api";

interface SidebarProps {
  tools: ToolDefinition[];
  activeDomain: Domain | "all";
  onDomainChange: (domain: Domain | "all") => void;
  serverStatus: { id: string; connected: boolean; toolCount: number }[];
}

const DOMAIN_LABELS: Record<Domain, string> = {
  messagerie: "Messagerie",
  code: "Code",
  "reseaux-sociaux": "Réseaux sociaux",
  general: "Général",
};

const DOMAIN_ICONS: Record<Domain, string> = {
  messagerie: "✉",
  code: "⌨",
  "reseaux-sociaux": "◎",
  general: "◈",
};

export default function Sidebar({
  tools,
  activeDomain,
  onDomainChange,
  serverStatus,
}: SidebarProps) {
  // Regroupe les outils par domaine
  const domains = new Map<Domain, number>();
  for (const tool of tools) {
    const d = tool.domain as Domain;
    domains.set(d, (domains.get(d) || 0) + 1);
  }

  const domainList = Array.from(domains.entries());

  return (
    <div className="h-full flex flex-col bg-alf-panel border-r border-alf-border">
      {/* En-tête */}
      <div className="p-4 border-b border-alf-border">
        <div className="text-xs uppercase tracking-widest text-alf-muted mb-1">
          Domaines
        </div>
        <div className="text-xs text-alf-muted">
          {tools.length} outil{tools.length > 1 ? "s" : ""} disponible
          {tools.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Liste des domaines */}
      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onDomainChange("all")}
          className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm transition-colors ${
            activeDomain === "all"
              ? "bg-alf-accent text-white"
              : "text-alf-text hover:bg-alf-border"
          }`}
        >
          <span className="mr-2">◇</span>
          Tous
          <span className="float-right text-xs opacity-70">{tools.length}</span>
        </button>

        {domainList.map(([domain, count]) => (
          <button
            key={domain}
            onClick={() => onDomainChange(domain)}
            className={`w-full text-left px-3 py-2 rounded-md mb-1 text-sm transition-colors ${
              activeDomain === domain
                ? "bg-alf-accent text-white"
                : "text-alf-text hover:bg-alf-border"
            }`}
          >
            <span className="mr-2">{DOMAIN_ICONS[domain] || "•"}</span>
            {DOMAIN_LABELS[domain] || domain}
            <span className="float-right text-xs opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* État des serveurs */}
      <div className="p-3 border-t border-alf-border">
        <div className="text-xs uppercase tracking-widest text-alf-muted mb-2">
          Serveurs MCP
        </div>
        {serverStatus.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 text-xs text-alf-muted mb-1"
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: s.connected ? "#4dffb8" : "#ff4d6d",
              }}
            />
            <span className="capitalize">{s.id}</span>
            <span className="ml-auto opacity-60">{s.toolCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}