import { RoundData, REVEAL_ROUNDS, getPlayerDisplayName, getTransportEmoji, TransportMode } from "@/hooks/useScotlandYard";
import { Eye, EyeOff } from "lucide-react";

interface RoundCardProps {
  round: RoundData;
  playerNames: string[];
  isCurrent: boolean;
  isMrxVisible: boolean;
  onToggleReveal: () => void;
  gameOver: boolean;
}

function TransportBadge({ transport }: { transport: TransportMode | null | undefined }) {
  if (!transport) return null;
  const classMap: Record<TransportMode, string> = {
    taxi: "transport-taxi",
    bus: "transport-bus",
    underground: "transport-underground",
    black: "transport-black",
    double: "transport-double",
  };
  return (
    <span className={`inline-block text-[9px] px-1 py-0 rounded ${classMap[transport]} leading-tight`}>
      {getTransportEmoji(transport)}
    </span>
  );
}

export function RoundCard({ round, playerNames, isCurrent, isMrxVisible, onToggleReveal, gameOver }: RoundCardProps) {
  const isRevealRound = REVEAL_ROUNDS.includes(round.roundNumber);
  const hasEntries = playerNames.some((name) => round.entries[name]?.location !== null);

  return (
    <div
      className={`round-card p-2 sm:p-3 ${isCurrent ? "current" : ""} ${round.locked ? "locked" : ""} ${
        isRevealRound ? "reveal-round" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span className={`font-mono text-[10px] sm:text-xs font-semibold ${
          isCurrent ? "text-primary" : "text-muted-foreground"
        }`}>
          R{round.roundNumber}
        </span>
        <div className="flex items-center gap-0.5">
          {isRevealRound && (
            <span className="text-[8px] sm:text-[10px] font-mono text-primary px-1 py-0.5 rounded bg-primary/10">
              REV
            </span>
          )}
          {round.locked && (
            <span className="text-[8px] sm:text-[10px] font-mono text-muted-foreground">
              🔒
            </span>
          )}
        </div>
      </div>

      {hasEntries && (
        <div className="space-y-0.5">
          {playerNames.map((name) => {
            const entry = round.entries[name];
            const loc = entry?.location;
            const isMrX = name === "mrx";
            const showLocation = !isMrX || isMrxVisible || gameOver;
            const showTransport = !isMrX || isMrxVisible || gameOver;

            return (
              <div key={name} className="flex items-center justify-between text-[10px] sm:text-xs gap-0.5">
                <span className={`font-mono ${isMrX ? "text-accent" : "text-detective"}`}>
                  {isMrX ? "X" : name.toUpperCase()}
                </span>
                <span className="font-mono text-foreground flex items-center gap-0.5">
                  {showTransport && entry?.transport && <TransportBadge transport={entry.transport} />}
                  {!showTransport && entry?.transport && (
                    <span className="text-[8px] px-1 rounded bg-muted text-muted-foreground">?</span>
                  )}
                  {loc === null ? "—" : showLocation ? loc : "??"}
                  {/* Show double move second leg */}
                  {isMrX && entry?.secondLocation && showLocation && (
                    <span className="text-double-move ml-0.5">
                      →{entry.secondLocation}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {round.locked && !gameOver && (
        <button
          onClick={onToggleReveal}
          className="mt-1.5 w-full flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors py-0.5 rounded bg-muted/50"
        >
          {round.mrxManualReveal || REVEAL_ROUNDS.includes(round.roundNumber) ? (
            <>
              <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {!REVEAL_ROUNDS.includes(round.roundNumber) && "Hide"}
            </>
          ) : (
            <>
              <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Reveal
            </>
          )}
        </button>
      )}
    </div>
  );
}
