import {
  TransportMode,
  PlayerTickets,
  getAvailableTransports,
  getTransportLabel,
  getTransportEmoji,
  getPlayerDisplayName,
} from "@/hooks/useScotlandYard";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";

interface TransportSelectorProps {
  playerName: string;
  location: number;
  tickets: PlayerTickets;
  onSelect: (transport: TransportMode, useDoubleMove: boolean) => void;
  onCancel: () => void;
  canDoubleMove: boolean;
  isDoubleMoving: boolean;
}

export function TransportSelector({
  playerName,
  location,
  tickets,
  onSelect,
  onCancel,
  canDoubleMove,
  isDoubleMoving,
}: TransportSelectorProps) {
  const isMrX = playerName === "mrx";
  const available = getAvailableTransports(tickets, isMrX);

  const handleSelect = (mode: TransportMode, useDouble: boolean) => {
    sounds.confirm();
    haptics.select();
    onSelect(mode, useDouble);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm fade-in p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 sm:p-6 card-glow slide-up">
        <div className="text-center mb-4">
          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-semibold mb-2 ${
              isMrX ? "mr-x-badge" : "detective-badge"
            }`}
          >
            {getPlayerDisplayName(playerName)}
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            Moving to location <span className="text-foreground font-semibold">{location}</span>
          </p>
          {isDoubleMoving && (
            <p className="text-double-move font-mono text-xs mt-1 font-semibold">
              ⚡ Double Move — Second Leg
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground font-mono mb-3 text-center">
          Select transport mode:
        </p>

        <div className="grid grid-cols-1 gap-2">
          {/* Regular transport options */}
          {available.map((mode) => (
            <button
              key={mode}
              onClick={() => handleSelect(mode, false)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border border-border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${getTransportButtonClass(mode)}`}
            >
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span className="text-lg">{getTransportEmoji(mode)}</span>
                {getTransportLabel(mode)}
              </span>
              <span className="font-mono text-xs opacity-70">
                ×{tickets[mode]}
              </span>
            </button>
          ))}

          {/* 
            Double Move option for Mr. X:
            This just activates the double move. The user picks a REGULAR transport
            for the first leg here. Then after entering the second location, 
            they pick a potentially DIFFERENT transport for the second leg.
            This allows all combos: Taxi→Bus, Underground→Black, etc.
          */}
          {isMrX && canDoubleMove && !isDoubleMoving && tickets.double > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <p className="text-xs text-muted-foreground font-mono text-center">
                ⚡ Use Double Move (×{tickets.double}) — pick first leg transport:
              </p>
              {available.map((mode) => (
                <button
                  key={`double-${mode}`}
                  onClick={() => handleSelect(mode, true)}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 border-double-move/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${getTransportButtonClass(mode)} relative`}
                >
                  <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                    <span className="text-lg">⚡{getTransportEmoji(mode)}</span>
                    2X: {getTransportLabel(mode)}
                  </span>
                  <span className="font-mono text-xs opacity-70">
                    2X:×{tickets.double} · {getTransportLabel(mode)}:×{tickets[mode]}
                  </span>
                </button>
              ))}
              <p className="text-[10px] text-muted-foreground font-mono text-center opacity-60">
                After entering 2nd location, you'll pick a different transport for the 2nd leg
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => {
            sounds.tap();
            onCancel();
          }}
          className="w-full mt-3 py-2 rounded-lg bg-secondary text-muted-foreground font-mono text-xs hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function getTransportButtonClass(mode: TransportMode): string {
  switch (mode) {
    case "taxi":
      return "bg-taxi/10 hover:bg-taxi/20 text-taxi-foreground";
    case "bus":
      return "bg-bus/10 hover:bg-bus/20 text-foreground";
    case "underground":
      return "bg-underground/10 hover:bg-underground/20 text-foreground";
    case "black":
      return "bg-black-ticket/20 hover:bg-black-ticket/30 text-foreground";
  }
}
