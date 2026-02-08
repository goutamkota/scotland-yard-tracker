import { GameState, RoundData, getPlayerDisplayName, getTransportEmoji, REVEAL_ROUNDS, TransportMode } from "@/hooks/useScotlandYard";
import { X } from "lucide-react";

interface MoveTimelineProps {
  game: GameState;
  onClose: () => void;
}

export function MoveTimeline({ game, onClose }: MoveTimelineProps) {
  const gameOver = game.status === "detectives_win" || game.status === "mrx_wins";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm fade-in">
      <div className="w-full max-w-lg h-[85vh] sm:h-[80vh] rounded-t-2xl sm:rounded-xl border border-border bg-card flex flex-col slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Move History</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {game.rounds.map((round) => {
            const hasEntries = game.playerNames.some(
              (name) => round.entries[name]?.location !== null
            );
            if (!hasEntries) return null;

            const isReveal = REVEAL_ROUNDS.includes(round.roundNumber);
            const isMrxVisible = isReveal || round.mrxManualReveal || gameOver;

            return (
              <div
                key={round.roundNumber}
                className={`p-3 rounded-lg border ${
                  round.roundNumber === game.currentRound && !gameOver
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-primary">
                    Round {round.roundNumber}
                  </span>
                  {isReveal && (
                    <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
                      REVEAL
                    </span>
                  )}
                  {round.locked && (
                    <span className="text-[10px] font-mono text-muted-foreground">🔒</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {game.playerNames.map((name) => {
                    const entry = round.entries[name];
                    if (!entry || entry.location === null) return null;

                    const isMrX = name === "mrx";
                    const showLocation = !isMrX || isMrxVisible;
                    const isBlack = entry.transport === "black";

                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 text-xs font-mono"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold min-w-[40px] text-center ${
                            isMrX ? "mr-x-badge" : "detective-badge"
                          }`}
                        >
                          {isMrX ? "Mr.X" : name.toUpperCase()}
                        </span>

                        {/* Transport */}
                        {entry.transport && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${getTransportClass(entry.transport)}`}>
                            {isMrX && !isMrxVisible && isBlack ? "🎩 Black" : `${getTransportEmoji(entry.transport)} ${entry.transport}`}
                          </span>
                        )}

                        {/* Location */}
                        <span className="text-foreground">
                          → {showLocation ? `#${entry.location}` : "??"}
                        </span>

                        {/* Double move */}
                        {entry.isDoubleMove && entry.secondTransport && entry.secondLocation && (
                          <>
                            <span className="text-double-move">⚡</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${getTransportClass(entry.secondTransport)}`}>
                              {getTransportEmoji(entry.secondTransport)}
                            </span>
                            <span className="text-foreground">
                              → {showLocation ? `#${entry.secondLocation}` : "??"}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getTransportClass(mode: TransportMode): string {
  switch (mode) {
    case "taxi": return "transport-taxi";
    case "bus": return "transport-bus";
    case "underground": return "transport-underground";
    case "black": return "transport-black";
  }
}
