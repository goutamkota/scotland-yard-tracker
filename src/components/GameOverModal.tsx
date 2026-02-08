import { getPlayerDisplayName } from "@/hooks/useScotlandYard";

interface GameOverModalProps {
  type: "detectives_win" | "mrx_wins";
  caughtBy?: string | null;
  caughtInRound?: number | null;
  onNewGame: () => void;
}

export function GameOverModal({ type, caughtBy, caughtInRound, onNewGame }: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 noir-glow slide-up text-center">
        {type === "detectives_win" ? (
          <>
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="font-display text-3xl font-bold text-detective mb-2">
              Mr. X Caught!
            </h2>
            <p className="text-muted-foreground font-mono text-sm mb-1">
              {caughtBy ? getPlayerDisplayName(caughtBy) : "A detective"} found Mr. X
            </p>
            <p className="text-muted-foreground font-mono text-sm mb-8">
              in Round {caughtInRound}
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">🎩</div>
            <h2 className="font-display text-3xl font-bold text-accent mb-2">
              Mr. X Escapes!
            </h2>
            <p className="text-muted-foreground font-mono text-sm mb-8">
              Mr. X survived all 24 rounds undetected
            </p>
          </>
        )}

        <button
          onClick={onNewGame}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display text-lg font-bold hover:opacity-90 transition-opacity"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
