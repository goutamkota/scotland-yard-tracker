import { RoundData, REVEAL_ROUNDS, getPlayerDisplayName } from "@/hooks/useScotlandYard";
import { Eye, EyeOff } from "lucide-react";

interface RoundCardProps {
  round: RoundData;
  playerNames: string[];
  isCurrent: boolean;
  isMrxVisible: boolean;
  onToggleReveal: () => void;
  gameOver: boolean;
}

export function RoundCard({ round, playerNames, isCurrent, isMrxVisible, onToggleReveal, gameOver }: RoundCardProps) {
  const isRevealRound = REVEAL_ROUNDS.includes(round.roundNumber);
  const hasEntries = playerNames.some((name) => round.entries[name]?.location !== null);

  return (
    <div
      className={`round-card p-3 ${isCurrent ? "current" : ""} ${round.locked ? "locked" : ""} ${
        isRevealRound ? "reveal-round" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-xs font-semibold ${
          isCurrent ? "text-primary" : "text-muted-foreground"
        }`}>
          R{round.roundNumber}
        </span>
        <div className="flex items-center gap-1">
          {isRevealRound && (
            <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">
              REVEAL
            </span>
          )}
          {round.locked && (
            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
              🔒
            </span>
          )}
        </div>
      </div>

      {hasEntries && (
        <div className="space-y-1">
          {playerNames.map((name) => {
            const entry = round.entries[name];
            const loc = entry?.location;
            const isMrX = name === "mrx";
            const showLocation = !isMrX || isMrxVisible || gameOver;

            return (
              <div key={name} className="flex items-center justify-between text-xs">
                <span className={`font-mono ${isMrX ? "text-accent" : "text-detective"}`}>
                  {isMrX ? "X" : name.toUpperCase()}
                </span>
                <span className="font-mono text-foreground">
                  {loc === null ? "—" : showLocation ? loc : "????"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {round.locked && !gameOver && (
        <button
          onClick={onToggleReveal}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors py-1 rounded bg-muted/50"
        >
          {round.mrxManualReveal || REVEAL_ROUNDS.includes(round.roundNumber) ? (
            <>
              <EyeOff className="w-3 h-3" />
              {!REVEAL_ROUNDS.includes(round.roundNumber) && "Hide X"}
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" /> Reveal X
            </>
          )}
        </button>
      )}
    </div>
  );
}
