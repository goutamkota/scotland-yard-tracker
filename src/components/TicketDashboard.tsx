import { GameState, getPlayerDisplayName, getTransportEmoji } from "@/hooks/useScotlandYard";
import { X } from "lucide-react";

interface TicketDashboardProps {
  game: GameState;
  onClose: () => void;
}

export function TicketDashboard({ game, onClose }: TicketDashboardProps) {
  const ticketTypes = [
    { key: "taxi" as const, emoji: "🚕", label: "Taxi", colorClass: "transport-taxi" },
    { key: "bus" as const, emoji: "🚌", label: "Bus", colorClass: "transport-bus" },
    { key: "underground" as const, emoji: "🚇", label: "Undg", colorClass: "transport-underground" },
    { key: "black" as const, emoji: "🎩", label: "Black", colorClass: "transport-black", mrxOnly: true },
    { key: "double" as const, emoji: "⚡", label: "2X", colorClass: "transport-double", mrxOnly: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm fade-in">
      <div className="w-full max-w-lg max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-xl border border-border bg-card flex flex-col slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold">Ticket Dashboard</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Table header */}
          <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `auto repeat(${ticketTypes.length}, 1fr)` }}>
            <div className="font-mono text-[10px] text-muted-foreground px-2 py-1">Player</div>
            {ticketTypes.map((t) => (
              <div key={t.key} className="font-mono text-[10px] text-muted-foreground text-center py-1">
                {t.emoji}
              </div>
            ))}
          </div>

          {/* Player rows */}
          {game.playerNames.map((name) => {
            const isMrX = name === "mrx";
            const tickets = game.tickets[name];
            if (!tickets) return null;

            return (
              <div
                key={name}
                className="grid gap-1 mb-1.5"
                style={{ gridTemplateColumns: `auto repeat(${ticketTypes.length}, 1fr)` }}
              >
                <div className={`px-2 py-1.5 rounded text-xs font-mono font-semibold ${
                  isMrX ? "mr-x-badge" : "detective-badge"
                }`}>
                  {isMrX ? "Mr.X" : name.toUpperCase()}
                </div>
                {ticketTypes.map((t) => {
                  if (t.mrxOnly && !isMrX) {
                    return <div key={t.key} className="text-center py-1.5 text-muted-foreground/30 text-xs font-mono">—</div>;
                  }
                  const count = tickets[t.key] ?? 0;
                  return (
                    <div
                      key={t.key}
                      className={`text-center py-1.5 rounded text-xs font-mono font-semibold ${
                        count > 0
                          ? t.colorClass + " opacity-90"
                          : "bg-muted/50 text-muted-foreground line-through opacity-50"
                      }`}
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Bank row — where Mr. X's used tickets go */}
          {game.bank && (
            <div
              className="grid gap-1 mb-1.5 mt-2 pt-2 border-t border-border"
              style={{ gridTemplateColumns: `auto repeat(${ticketTypes.length}, 1fr)` }}
            >
              <div className="px-2 py-1.5 rounded text-xs font-mono font-semibold bg-muted text-muted-foreground">
                🏦 Bank
              </div>
              {ticketTypes.map((t) => {
                const count = game.bank[t.key] ?? 0;
                return (
                  <div
                    key={t.key}
                    className={`text-center py-1.5 rounded text-xs font-mono font-semibold ${
                      count > 0
                        ? "bg-muted/80 text-foreground"
                        : "bg-muted/30 text-muted-foreground opacity-50"
                    }`}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          )}

          {/* Usage over rounds */}
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="font-mono text-xs text-muted-foreground mb-3">Ticket Usage Log</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {game.rounds.map((round) => {
                const hasEntries = game.playerNames.some(
                  (name) => round.entries[name]?.transport !== null
                );
                if (!hasEntries) return null;

                return (
                  <div key={round.roundNumber} className="flex items-start gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground min-w-[30px]">
                      R{round.roundNumber}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {game.playerNames.map((name) => {
                        const entry = round.entries[name];
                        if (!entry?.transport) return null;
                        const isMrX = name === "mrx";
                        return (
                          <span
                            key={name}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted"
                          >
                            <span className={isMrX ? "text-accent" : "text-detective"}>
                              {isMrX ? "X" : name.toUpperCase()}
                            </span>
                            :{getTransportEmoji(entry.transport)}
                            {entry.isDoubleMove && entry.secondTransport && (
                              <span className="text-double-move">+{getTransportEmoji(entry.secondTransport)}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
