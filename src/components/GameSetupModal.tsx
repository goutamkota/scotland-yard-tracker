import { useState } from "react";

interface GameSetupModalProps {
  onStart: (detectiveCount: number) => void;
}

export function GameSetupModal({ onStart }: GameSetupModalProps) {
  const [count, setCount] = useState(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 noir-glow slide-up">
        <h2 className="game-title text-3xl font-bold text-center mb-2">Scotland Yard</h2>
        <p className="text-muted-foreground text-center mb-8 text-sm font-mono">
          Track the chase across London
        </p>

        <div className="mb-8">
          <label className="block text-sm text-muted-foreground mb-3 font-mono">
            Number of Detectives
          </label>
          <div className="flex gap-3 justify-center">
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`w-16 h-16 rounded-lg border-2 font-display text-xl font-bold transition-all duration-200 ${
                  count === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-foreground hover:border-primary/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3 font-mono">
            {count + 1} players total (1 Mr. X + {count} Detectives)
          </p>
        </div>

        <button
          onClick={() => onStart(count)}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display text-lg font-bold hover:opacity-90 transition-opacity"
        >
          Begin the Hunt
        </button>
      </div>
    </div>
  );
}
