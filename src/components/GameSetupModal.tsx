import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

interface GameSetupModalProps {
  onStart: (detectiveCount: number, mrxPassword: string) => void;
}

export function GameSetupModal({ onStart }: GameSetupModalProps) {
  const [count, setCount] = useState(3);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleStart = () => {
    if (password.length < 1) {
      setError("Mr. X must set a password");
      return;
    }
    onStart(count, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 card-glow slide-up">
        <h2 className="game-title text-2xl sm:text-3xl font-bold text-center mb-1">Scotland Yard</h2>
        <p className="text-muted-foreground text-center mb-6 text-xs sm:text-sm font-mono">
          Track the chase across London
        </p>

        <div className="mb-6">
          <label className="block text-sm text-muted-foreground mb-3 font-mono">
            Number of Detectives
          </label>
          <div className="flex gap-3 justify-center">
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 font-display text-xl font-bold transition-all duration-200 ${
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

        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm text-muted-foreground mb-3 font-mono">
            <Lock className="w-3.5 h-3.5" />
            Mr. X Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="Set a password for Mr. X"
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground font-mono text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-accent text-xs font-mono mt-2">{error}</p>}
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Mr. X will need this to enter moves privately
          </p>
        </div>

        <button
          onClick={handleStart}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-display text-lg font-bold hover:opacity-90 transition-opacity"
        >
          Begin the Hunt
        </button>
      </div>
    </div>
  );
}
