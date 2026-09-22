import type { AgentState } from "../types";

interface AvatarProps {
  state: AgentState;
  size?: number;
  isSpeaking?: boolean;
}

export default function Avatar({
  state,
  size = 120,
  isSpeaking = false,
}: AvatarProps) {
  // Si la voix est active, on force visuellement l'état "speaking"
  const effectiveState: AgentState = isSpeaking ? "speaking" : state;

  const stateConfig: Record<
    AgentState,
    { color: string; glow: string; label: string; pulse: boolean }
  > = {
    idle: {
      color: "#7c5cff",
      glow: "rgba(124, 92, 255, 0.3)",
      label: "Au repos",
      pulse: false,
    },
    thinking: {
      color: "#ffb84d",
      glow: "rgba(255, 184, 77, 0.5)",
      label: "Réflexion...",
      pulse: true,
    },
    speaking: {
      color: "#4dffb8",
      glow: "rgba(77, 255, 184, 0.6)",
      label: "Parle",
      pulse: true,
    },
    error: {
      color: "#ff4d6d",
      glow: "rgba(255, 77, 109, 0.5)",
      label: "Erreur",
      pulse: false,
    },
  };

  const config = stateConfig[effectiveState];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Ondes sonores autour quand la voix est active */}
        {isSpeaking && (
          <>
            <span
              className="absolute rounded-full border-2 pointer-events-none"
              style={{
                width: size * 1.1,
                height: size * 1.1,
                borderColor: config.color,
                opacity: 0.4,
                animation: "alf-wave 1.2s ease-out infinite",
              }}
            />
            <span
              className="absolute rounded-full border-2 pointer-events-none"
              style={{
                width: size * 1.1,
                height: size * 1.1,
                borderColor: config.color,
                opacity: 0.4,
                animation: "alf-wave 1.2s ease-out infinite",
                animationDelay: "0.6s",
              }}
            />
          </>
        )}

        {/* Corps de l'avatar */}
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${config.color}, ${config.color}44)`,
            boxShadow: `0 0 ${config.pulse ? 40 : 20}px ${config.glow}`,
            animation: config.pulse
              ? isSpeaking
                ? "alf-pulse-fast 0.6s ease-in-out infinite"
                : "alf-pulse 1.8s ease-in-out infinite"
              : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
        >
          <div
            style={{
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: "50%",
              background: "rgba(10, 10, 15, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.25,
              color: config.color,
              fontWeight: "bold",
              fontFamily: "monospace",
            }}
          >
            ALF
          </div>
        </div>
      </div>

      <div className="text-sm font-medium" style={{ color: config.color }}>
        {config.label}
      </div>

      <style>{`
        @keyframes alf-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes alf-pulse-fast {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes alf-wave {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}