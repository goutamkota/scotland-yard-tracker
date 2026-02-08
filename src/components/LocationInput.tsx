import { useState } from "react";
import { getPlayerDisplayName } from "@/hooks/useScotlandYard";

interface LocationInputProps {
  playerName: string;
  onSubmit: (location: number) => void;
}

export function LocationInput({ playerName, onSubmit }: LocationInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const isMrX = playerName === "mrx";

  const handleSubmit = () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 200) {
      setError("Enter a valid location (1-200)");
      return;
    }
    setError("");
    setValue("");
    onSubmit(num);
  };

  return (
    <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card noir-glow slide-up">
      <div className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
        isMrX ? "mr-x-badge" : "detective-badge"
      }`}>
        {getPlayerDisplayName(playerName)}
      </div>
      <p className="text-sm text-muted-foreground font-mono">Enter location number</p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setValue(v);
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="location-input text-lg"
          placeholder="e.g. 187"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Confirm
        </button>
      </div>
      {error && <p className="text-accent text-xs font-mono">{error}</p>}
    </div>
  );
}
