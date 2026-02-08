import { RoundData, getPlayerDisplayName, getTransportEmoji, REVEAL_ROUNDS } from "@/hooks/useScotlandYard";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";

interface RoundSummaryProps {
  round: RoundData;
  playerNames: string[];
  onClose: () => void;
}

export function RoundSummary({ round, playerNames, onClose }: RoundSummaryProps) {
  const isReveal = REVEAL_ROUNDS.includes(round.roundNumber);
  const mrxEntry = round.entries["mrx"];
  const mrxLocation = mrxEntry?.secondLocation ?? mrxEntry?.location;

  // Check if any detective caught Mr. X
  let capturedBy: string | null = null;
  for (const name of playerNames) {
    if (name === "mrx") continue;
    if (round.entries[name]?.location === mrxLocation) {
      capturedBy = name;
      break;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 sm:p-6 card-glow slide-up">
        <div className="text-center mb-4">
          <span className="text-2xl mb-2 block">
            {capturedBy ? "🚨" : isReveal ? "👁️" : "🔒"}
          </span>
          <h2 className="font-display text-lg font-bold">
            Round {round.roundNumber} Summary
          </h2>
          {isReveal && (
            <p className="text-primary font-mono text-xs mt-1">📍 Reveal Round</p>
          )}
        </div>

        {/* Player moves */}
        <div className="space-y-2 mb-4">
          {playerNames.map((name) => {
            const entry = round.entries[name];
            if (!entry || entry.location === null) return null;
            const isMrX = name === "mrx";
            const showLocation = !isMrX || isReveal || round.mrxManualReveal;

            return (
              <div
                key={name}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  capturedBy === name ? "bg-detective/10 border border-detective/30" : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    isMrX ? "mr-x-badge" : "detective-badge"
                  }`}>
                    {getPlayerDisplayName(name)}
                  </span>
                </div>
                <div className="font-mono text-xs flex items-center gap-1.5">
                  {entry.transport && (
                    <span className="opacity-80">
                      {isMrX && !showLocation && entry.transport === "black"
                        ? "🎩"
                        : getTransportEmoji(entry.transport)}
                    </span>
                  )}
                  <span className="font-semibold">
                    {showLocation ? `#${entry.location}` : "??"}
                  </span>
                  {entry.isDoubleMove && entry.secondTransport && entry.secondLocation && (
                    <span className="text-double-move">
                      → {entry.secondTransport && getTransportEmoji(entry.secondTransport)}{" "}
                      {showLocation ? `#${entry.secondLocation}` : "??"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Capture alert */}
        {capturedBy && (
          <div className="p-3 rounded-lg bg-detective/10 border border-detective/30 text-center mb-4">
            <p className="font-display font-bold text-detective text-sm">
              🕵️ {getPlayerDisplayName(capturedBy)} caught Mr. X!
            </p>
          </div>
        )}

        {/* Reveal info */}
        {isReveal && !capturedBy && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center mb-4">
            <p className="font-mono text-xs text-primary">
              Mr. X was at location <span className="font-bold">#{mrxLocation}</span>
            </p>
          </div>
        )}

        <button
          onClick={() => {
            sounds.tap();
            haptics.tap();
            onClose();
          }}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
