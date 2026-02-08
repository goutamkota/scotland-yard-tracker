import { useState } from "react";
import { Lock } from "lucide-react";

interface MrXPasswordGateProps {
  onVerified: () => void;
  verifyPassword: (password: string) => boolean;
}

export function MrXPasswordGate({ onVerified, verifyPassword }: MrXPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (verifyPassword(password)) {
      setError("");
      onVerified();
    } else {
      setError("Wrong password");
      setPassword("");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card card-glow slide-up w-full max-w-sm mx-auto">
      <div className="mr-x-badge px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        Mr. X's Turn
      </div>
      <p className="text-sm text-muted-foreground font-mono text-center">
        Enter Mr. X's password to continue
      </p>
      <div className="flex gap-2 w-full">
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-foreground font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Password"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-mono text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Unlock
        </button>
      </div>
      {error && <p className="text-accent text-xs font-mono">{error}</p>}
    </div>
  );
}
